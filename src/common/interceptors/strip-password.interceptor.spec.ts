import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { StripPasswordInterceptor } from './strip-password.interceptor';

function ejecutar(data: unknown): Promise<unknown> {
  const interceptor = new StripPasswordInterceptor();
  const next = { handle: () => of(data) } as CallHandler;

  return new Promise((resolve) => {
    interceptor
      .intercept({} as ExecutionContext, next)
      .subscribe((valor) => resolve(valor));
  });
}

describe('StripPasswordInterceptor', () => {
  it('quita la contraseña y el token de verificación', async () => {
    const salida = (await ejecutar({
      id: '1',
      email: 'a@b.com',
      password: 'hash',
      emailVerificationToken: 'hash-del-token',
      emailVerificationExpiresAt: new Date(),
    })) as Record<string, unknown>;

    expect(salida).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('conserva las fechas en vez de convertirlas en {}', async () => {
    const fecha = new Date('2026-11-07T12:00:00.000Z');
    const salida = (await ejecutar({ createdAt: fecha })) as {
      createdAt: Date;
    };

    expect(salida.createdAt).toBeInstanceOf(Date);
    expect(salida.createdAt.toISOString()).toBe('2026-11-07T12:00:00.000Z');
    expect(JSON.stringify(salida)).toBe(
      '{"createdAt":"2026-11-07T12:00:00.000Z"}',
    );
  });

  it('recorre arrays y objetos anidados', async () => {
    const salida = (await ejecutar([
      { id: '1', password: 'x', meta: { password: 'y', ok: true } },
    ])) as Array<Record<string, unknown>>;

    expect(salida).toEqual([{ id: '1', meta: { ok: true } }]);
  });

  it('deja pasar los valores primitivos y null', async () => {
    expect(await ejecutar(null)).toBeNull();
    expect(await ejecutar('texto')).toBe('texto');
    expect(await ejecutar(42)).toBe(42);
  });
});
