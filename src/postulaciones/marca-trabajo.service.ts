import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { COLA_ANALISIS } from './cola.constants';

/**
 * Cuánto vive la marca de "este trabajo existió".
 *
 * Tiene que sobrevivir al trabajo: el trabajo se borra de Redis a las 24 h de
 * terminar (o antes, al llegar al tope de 200 completados), y la marca es lo
 * único que permite decir "existió pero expiró" (410) en vez de "nunca
 * existió" (404).
 */
export const MARCA_VIGENCIA_SEGUNDOS = 7 * 24 * 3600;

/**
 * Tope de marcas guardadas.
 *
 * Sin este tope, la marca es la única estructura del proyecto que crece sin
 * límite: la cola tiene tope por edad y por cantidad, y Redis está en un
 * plan de 30 MB. El tope es lo que hace la marca comparable con el resto.
 *
 * Cuando se supera, se borran las marcas más viejas. Lo que se pierde es
 * el 410 de esos trabajos: pasan a 404. Es una degradación tolerable (un
 * cliente que consulta un trabajo de hace más de un día es raro) y
 * preferible a que las marcas coman el plan de Redis.
 */
export const MAX_MARCAS = 2000;

/**
 * La clave de Redis donde viven las marcas.
 *
 * **Una sola clave**, no una por trabajo. Un hash con un campo por trabajo:
 *
 *   HSET postulado:analisis:vistos <jobId> "<userId>|<venceEnMs>"
 *
 * Así el overhead por entrada es el de un campo de hash (no el de una clave
 * completa con su expiración) y el conjunto se puede recortar entero.
 */
const CLAVE_MARCAS = 'postulado:analisis:vistos';

/** Cuántos campos se borran por llamada: un `HDEL` con 2000 campos es enorme. */
const LOTE_BORRADO = 500;

export interface DueñoTrabajo {
  userId: string;
  /** Si la ventana de la marca sigue abierta (o sea, si todavía sabemos algo). */
  vigente: boolean;
}

@Injectable()
export class MarcaTrabajoService {
  constructor(@InjectQueue(COLA_ANALISIS) private readonly queue: Queue) {}

  /**
   * Deja la marca de "este trabajo existió y era de este usuario".
   *
   * Es una ayuda, no una garantía: si Redis falla acá, el trabajo se encola
   * igual y su estado se consulta bien. Lo único que se pierde es la
   * distinción entre 404 y 410 una vez purgado.
   */
  async marcar(jobId: string, userId: string): Promise<void> {
    try {
      const cliente = await this.queue.client;
      if (!cliente) return;

      const vence = Date.now() + MARCA_VIGENCIA_SEGUNDOS * 1000;
      await cliente.hset(CLAVE_MARCAS, { [jobId]: `${userId}|${vence}` });
    } catch {
      // Sin marca no hay 410, pero el trabajo está encolado: es preferible
      // un 404 a dejar el encolado a medias por culpa de un campo más.
    }
  }

  /** El dueño del trabajo y si la ventana de la marca sigue abierta. */
  async buscar(jobId: string): Promise<DueñoTrabajo | null> {
    try {
      const cliente = await this.queue.client;
      if (!cliente) return null;

      const valor = await cliente.hget(CLAVE_MARCAS, jobId);
      if (!valor) return null;

      const [userId, vence] = valor.split('|');
      return { userId, vigente: Number(vence) > Date.now() };
    } catch {
      return null;
    }
  }

  /**
   * Recorta el conjunto de marcas: primero las vencidas, después las que
   * sobran del tope.
   *
   * Lo llama el barrido periódico (`ColaMantenimientoService.barrer`), que
   * ya corre cada 30 minutos y ya existe para que Redis no se llene. No
   * hace falta un segundo timer: el mismo sweep que limpia trabajos
   * terminados limpia las marcas que ya no sirven.
   */
  async recortar(): Promise<{ vencidas: number; sobrantes: number }> {
    const cliente = await this.queue.client;
    if (!cliente) return { vencidas: 0, sobrantes: 0 };

    const todas = await cliente.hgetall(CLAVE_MARCAS);
    const entradas = Object.entries(todas);
    if (entradas.length === 0) return { vencidas: 0, sobrantes: 0 };

    const ahora = Date.now();
    const vencidas: string[] = [];
    const vivas: Array<[string, number]> = [];

    for (const [jobId, valor] of entradas) {
      const vence = Number(valor.split('|')[1]);
      if (!Number.isFinite(vence) || vence <= ahora) {
        vencidas.push(jobId);
      } else {
        vivas.push([jobId, vence]);
      }
    }

    // Las que ya no sirven van primero: si sobran, sobran las viejas.
    if (vivas.length > MAX_MARCAS) {
      vivas.sort((a, b) => a[1] - b[1]);
      vencidas.push(
        ...vivas.slice(0, vivas.length - MAX_MARCAS).map(([id]) => id),
      );
    }

    for (const lote of lotesDe(vencidas)) {
      await cliente.hdel(CLAVE_MARCAS, ...lote);
    }

    // Si no quedó ninguna, se borra la clave entera: un hash vacío en Redis
    // sigue ocupando memoria.
    if (entradas.length === vencidas.length) {
      await cliente.del(CLAVE_MARCAS);
    }

    return {
      vencidas: vencidas.length,
      sobrantes: Math.max(0, vivas.length - MAX_MARCAS),
    };
  }
}

/** Parte una lista en lotes para no mandar un comando gigante a Redis. */
function lotesDe(items: string[]): string[][] {
  const lotes: string[][] = [];
  for (let i = 0; i < items.length; i += LOTE_BORRADO) {
    lotes.push(items.slice(i, i + LOTE_BORRADO));
  }
  return lotes;
}
