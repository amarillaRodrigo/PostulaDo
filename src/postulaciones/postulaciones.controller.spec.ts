import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PostulacionesController } from './postulaciones.controller';
import { PrismaService } from '../prisma.service';
import {
  PostulacionesService,
  INTERVALO_POLLING_MS,
} from './postulaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { VerifiedEmailGuard } from '../auth/guards/verified-email.guard';

const mockService = {
  analyze: jest.fn(),
  getJobStatus: jest.fn(),
  findAll: jest.fn(),
};

/**
 * El contrato HTTP del encolado: el status, los headers y el body.
 *
 * Es la parte que el integrador lee: si esto cambia, el cliente cambia.
 */
describe('PostulacionesController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PostulacionesController],
      providers: [
        { provide: PostulacionesService, useValue: mockService },
        { provide: VerifiedEmailGuard, useValue: { canActivate: () => true } },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = { sub: 'user-1' };
          return true;
        },
      })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          if (request.headers.authorization) {
            request.user = { sub: 'user-1' };
          }
          return true;
        },
      })
      .overrideGuard(VerifiedEmailGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /postulaciones/analizar', () => {
    it('responde 202 con el jobId, el perfil y el intervalo de polling', async () => {
      mockService.analyze.mockResolvedValueOnce({
        jobId: '9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
        status: 'queued',
        profileText: 'Mi perfil',
        perfilPorDefecto: false,
        pollAfterMs: INTERVALO_POLLING_MS,
      });

      const respuesta = await request(app.getHttpServer())
        .post('/postulaciones/analizar')
        .send({ url: 'https://example.com/jobs/1' })
        .expect(202);

      expect(respuesta.body).toEqual({
        jobId: '9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
        status: 'queued',
        profileText: 'Mi perfil',
        perfilPorDefecto: false,
        pollAfterMs: INTERVALO_POLLING_MS,
      });

      // Dónde preguntar: el `Location`.
      expect(respuesta.headers['location']).toBe(
        '/postulaciones/analizar/status/9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
      );

      // Y NO un `Retry-After`: ese header significa "reintentá esta request",
      // y acá la request ya fue aceptada. Un cliente genérico que reintenta
      // lo mismo en cada `Retry-After` duplicaría jobs.
      expect(respuesta.headers['retry-after']).toBeUndefined();
      expect(mockService.analyze).toHaveBeenCalledWith(
        'https://example.com/jobs/1',
        undefined,
      );
    });

    it('pasa el usuario autenticado y la URL al servicio', async () => {
      mockService.analyze.mockResolvedValueOnce({
        jobId: 'job-id',
        status: 'queued',
        profileText: 'Mi perfil',
        perfilPorDefecto: false,
        pollAfterMs: INTERVALO_POLLING_MS,
      });

      await request(app.getHttpServer())
        .post('/postulaciones/analizar')
        .set('Authorization', 'Bearer test-token')
        .send({ url: 'https://example.com/jobs/1' })
        .expect(202);

      expect(mockService.analyze).toHaveBeenCalledWith(
        'https://example.com/jobs/1',
        'user-1',
      );
    });
  });

  describe('GET /postulaciones', () => {
    it('responde con el array, el total y el cursor en los headers', async () => {
      mockService.findAll.mockResolvedValueOnce({
        items: [{ id: 'a' }, { id: 'b' }],
        total: 347,
        nextCursor: '2026-11-18T12:00:00.000Z|b',
      });

      const respuesta = await request(app.getHttpServer())
        .get('/postulaciones')
        .expect(200);

      // El body sigue siendo un array pelado: no se rompe el contrato.
      expect(Array.isArray(respuesta.body)).toBe(true);
      expect(respuesta.body).toHaveLength(2);

      // Y el total va en el header, que es lo que le dice al cliente
      // cuántas páginas hay.
      expect(respuesta.headers['x-total-count']).toBe('347');
      expect(respuesta.headers['x-next-cursor']).toBe(
        '2026-11-18T12:00:00.000Z|b',
      );
      expect(mockService.findAll).toHaveBeenCalledWith('user-1', {});
    });

    it('declara que la respuesta no se cachea', async () => {
      mockService.findAll.mockResolvedValueOnce({
        items: [],
        total: 0,
        nextCursor: null,
      });

      const respuesta = await request(app.getHttpServer())
        .get('/postulaciones')
        .expect(200);

      expect(respuesta.headers['cache-control']).toBe('private, no-store');
      // Sin cursor no hay página siguiente: el header no se manda.
      expect(respuesta.headers['x-next-cursor']).toBeUndefined();
    });
  });

  describe('GET /postulaciones/analizar/status/:jobId', () => {
    it('devuelve el estado del trabajo', async () => {
      mockService.getJobStatus.mockResolvedValueOnce({
        jobId: '42',
        status: 'completed',
        result: { url: 'https://example.com/jobs/1' },
      });

      const respuesta = await request(app.getHttpServer())
        .get('/postulaciones/analizar/status/42')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(respuesta.body.status).toBe('completed');
      expect(respuesta.headers['cache-control']).toBe('private, no-store');
      expect(mockService.getJobStatus).toHaveBeenCalledWith('user-1', '42');
    });

    it('usa el jobId como capacidad para consultar un preview anónimo', async () => {
      mockService.getJobStatus.mockResolvedValueOnce({ status: 'completed' });

      await request(app.getHttpServer())
        .get('/postulaciones/analizar/status/preview-42')
        .expect(200);

      expect(mockService.getJobStatus).toHaveBeenCalledWith(
        'anon:preview-42',
        'preview-42',
      );
    });
  });
});
