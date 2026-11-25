import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ColaLlenaException } from '../common/exceptions/cola-llena.exception';
import { COLA_ANALISIS } from './cola.constants';
import { MarcaTrabajoService } from './marca-trabajo.service';

export { COLA_ANALISIS };

/** Un trabajo terminado se conserva 30 s para que el cliente alcance a leerlo. */
export const RETENCION_SEGUNDOS = 30;
const RETENCION_MS = RETENCION_SEGUNDOS * 1000;

/** Tope duro de trabajos guardados, por si el tráfico crece dentro de la hora. */
export const MAX_COMPLETADOS = 200;
export const MAX_FALLIDOS = 100;

/** Barrido de memoria/marcas y limpieza frecuente de trabajos expirados. */
const BARRIDO_MS = 30 * 60 * 1000;
const LIMPIEZA_RETENCION_MS = 10 * 1000;
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

/** La limpieza de emergencia respeta la misma ventana de lectura del cliente. */
const GRACIA_EMERGENCIA_MS = RETENCION_MS;

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
 *  1. Retención acotada al encolar (30 s + tope por cantidad, en `analyze`).
 *  2. Limpieza de expirados cada 10 s y barrido de memoria/marcas cada 30 min.
 *  3. Guardia antes de encolar: si Redis está por llenarse, limpia; si igual
 *     queda arriba del 95%, responde 503 con un mensaje entendible en vez de
 *     dejar que Redis rechace la escritura con un error opaco.
 */
@Injectable()
export class ColaMantenimientoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ColaMantenimientoService.name);
  private temporizador?: NodeJS.Timeout;
  private temporizadorRetencion?: NodeJS.Timeout;
  private ultimaMedicion?: { at: number; valor: MemoriaRedis | null };

  constructor(
    @InjectQueue(COLA_ANALISIS) private readonly queue: Queue,
    private readonly marcas: MarcaTrabajoService,
  ) {}

  onModuleInit(): void {
    // Un barrido al arrancar: si el servicio se reinicia con Redis lleno,
    // la limpieza ocurre ya, sin esperar media hora.
    void this.barrer();

    this.temporizador = setInterval(() => void this.barrer(), BARRIDO_MS);
    this.temporizador.unref?.();

    // BullMQ elimina por edad de forma diferida al completar otros trabajos.
    // Este barrido hace que la retención de 30 s también se aplique si no hay
    // más trabajos nuevos que disparen esa limpieza diferida.
    this.temporizadorRetencion = setInterval(
      () => void this.limpiarExpirados(),
      LIMPIEZA_RETENCION_MS,
    );
    this.temporizadorRetencion.unref?.();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    if (this.temporizadorRetencion) clearInterval(this.temporizadorRetencion);
  }

  private async limpiarExpirados(): Promise<void> {
    try {
      await this.limpiar(RETENCION_MS);
    } catch (error) {
      this.logger.warn(
        `No se pudieron limpiar trabajos expirados: ${(error as Error).message}`,
      );
    }
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

    // Si borramos datos, la próxima guardia vuelve a medir la memoria.
    if (completados.length > 0 || fallidos.length > 0) {
      this.ultimaMedicion = undefined;
    }

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
      throw new ColaLlenaException();
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

      // Las marcas de "este trabajo existió" también son memoria de Redis y
      // también tienen tope. Se recortan en el mismo barrido: no hace falta
      // un segundo timer, y así ninguna estructura queda sin techo.
      const recorte = await this.marcas.recortar();
      if (recorte.vencidas > 0 || recorte.sobrantes > 0) {
        this.logger.log(
          `Marcas recortadas: ${recorte.vencidas} vencidas, ${recorte.sobrantes} por el tope.`,
        );
      }
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
