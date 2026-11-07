import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Campos que nunca deben salir de la API, aunque un controlador se olvide. */
const CAMPOS_PRIVADOS = new Set([
  'password',
  'emailVerificationToken',
  'emailVerificationExpiresAt',
]);

function esObjetoPlano(obj: object): boolean {
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

/**
 * Copia la respuesta quitando campos privados.
 *
 * Solo reconstruye objetos planos: un `Date` no tiene entradas propias, y
 * recrearlo con `Object.entries` lo convertía en `{}` (todas las fechas de la
 * API salían vacías). Las clases y los buffers se devuelven tal cual.
 */
function stripPassword(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(stripPassword);
  if (obj instanceof Date) return obj;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) return obj;
  if (typeof obj === 'object' && esObjetoPlano(obj)) {
    const copy: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (CAMPOS_PRIVADOS.has(k)) continue;
      copy[k] = stripPassword(v);
    }
    return copy;
  }
  return obj;
}

@Injectable()
export class StripPasswordInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => stripPassword(data)));
  }
}
