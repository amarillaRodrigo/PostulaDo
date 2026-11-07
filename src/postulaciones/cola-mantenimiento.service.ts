import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/** Nombre de la cola de análisis. BullMQ lo usa para las claves en Redis. */
export const COLA_ANALISIS = 'analisis-trabajo';

/** Un trabajo terminado se guarda un día: alcanza para que el navegador lo lea. */
export const RETENCION_SEGUNDOS = 24 * 3600;
const RETENCION_MS = RETENCION_SEGUNDOS * 1000;

/** Tope duro de trabajos guardados, por si el tráfico crece dentro de la hora. */
export const MAX_COMPLETADOS = 200;
export const MAX_FALLIDOS = 100;

/** Barrido periódico y ventana de caché de la medición de memoria. */
const BARRIDO_MS = 30 * 60 * 1000;
const MEDICION_MS = 30 * 1000;

/**
 * Umbrales sobre la memoria del plan free (30 MB en Redis Cloud).
 *
 * Ojo: BullMQ exige una política de Redis sin desalojo (`noeviction`). Si se
 * configura `allkeys-lru`, Redis puede borrar claves de la cola y dejarla
 * inconsistente. Por eso la limpieza se hace desde la aplicación.
 */
const UMBRAL_LIMPIEZA = 0.85;
const UMBRAL_RECHAZO = 0.95;

/** En una limpieza de emergencia no se borran trabajos recién terminados. */
const GRACIA_EMERGENCIA_MS = 10 * 60 * 1000;

/** Tope de trabajos que se borran por barrido. */
const LOTE_LIMPIEZA = 1000;

const MB = 1024 * 1024;

export interface MemoriaRedis {
  usada: number;
  limite: number;
}

/**
 * Lee `used_memory` y `maxmemory` de la salida de `INFO memory`.
 *
 * Redis Cloud suele fijar `maxmemory` al tamaño del plan; si viene en 0 se usa
 * el límite configurado por entorno (`REDIS_MEMORY_LIMIT_MB`, 30 por defecto).
 */
export function parsearMemoria(
  info: string,
  limitePorDefecto: number,
): MemoriaRedis {
  const usada = Number(/^used_memory:(\d+)/m.exec(info)?.[1] ?? 0);
  const configurado = Number(/^maxmemory:(\d+)/m.exec(info)?.[1] ?? 0);

  return {
    usada,
    limite: configurado > 0 ? configurado : limitePorDefecto,
  };
}

export function limitePorEntorno(): number {
  const mb = Number(process.env.REDIS_MEMORY_LIMIT_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 30) * MB;
}

/**
 * Mantiene la cola dentro de la memoria del plan free.
 *
 * Tres capas:
 *  1. Retención acotada al encolar (edad + cantidad, en `analyze`).
 *  2. Barrido cada 30 minutos de trabajos terminados.
 *  3. Guardia antes de encolar: si Redis está por llenarse, limpia; si igual
 *     queda arriba del 95%, responde 503 con un mensaje entendible en vez de
 *     dejar que Redis rechace la escritura con un error opaco.
 */
@Injectable()
export class ColaMantenimientoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ColaMantenimientoService.name);
  private temporizador?: NodeJS.Timeout;
  private ultimaMedicion?: { at: number; valor: MemoriaRedis | null };

  constructor(@InjectQueue(COLA_ANALISIS) private readonly queue: Queue) {}

  onModuleInit(): void {
    // Un barrido al arrancar: si el servicio se reinicia con Redis lleno,
    // la limpieza ocurre ya, sin esperar media hora.
    void this.barrer();

    this.temporizador = setInterval(() => void this.barrer(), BARRIDO_MS);
    this.temporizador.unref?.();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  /** Borra trabajos terminados que ya nadie va a consultar. */
  async limpiar(graciaMs: number = RETENCION_MS) {
    const completados = await this.queue.clean(
      graciaMs,
      LOTE_LIMPIEZA,
      'completed',
    );
    const fallidos = await this.queue.clean(graciaMs, LOTE_LIMPIEZA, 'failed');

    if (completados.length > 0 || fallidos.length > 0) {
      this.logger.log(
        `Cola limpia: ${completados.length} completados y ${fallidos.length} fallidos.`,
      );
    }

    // La memoria cambió: la próxima guardia vuelve a medir.
    this.ultimaMedicion = undefined;

    return { completados: completados.length, fallidos: fallidos.length };
  }

  /** Se llama antes de encolar un análisis. */
  async asegurarEspacio(): Promise<void> {
    const memoria = await this.medir();
    if (!memoria) return;

    const uso = memoria.usada / memoria.limite;
    if (uso < UMBRAL_LIMPIEZA) return;

    this.logger.warn(
      `Redis al ${Math.round(uso * 100)}% de ${Math.round(
        memoria.limite / MB,
      )} MB. Limpio trabajos terminados antes de encolar.`,
    );

    try {
      await this.limpiar(GRACIA_EMERGENCIA_MS);
    } catch (error) {
      this.logger.warn(
        `No se pudo limpiar la cola: ${(error as Error).message}`,
      );
      return;
    }

    const despues = await this.medir(true);
    if (despues && despues.usada / despues.limite >= UMBRAL_RECHAZO) {
      this.logger.error(
        `Redis sigue al ${Math.round(
          (despues.usada / despues.limite) * 100,
        )}%: no se encola más.`,
      );
      throw new ServiceUnavailableException(
        'La cola de análisis está llena en este momento. Probá de nuevo en unos minutos.',
      );
    }
  }

  private async barrer(): Promise<void> {
    try {
      const memoria = await this.medir();

      if (memoria) {
        const porcentaje = Math.round((memoria.usada / memoria.limite) * 100);
        this.logger.log(
          `Redis: ${(memoria.usada / MB).toFixed(1)} de ${(
            memoria.limite / MB
          ).toFixed(0)} MB (${porcentaje}%).`,
        );
      }

      const uso = memoria ? memoria.usada / memoria.limite : 0;
      await this.limpiar(
        uso >= UMBRAL_LIMPIEZA ? GRACIA_EMERGENCIA_MS : RETENCION_MS,
      );
    } catch (error) {
      this.logger.warn(`Barrido de la cola falló: ${(error as Error).message}`);
    }
  }

  private async medir(forzar = false): Promise<MemoriaRedis | null> {
    const ahora = Date.now();
    if (
      !forzar &&
      this.ultimaMedicion &&
      ahora - this.ultimaMedicion.at < MEDICION_MS
    ) {
      return this.ultimaMedicion.valor;
    }

    try {
      const cliente = await this.queue.client;
      // La interfaz de BullMQ declara `info()` sin sección; devuelve todo.
      const info = await cliente.info();
      const valor = parsearMemoria(info, limitePorEntorno());
      this.ultimaMedicion = { at: ahora, valor };
      return valor;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la memoria de Redis: ${(error as Error).message}`,
      );
      this.ultimaMedicion = { at: ahora, valor: null };
      return null;
    }
  }
}
