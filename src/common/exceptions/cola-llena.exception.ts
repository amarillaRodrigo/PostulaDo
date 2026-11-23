import { ServiceUnavailableException } from '@nestjs/common';

/**
 * La cola de trabajos asíncronos está llena: el pedido está bien, pero ahora
 * no hay lugar para encolarlo.
 *
 * Es un 503 con un significado exacto, y por eso es una excepción y no un
 * status. Un 503 cualquiera puede ser "Redis no responde" o "la base no
 * está": reintentan igual, pero el motivo y el plazo son distintos. Este
 * `retryAfterSeconds` dice cuánto esperar, y el filtro lo traduce al header
 * `Retry-After`.
 *
 * El plazo es un valor elegido, no una medición: `asegurarEspacio()` no sabe
 * cuándo va a haber lugar, sabe que hay que limpiar antes de volver a
 * medir. Por eso el número es una sugerencia operativa — corta para no
 * hacer esperar a la persona, larga para no sumar presión a una cola ya
 * saturada — y no una promesa. Si algún día se quiere un plazo real, sale de
 * medir cuánto tarda la cola en vaciarse; hasta entonces, es un número
 * elegido a propósito.
 */
export class ColaLlenaException extends ServiceUnavailableException {
  readonly retryAfterSeconds: number;

  constructor(
    message = 'La cola de análisis está llena en este momento. Probá de nuevo en unos minutos.',
    retryAfterSeconds = 30,
  ) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
