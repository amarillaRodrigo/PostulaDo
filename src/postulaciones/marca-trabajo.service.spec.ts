import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MarcaTrabajoService, MAX_MARCAS } from './marca-trabajo.service';

const mockRedis = {
  hset: jest.fn().mockResolvedValue(1),
  hget: jest.fn().mockResolvedValue(null),
  hgetall: jest.fn().mockResolvedValue({}),
  hdel: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
};

const mockQueue = {
  client: Promise.resolve(mockRedis),
};

describe('MarcaTrabajoService', () => {
  let service: MarcaTrabajoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.hgetall.mockResolvedValue({});
    mockRedis.hget.mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [
        MarcaTrabajoService,
        { provide: getQueueToken('analisis-trabajo'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<MarcaTrabajoService>(MarcaTrabajoService);
  });

  it('guarda el dueño y la vigencia en un hash, no en una clave por trabajo', async () => {
    await service.marcar('job-1', 'user-1');

    // Una sola clave para todas las marcas: el overhead por entrada es el
    // de un campo de hash y el conjunto se puede recortar entero.
    expect(mockRedis.hset).toHaveBeenCalledWith(
      'postulado:analisis:vistos',
      expect.objectContaining({ 'job-1': expect.stringContaining('user-1') }),
    );
  });

  it('devuelve el dueño y si la ventana sigue abierta', async () => {
    const vence = Date.now() + 60_000;
    mockRedis.hget.mockResolvedValueOnce(`user-1|${vence}`);

    const marca = await service.buscar('job-1');

    expect(marca).toEqual({ userId: 'user-1', vigente: true });
  });

  it('marca como no vigente una ventana vencida', async () => {
    mockRedis.hget.mockResolvedValueOnce(`user-1|${Date.now() - 1000}`);

    const marca = await service.buscar('job-1');

    expect(marca).toEqual({ userId: 'user-1', vigente: false });
  });

  it('devuelve null si el trabajo nunca existió', async () => {
    mockRedis.hget.mockResolvedValueOnce(null);

    expect(await service.buscar('job-1')).toBeNull();
  });

  it('borra las marcas vencidas', async () => {
    mockRedis.hgetall.mockResolvedValueOnce({
      'job-viejo': `user-1|${Date.now() - 1000}`,
      'job-nuevo': `user-1|${Date.now() + 60_000}`,
    });

    const resultado = await service.recortar();

    expect(resultado.vencidas).toBe(1);
    expect(mockRedis.hdel).toHaveBeenCalledWith(
      'postulado:analisis:vistos',
      'job-viejo',
    );
  });

  it('respeta el tope de marcas: borra las más viejas', async () => {
    // MAX_MARCAS + 10 marcas, todas vigentes: las 10 más viejas sobran.
    const ahora = Date.now();
    const marcas: Record<string, string> = {};
    for (let i = 0; i < MAX_MARCAS + 10; i += 1) {
      marcas[`job-${i}`] = `user-1|${ahora + (i + 1) * 1000}`;
    }
    mockRedis.hgetall.mockResolvedValueOnce(marcas);

    const resultado = await service.recortar();

    expect(resultado.sobrantes).toBe(10);
    // Se borran las de menor vigencia: las más viejas.
    const borradas = mockRedis.hdel.mock.calls.map((c) => c.slice(1)).flat();
    expect(borradas).toContain('job-0');
    expect(borradas).toContain('job-9');
    expect(borradas).not.toContain(`job-${MAX_MARCAS + 9}`);
  });

  it('borra la clave entera cuando no queda ninguna marca', async () => {
    mockRedis.hgetall.mockResolvedValueOnce({
      'job-viejo': `user-1|${Date.now() - 1000}`,
    });

    await service.recortar();

    expect(mockRedis.del).toHaveBeenCalledWith('postulado:analisis:vistos');
  });
});
