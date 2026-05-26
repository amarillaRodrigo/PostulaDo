import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function stripPassword(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(stripPassword);
  if (typeof obj === 'object') {
    const copy: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'password') continue;
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
