import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { ColaLlenaException } from '../exceptions/cola-llena.exception';
import { ReglaDeNegocioException } from '../exceptions/regla-de-negocio.exception';

/**
 * El cuerpo de error de toda la API, en un solo lugar.
 *
 * Nest ya devuelve un error cuando algo falla, pero ese error cuenta el
 * *status*, no el *significado*. Un 422 es dos cosas distintas ("el mail no
 * tiene forma de mail" y "el lote apunta a ofertas ajenas") y el frontend
 * necesita distinguirlas sin mirar el texto del mensaje. Un 503 es otras dos
 * ("la cola está llena" y "Redis no responde"), y la diferencia no es
 * cosmética: una se reintenta con plazo y la otra no. Por eso cada respuesta
 * lleva un `code` estable, además del status.
 *
 * El `correlationId` es la otra mitad: el cliente ve un 500 genérico y no
 * puede hacer nada con él, pero puede reportarlo. Con el id en el header y en
 * el body, el reporte se cruza con la línea del log que sí tiene el stack. Si
 * el pedido ya traía `x-correlation-id` (un proxy, un gateway), se reusa: el
 * id tiene que ser el mismo en toda la cadena.
 *
 * **Un solo filtro, no dos.** Un filtro para el envelope y otro para el
 * `Retry-After` parecen separados, pero no lo son: Nest elige *el primero
 * cuyo `@Catch` matchea*, no el más específico. Un `@Catch(HttpException)`
 * para el header se come los 404, 409, 422 y 503 antes de que el filtro del
 * envelope los vea, y el envelope nunca se aplica. El 503 es un solo
 * response: el body y el header salen del mismo lugar.
 *
 * El `Retry-After` va acá por lo mismo que el `code`: decide la excepción
 * (`ColaLlenaException.retryAfterSeconds`), no el status. Un 503 genérico
 * ("Redis no responde") no lleva header, porque el cliente no sabe cuándo va
 * a volver y lo reintenta con su propio backoff. Si el header se pusiera por
 * status, todos los 503 prometerían un plazo que nadie calculó.
 *
 * **Lo que no sale.** El mensaje de un error inesperado puede tener la IP de
 * la base, la ruta del archivo o la query que falló. Nada de eso le sirve al
 * cliente, que no puede hacer nada con esa información, y sí le sirve a
 * alguien buscando un mapa de la infraestructura. El detalle se loguea con el
 * `correlationId` y al cliente le llega "Error interno".
 */
@Catch()
export class ApiExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  /** El `code` de cada status que la API emite (ver `swagger.config.ts`). */
  private static readonly CODIGOS: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'pedido_invalido',
    [HttpStatus.UNAUTHORIZED]: 'no_autenticado',
    [HttpStatus.FORBIDDEN]: 'prohibido',
    [HttpStatus.NOT_FOUND]: 'no_encontrado',
    [HttpStatus.CONFLICT]: 'conflicto',
    [HttpStatus.GONE]: 'ya_no_existe',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'validacion',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'error_interno',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'servicio_no_disponible',
  };

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const traduccion = this.traducir(exception);
    const correlationId = this.correlationId(req);

    // El header va primero: si `json()` falla, el cliente todavía tiene el id
    // para reportar el fallo del propio reporte.
    res.setHeader('x-correlation-id', correlationId);

    if (exception instanceof ColaLlenaException) {
      res.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }

    if (traduccion.interno) {
      this.logger.error(
        `[${correlationId}] ${this.mensajeInterno(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(traduccion.status).json({
      statusCode: traduccion.status,
      code: traduccion.code,
      message: traduccion.message,
      ...(traduccion.details ? { details: traduccion.details } : {}),
      correlationId,
    });
  }

  /**
   * Traduce la excepción al contrato. El orden de los `instanceof` importa:
   * `ColaLlenaException` y `ReglaDeNegocioException` son `HttpException`, y
   * tienen que ganarle al caso genérico para conservar su `code`.
   */
  private traducir(exception: unknown): Traduccion {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.desdePrisma(exception);
    }

    if (exception instanceof ColaLlenaException) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'cola_llena',
        message: this.mensajeDe(exception),
        interno: false,
      };
    }

    if (exception instanceof ReglaDeNegocioException) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'regla_de_negocio',
        message: this.mensajeDe(exception),
        interno: false,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: ApiExceptionFilter.CODIGOS[status] ?? `error_${status}`,
        message: this.mensajeDe(exception),
        interno: false,
      };
    }

    // Cualquier otra cosa (un `throw` de una librería, un bug nuestro) es un
    // 500: no hay contrato que preservar, y el mensaje original se queda en
    // el log.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'error_interno',
      message: 'Error interno',
      interno: true,
    };
  }

  private desdePrisma(
    exception: Prisma.PrismaClientKnownRequestError,
  ): Traduccion {
    // P2002: choque contra un índice único. El status es 409 y no 422 porque
    // el pedido está bien: choca con el estado actual del mundo (ese correo
    // ya está registrado), que es lo que un 409 significa.
    if (exception.code === 'P2002') {
      return {
        status: HttpStatus.CONFLICT,
        code: 'conflicto',
        message: 'Ese dato ya está registrado.',
        // El campo es lo único que el cliente puede corregir. El resto del
        // mensaje de Prisma (el nombre del índice, la tabla) no sale.
        details: { campos: this.camposDe(exception) },
        interno: false,
      };
    }

    // P2025: la fila que se quiso leer, actualizar o borrar no existe.
    if (exception.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'no_encontrado',
        message: 'El registro no existe.',
        interno: false,
      };
    }

    // Un código de Prisma que no sabemos traducir es un error nuestro, no
    // del cliente.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'error_interno',
      message: 'Error interno',
      interno: true,
    };
  }

  /**
   * `meta.target` viene como `['email']` o como `'Usuario_email_key'` según
   * la versión y el caso. Lo que el cliente necesita es el campo; si no se
   * puede aislar, no se inventa: `campos` queda vacío.
   */
  private camposDe(exception: Prisma.PrismaClientKnownRequestError): string[] {
    const target = (exception.meta as { target?: unknown } | undefined)?.target;

    if (Array.isArray(target)) return target.map(String);
    if (typeof target === 'string') return [target];

    return [];
  }

  /**
   * El mensaje de una `HttpException` puede ser un string (las nuestras) o un
   * array (el `ValidationPipe`, un mensaje por campo). Los dos son parte del
   * contrato: el frontend muestra uno o todos.
   */
  private mensajeDe(exception: HttpException): string | string[] {
    const respuesta = exception.getResponse();

    if (typeof respuesta === 'string') return respuesta;

    if (respuesta && typeof respuesta === 'object' && 'message' in respuesta) {
      const mensaje = (respuesta as { message?: unknown }).message;
      if (typeof mensaje === 'string' || Array.isArray(mensaje)) {
        return mensaje;
      }
    }

    return exception.message;
  }

  private mensajeInterno(exception: unknown): string {
    if (exception instanceof Error) return exception.message;
    return String(exception);
  }

  private correlationId(req: Request): string {
    const entrante = req?.headers?.['x-correlation-id'];
    const valor = Array.isArray(entrante) ? entrante[0] : entrante;

    return typeof valor === 'string' && valor.trim() !== ''
      ? valor
      : randomUUID();
  }
}

interface DetallesDeError {
  campos?: string[];
}

interface Traduccion {
  status: number;
  code: string;
  message: string | string[];
  details?: DetallesDeError;
  /** ¿Hay que loguear el original? Solo cuando el cliente recibe un genérico. */
  interno: boolean;
}
