import { Test, TestingModule } from '@nestjs/testing';
import {
  PostulacionesService,
  PERFIL_POR_DEFECTO,
  INTERVALO_POLLING_MS,
} from './postulaciones.service';
import { PrismaService } from '../prisma.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { getQueueToken } from '@nestjs/bullmq';
import {
  NotFoundException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { ColaMantenimientoService } from './cola-mantenimiento.service';
import { MarcaTrabajoService } from './marca-trabajo.service';
import { ReglaDeNegocioException } from '../common/exceptions/regla-de-negocio.exception';
import { ColaLlenaException } from '../common/exceptions/cola-llena.exception';

const mockPrisma = {
  postulacion: {
    create: jest
      .fn()
      .mockImplementation((args) =>
        Promise.resolve({ id: 'postulacion-id', ...args.data }),
      ),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  // El service usa `$transaction` para que el total y la página vean la
  // misma foto de la base.
  $transaction: jest
    .fn()
    .mockImplementation((operaciones: unknown[]) =>
      Promise.all(operaciones as Promise<unknown>[]),
    ),
};

const mockJobAnalyzer = {
  analyzeJob: jest.fn(),
};

const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
};

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  // El cliente de Redis: lo usa el servicio de marcas.
  client: Promise.resolve(mockRedis),
};

const mockMantenimiento = {
  asegurarEspacio: jest.fn(),
};

const mockMarcas = {
  marcar: jest.fn(),
  buscar: jest.fn().mockResolvedValue(null),
  recortar: jest.fn().mockResolvedValue({ vencidas: 0, sobrantes: 0 }),
};

describe('PostulacionesService', () => {
  let service: PostulacionesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostulacionesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JobAnalyzerService, useValue: mockJobAnalyzer },
        { provide: ColaMantenimientoService, useValue: mockMantenimiento },
        { provide: MarcaTrabajoService, useValue: mockMarcas },
        { provide: getQueueToken('analisis-trabajo'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<PostulacionesService>(PostulacionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should extract technologies and create a new application', async () => {
      const dto = {
        url: 'https://example.com/jobs/1',
        title: 'Full Stack NestJS Developer',
        description:
          'We need a programmer with React, TypeScript, and Docker skills.',
      };
      const userId = 'user-uuid';

      await service.create(dto, userId);

      expect(mockPrisma.postulacion.create).toHaveBeenCalledWith({
        data: {
          url: dto.url,
          title: dto.title,
          description: dto.description,
          company: undefined,
          rawRequirements: ['TypeScript', 'NestJS', 'React', 'Docker'],
          tecnologias: ['TypeScript', 'NestJS', 'React', 'Docker'],
          aniosExperiencia: undefined,
          responsabilidades: [],
          tonoEmpresa: undefined,
          user: { connect: { id: userId } },
        },
      });
    });
  });

  describe('getLearningAnalysis', () => {
    it('should return learning suggestions based on applications', async () => {
      const userId = 'user-uuid';
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { rawRequirements: ['React', 'NestJS'] },
        { rawRequirements: ['React', 'Docker'] },
        { rawRequirements: ['React', 'NestJS'] },
      ]);

      const result = await service.getLearningAnalysis(userId);

      expect(result.totalApplicationsAnalizadas).toBe(3);
      expect(result.tecnologiasMasDemandadas[0]).toEqual({
        name: 'React',
        count: 3,
        percentage: 100,
      });
      expect(result.sugerenciaAprendizaje).toContain('React');
    });
  });

  describe('findAll', () => {
    const userId = 'user-uuid';

    it('devuelve la página, el total y el cursor de la página siguiente', async () => {
      const fila = { id: 'a', createdAt: new Date('2026-11-18T12:00:00.000Z') };
      const siguiente = {
        id: 'b',
        createdAt: new Date('2026-11-18T11:00:00.000Z'),
      };
      // Con limit 1 se piden 2 filas: la segunda es la señal de que hay otra
      // página, y no se devuelve.
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([fila, siguiente]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(347);

      const resultado = await service.findAll(userId, { limit: 1 });

      expect(resultado.total).toBe(347);
      expect(resultado.items).toEqual([fila]);
      expect(resultado.nextCursor).toBe('2026-11-18T12:00:00.000Z|a');
    });

    it('no da cursor cuando la página es la última', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { id: 'a', createdAt: new Date('2026-11-18T12:00:00.000Z') },
      ]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(1);

      const resultado = await service.findAll(userId, { limit: 10 });

      expect(resultado.nextCursor).toBeNull();
    });

    it('el total cuenta el filtro, no la página', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(0);

      await service.findAll(userId, { status: 'ENVIADO' } as any);

      const where = mockPrisma.postulacion.findMany.mock.calls[0][0].where;
      expect(mockPrisma.postulacion.count).toHaveBeenCalledWith({ where });
      expect(where).toEqual({ userId, status: 'ENVIADO' });
    });

    it('el listado no pide el texto de la oferta', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(0);

      await service.findAll(userId, {});

      const select = mockPrisma.postulacion.findMany.mock.calls[0][0].select;
      expect(select).toBeDefined();
      expect(select).not.toHaveProperty('description');
      expect(select).not.toHaveProperty('rawRequirements');
      expect(select).toHaveProperty('id');
    });

    it('el count y la página ven la misma foto de la base', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(0);

      await service.findAll(userId, {});

      // `READ COMMITTED` (el default de Postgres) ve un snapshot distinto en
      // cada query: el total podría no coincidir con la página.
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
        isolationLevel: 'RepeatableRead',
      });
    });

    it('aplica la paginación por página', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(0);

      await service.findAll(userId, { page: 3, limit: 25 });

      expect(mockPrisma.postulacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 26, skip: 50 }),
      );
    });

    it('el orden es determinista: createdAt desc, id desc', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(0);

      await service.findAll(userId, {});

      expect(mockPrisma.postulacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('con cursor se piden las filas que están después de la última', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);
      mockPrisma.postulacion.count.mockResolvedValueOnce(0);

      await service.findAll(userId, {
        cursor: '2026-11-18T12:00:00.000Z|job-1',
      });

      const llamada = mockPrisma.postulacion.findMany.mock.calls[0][0];

      // El cursor se implementa con un filtro en el `where`: la fila del
      // cursor ya está excluida, así que NO se saltea nada (con `skip: 1` se
      // perdía una fila real de cada página).
      expect(llamada.skip).toBe(0);
      expect(llamada.where.OR).toEqual([
        { createdAt: { lt: new Date('2026-11-18T12:00:00.000Z') } },
        {
          createdAt: new Date('2026-11-18T12:00:00.000Z'),
          id: { lt: 'job-1' },
        },
      ]);

      // El total sigue contando el filtro, no la posición.
      expect(mockPrisma.postulacion.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('un cursor roto es un 422', async () => {
      await expect(
        service.findAll(userId, { cursor: 'no-es-un-cursor' }),
      ).rejects.toThrow(ReglaDeNegocioException);
    });
  });

  describe('analisisDeLote', () => {
    const userId = 'user-uuid';

    it('concuerda en singular cuando un solo tema domina el lote', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { id: 'a', tecnologias: ['NestJS', 'TypeScript'] },
        { id: 'b', tecnologias: ['Spring Boot', 'Java'] },
      ]);

      const result = await service.analisisDeLote(userId, ['a', 'b']);

      expect(result.sugerenciaAprendizaje).toContain('Este tema cubre el 100%');
      expect(result.sugerenciaAprendizaje).not.toContain('Estos 1');
    });

    it('arma el mismo roadmap en preview sin consultar la base', () => {
      const preview = service.previewDeTecnologias([
        ['NestJS', 'TypeScript'],
        ['NestJS', 'Docker'],
      ]);

      expect(preview.analisis.totalOfertasAnalizadas).toBe(2);
      expect(preview.analisis.temas.length).toBeGreaterThan(0);
      expect(preview.ruta.totalOfertasAnalizadas).toBe(2);
      expect(mockPrisma.postulacion.findMany).not.toHaveBeenCalled();
    });

    it('concuerda en plural cuando son varios temas', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { id: 'a', tecnologias: ['NestJS', 'Docker', 'PostgreSQL'] },
        { id: 'b', tecnologias: ['Spring Boot', 'Docker', 'PostgreSQL'] },
      ]);

      const result = await service.analisisDeLote(userId, ['a', 'b']);

      expect(result.sugerenciaAprendizaje).toContain('Estos 3 temas cubren');
    });
  });

  describe('analyze', () => {
    it('encola el trabajo con un id propio y devuelve el contrato', async () => {
      const url = 'https://example.com/jobs/1';
      const userId = 'user-uuid';
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        profileText: 'My Profile',
      });
      mockQueue.add.mockResolvedValueOnce({ id: 'job-id' });

      const result = await service.analyze(url, userId);

      // El id lo elegimos nosotros: un UUID, no el `INCR` de BullMQ, que
      // sería enumerable.
      const opciones = mockQueue.add.mock.calls[0][2] as {
        jobId: string;
        removeOnComplete: unknown;
        removeOnFail: unknown;
      };
      expect(opciones.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'analizar-url',
        { url, userId, profileText: 'My Profile' },
        expect.objectContaining({
          removeOnComplete: { age: 30, count: 200 },
          removeOnFail: { age: 30, count: 100 },
        }),
      );

      expect(mockMantenimiento.asegurarEspacio).toHaveBeenCalled();
      expect(result).toEqual({
        jobId: opciones.jobId,
        status: 'queued',
        profileText: 'My Profile',
        perfilPorDefecto: false,
        // El intervalo de polling va en el body, no en un `Retry-After`.
        pollAfterMs: INTERVALO_POLLING_MS,
      });
    });

    it('permite un análisis anónimo con perfil genérico y dueño opaco del job', async () => {
      mockQueue.add.mockResolvedValueOnce({ id: 'guest-job' });

      const result = await service.analyze('https://example.com/jobs/1');

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'analizar-url',
        {
          url: 'https://example.com/jobs/1',
          userId: undefined,
          profileText: PERFIL_POR_DEFECTO,
        },
        expect.any(Object),
      );
      expect(mockMarcas.marcar).toHaveBeenCalledWith(
        result.jobId,
        `anon:${result.jobId}`,
      );
      expect(result.perfilPorDefecto).toBe(true);
    });

    it('avisa que usó el perfil por defecto cuando el usuario no tiene', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ profileText: null });
      mockQueue.add.mockResolvedValueOnce({ id: 'job-id' });

      const result = await service.analyze(
        'https://example.com/jobs/1',
        'user-uuid',
      );

      expect(result.perfilPorDefecto).toBe(true);
      expect(result.profileText).toBe(PERFIL_POR_DEFECTO);
    });

    it('deja la marca del trabajo para poder distinguir expirado de inexistente', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        profileText: 'My Profile',
      });
      mockQueue.add.mockResolvedValueOnce({ id: 'job-id' });

      const result = await service.analyze(
        'https://example.com/jobs/1',
        'user-uuid',
      );

      expect(mockMarcas.marcar).toHaveBeenCalledWith(result.jobId, 'user-uuid');
    });

    it('no encola si la cola está llena', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ profileText: 'x' });
      mockMantenimiento.asegurarEspacio.mockRejectedValueOnce(
        new ColaLlenaException(),
      );

      // La cola llena es un 503 con `Retry-After`: es transitorio y el
      // cliente puede reintentar.
      await expect(
        service.analyze('https://example.com/jobs/1', 'user-uuid'),
      ).rejects.toBeInstanceOf(ColaLlenaException);

      // Y lo importante: el trabajo no se encola.
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getJobStatus', () => {
    const userId = 'user-uuid';
    const jobId = 'job-id';

    it('devuelve 404 si el trabajo nunca existió', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);
      mockMarcas.buscar.mockResolvedValueOnce(null);

      await expect(service.getJobStatus(userId, jobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve 410 cuando el trabajo existió pero ya se purgó', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);
      mockMarcas.buscar.mockResolvedValueOnce({
        userId,
        vigente: true,
      });

      await expect(service.getJobStatus(userId, jobId)).rejects.toThrow(
        GoneException,
      );
    });

    it('devuelve 403 si el trabajo purgado era de otro usuario', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);
      mockMarcas.buscar.mockResolvedValueOnce({
        userId: 'other-user-uuid',
        vigente: true,
      });

      await expect(service.getJobStatus(userId, jobId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('permite al dueño anónimo consultar su job vivo por su UUID', async () => {
      mockQueue.getJob.mockResolvedValueOnce({
        id: 'guest-job',
        data: { userId: undefined },
        getState: jest.fn().mockResolvedValueOnce('waiting'),
      });

      await expect(
        service.getJobStatus('anon:guest-job', 'guest-job'),
      ).resolves.toEqual({ jobId: 'guest-job', status: 'waiting' });
    });

    it('devuelve 403 si el trabajo vivo es de otro usuario', async () => {
      const mockJob = {
        data: { userId: 'other-user-uuid' },
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      await expect(service.getJobStatus(userId, jobId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('distingue el trabajo ajeno del inexistente', async () => {
      // Con UUID no hay nada que enumerar, así que el 403 no filtra la
      // existencia de nada y el cliente recibe un mensaje útil.
      mockQueue.getJob.mockResolvedValueOnce({
        data: { userId: 'other-user-uuid' },
      });
      const ajeno = await service
        .getJobStatus(userId, jobId)
        .catch((e: Error & { status: number }) => e);

      mockQueue.getJob.mockResolvedValueOnce(null);
      mockMarcas.buscar.mockResolvedValueOnce(null);
      const inexistente = await service
        .getJobStatus(userId, jobId)
        .catch((e: Error & { status: number }) => e);

      expect((ajeno as { status: number }).status).toBe(403);
      expect((inexistente as { status: number }).status).toBe(404);
    });

    it('should return completed status and result if job is completed', async () => {
      const mockJob = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('completed'),
        returnvalue: { url: 'https://example.com', datosOferta: {} },
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toEqual({
        jobId,
        status: 'completed',
        result: mockJob.returnvalue,
      });
    });

    it('should return failed status and error if job failed', async () => {
      const mockJob = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('failed'),
        failedReason: 'SGLang Timeout Error',
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toEqual({
        jobId,
        status: 'failed',
        error: 'SGLang Timeout Error',
      });
    });

    it('relee el resultado cuando el trabajo completó sin valor', async () => {
      const incompleto = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('completed'),
        returnvalue: null,
      };
      const completo = {
        returnvalue: { datosOferta: { tecnologias: ['Go'] } },
      };
      mockQueue.getJob
        .mockResolvedValueOnce(incompleto)
        .mockResolvedValueOnce(completo);

      const result = await service.getJobStatus(userId, jobId);

      expect(mockQueue.getJob).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        jobId,
        status: 'completed',
        result: completo.returnvalue,
      });
    });

    it('marca como fallido el trabajo que quedó sin resultado', async () => {
      const incompleto = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('completed'),
        returnvalue: null,
      };
      mockQueue.getJob
        .mockResolvedValueOnce(incompleto)
        .mockResolvedValueOnce(incompleto);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toMatchObject({
        jobId,
        status: 'failed',
        error: expect.stringContaining('sin resultado'),
      });
      expect(result).not.toHaveProperty('result');
    });

    it('should return state status for active/waiting jobs', async () => {
      const mockJob = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('active'),
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toEqual({
        jobId,
        status: 'active',
      });
    });
  });
});
