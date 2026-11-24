import { ColaLlenaException } from '../common/exceptions/cola-llena.exception';

import {
  ColaMantenimientoService,
  limitePorEntorno,
  parsearMemoria,
} from './cola-mantenimiento.service';
import { MarcaTrabajoService } from './marca-trabajo.service';

const MB = 1024 * 1024;

const infoDe = (usadaMb: number, limiteMb = 30) =>
  [
    '# Memory',
    `used_memory:${Math.round(usadaMb * MB)}`,
    'used_memory_human:1.00M',
    `maxmemory:${Math.round(limiteMb * MB)}`,
    'maxmemory_policy:noeviction',
  ].join('\r\n');

const crearCola = (info: jest.Mock) => ({
  clean: jest.fn().mockResolvedValue([]),
  client: Promise.resolve({ info }),
});

/** El recorte de marcas no es lo que estos tests miden. */
const marcasFalsas = {
  marcar: jest.fn(),
  buscar: jest.fn(),
  recortar: jest.fn().mockResolvedValue({ vencidas: 0, sobrantes: 0 }),
} as unknown as MarcaTrabajoService;

describe('parsearMemoria', () => {
  it('lee used_memory y maxmemory del INFO', () => {
    expect(parsearMemoria(infoDe(12), 30 * MB)).toEqual({
      usada: 12 * MB,
      limite: 30 * MB,
    });
  });

  it('usa el límite por defecto cuando maxmemory viene en cero', () => {
    const memoria = parsearMemoria('used_memory:1048576\nmaxmemory:0', 30 * MB);

    expect(memoria).toEqual({ usada: MB, limite: 30 * MB });
  });

  it('cae a 30 MB si el entorno no define el límite', () => {
    delete process.env.REDIS_MEMORY_LIMIT_MB;
    expect(limitePorEntorno()).toBe(30 * MB);
  });

  it('respeta REDIS_MEMORY_LIMIT_MB', () => {
    process.env.REDIS_MEMORY_LIMIT_MB = '64';
    expect(limitePorEntorno()).toBe(64 * MB);
    delete process.env.REDIS_MEMORY_LIMIT_MB;
  });
});

describe('ColaMantenimientoService', () => {
  it('no limpia cuando Redis está holgado', async () => {
    const info = jest.fn().mockResolvedValue(infoDe(5));
    const queue = crearCola(info);
    const service = new ColaMantenimientoService(queue as any, marcasFalsas);

    await service.asegurarEspacio();

    expect(queue.clean).not.toHaveBeenCalled();
  });

  it('limpia lo terminado cuando pasa el 85% y deja seguir', async () => {
    const info = jest
      .fn()
      .mockResolvedValueOnce(infoDe(26)) // 87%: dispara la limpieza
      .mockResolvedValueOnce(infoDe(10)); // después de limpiar
    const queue = crearCola(info);
    const service = new ColaMantenimientoService(queue as any, marcasFalsas);

    await service.asegurarEspacio();

    expect(queue.clean).toHaveBeenCalledWith(
      10 * 60 * 1000,
      expect.any(Number),
      'completed',
    );
    expect(queue.clean).toHaveBeenCalledWith(
      10 * 60 * 1000,
      expect.any(Number),
      'failed',
    );
  });

  it('responde 503 si después de limpiar sigue arriba del 95%', async () => {
    const info = jest
      .fn()
      .mockResolvedValueOnce(infoDe(29))
      .mockResolvedValueOnce(infoDe(29.5));
    const queue = crearCola(info);
    const service = new ColaMantenimientoService(queue as any, marcasFalsas);

    await expect(service.asegurarEspacio()).rejects.toBeInstanceOf(
      ColaLlenaException,
    );
  });

  it('no rompe si no puede leer la memoria', async () => {
    const info = jest.fn().mockRejectedValue(new Error('sin conexión'));
    const queue = crearCola(info);
    const service = new ColaMantenimientoService(queue as any, marcasFalsas);

    await expect(service.asegurarEspacio()).resolves.toBeUndefined();
  });

  it('limpiar borra completados y fallidos con la retención pedida', async () => {
    const info = jest.fn();
    const queue = crearCola(info);
    queue.clean.mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce(['c']);
    const service = new ColaMantenimientoService(queue as any, marcasFalsas);

    const resultado = await service.limpiar();

    expect(resultado).toEqual({ completados: 2, fallidos: 1 });
    expect(queue.clean).toHaveBeenNthCalledWith(
      1,
      24 * 3600 * 1000,
      expect.any(Number),
      'completed',
    );
  });
});
