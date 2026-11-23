import { DocumentBuilder } from '@nestjs/swagger';
import { ErrorResponseDto } from './dto/error-response.dto';

/**
 * Configuración del OpenAPI, compartida entre `main.ts` (Swagger en vivo) y
 * `scripts/generate-swagger.ts` (el `docs/openapi.json` que se versiona).
 *
 * Que sea un solo archivo evita que los dos se separen: si el contrato de
 * error cambia en uno y no en el otro, la doc miente.
 */
export function swaggerConfig() {
  return (
    new DocumentBuilder()
      .setTitle('Postulado API')
      .setDescription('API para la gestión de usuarios y postulaciones')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      // El contrato de error de la API, en un solo lugar.
      //
      // La línea que separa un código de otro es qué capa lo emite:
      //
      //   400  el pedido no se pudo parsear. Lo detecta el body-parser de
      //        Express antes de que la app lo vea (JSON roto, percent-encoding
      //        inválido). No es un `throw` de la app: no hay ningún
      //        `BadRequestException` en el código.
      //   401  no sabemos quién sos. Credenciales inválidas, access token
      //        vencido, refresh token revocado.
      //   403  sabemos quién sos pero no tenés acceso a ese recurso.
      //   404  el registro no existe.
      //   409  el pedido es válido pero choca con el estado actual (ese correo
      //        ya está registrado).
      //   410  algo existió y ya no (el enlace de verificación venció o se
      //        usó; el trabajo de análisis se purgó de la cola).
      //   422  el pedido se entendió y está bien formado, pero su contenido no
      //        cumple las reglas: el mail no tiene forma de mail, el lote
      //        apunta a ofertas ajenas, la contraseña de confirmación no
      //        coincide.
      //   503  una dependencia no está disponible ahora. Es transitorio y se
      //        reintenta con backoff. El `Retry-After` solo aparece cuando el
      //        motivo es la cola de análisis: el plazo lo trae la excepción
      //        (`ColaLlenaException`), no el status, porque un 503 genérico
      //        ("Redis no responde") no se reintenta igual.
      .addGlobalResponse(
        {
          status: 400,
          description:
            'El pedido no se pudo parsear: el body no es JSON válido. Lo emite el body-parser, antes de que la app lo vea.',
          type: ErrorResponseDto,
        },
        {
          status: 401,
          description:
            'No sabemos quién sos: credenciales inválidas o token vencido/revocado.',
          type: ErrorResponseDto,
        },
        {
          status: 403,
          description: 'Sabemos quién sos pero no tenés acceso a ese recurso.',
          type: ErrorResponseDto,
        },
        {
          status: 404,
          description: 'El registro no existe.',
          type: ErrorResponseDto,
        },
        {
          status: 409,
          description:
            'El pedido es válido pero choca con el estado actual del mundo.',
          type: ErrorResponseDto,
        },
        {
          status: 410,
          description:
            'Algo existió y ya no: el enlace de verificación o de recuperación venció o se usó; el trabajo de análisis se purgó de la cola.',
          type: ErrorResponseDto,
        },
        {
          status: 422,
          description:
            'El pedido se entendió y está bien formado, pero su contenido no cumple las reglas del dominio.',
          type: ErrorResponseDto,
        },
        {
          status: 503,
          description:
            'Una dependencia que este endpoint necesita no está disponible ahora. Es transitorio: reintentá con backoff. En `POST /postulaciones/analizar` es la cola de análisis: cuando Redis se acerca al tope de memoria del plan, la API deja de encolar. Ese caso puntual trae el header `Retry-After` con cada cuántos segundos reintentar.',
          type: ErrorResponseDto,
        },
      )
      .build()
  );
}
