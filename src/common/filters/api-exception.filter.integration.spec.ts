import {
  Controller,
  Get,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiExceptionFilter } from './api-exception.filter';
import { ColaLlenaException } from '../exceptions/cola-llena.exception';

@Controller('prueba')
class ControladorDePrueba {
  @Get('no-existe')
  noExiste() {
    throw new NotFoundException('Lote no encontrado');
  }

  @Get('lleno')
  lleno() {
    throw new ColaLlenaException('La cola de análisis está llena.', 30);
  }

  @Get('otro')
  otro() {
    throw new ServiceUnavailableException('Redis no responde');
  }
}

/**
 * El unitario instancia el filtro a mano: prueba su lógica, no que la app lo
 * use. Este archivo monta una app de verdad con `APP_FILTER` y pregunta por
 * HTTP, que es la única forma de detectar que el filtro quedó mal registrado
 * o que otro filtro se come la excepción antes.
 *
 * Por eso el assert central no es el status: es que el body tenga `code` y no
 * el `error` de Nest. Con `RetryAfterFilter` vivo, un 404 salía con
 * `{ statusCode, message, error }` y sin envelope.
 */
describe('ApiExceptionFilter (registrado en la app)', () => {
  let app: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ControladorDePrueba],
      providers: [
        {
          provide: APP_FILTER,
          useClass: ApiExceptionFilter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('el envelope reemplaza al body de Nest: `code` en vez de `error`', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/prueba/no-existe')
      .expect(404);

    expect(respuesta.body).toMatchObject({
      statusCode: 404,
      code: 'no_encontrado',
      message: 'Lote no encontrado',
      correlationId: expect.any(String),
    });
    // El `error` de Nest es justamente lo que el envelope reemplaza.
    expect(respuesta.body).not.toHaveProperty('error');
  });

  it('la cola llena sale 503 con `Retry-After`', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/prueba/lleno')
      .expect(503);

    expect(respuesta.body).toMatchObject({
      statusCode: 503,
      code: 'cola_llena',
      message: 'La cola de análisis está llena.',
    });
    expect(respuesta.headers['retry-after']).toBe('30');
  });

  it('un 503 que no es la cola llena no lleva `Retry-After`', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/prueba/otro')
      .expect(503);

    expect(respuesta.body).toMatchObject({
      statusCode: 503,
      code: 'servicio_no_disponible',
      message: 'Redis no responde',
    });
    expect(respuesta.headers['retry-after']).toBeUndefined();
  });

  it('el `correlationId` viaja en el header y en el body, y se reusa', async () => {
    const entrante = 'req-trace-1234';

    const respuesta = await request(app.getHttpServer())
      .get('/prueba/no-existe')
      .set('x-correlation-id', entrante)
      .expect(404);

    expect(respuesta.headers['x-correlation-id']).toBe(entrante);
    expect(respuesta.body.correlationId).toBe(entrante);
  });

  it('sin `x-correlation-id` entrante, genera uno igual en header y body', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/prueba/no-existe')
      .expect(404);

    expect(respuesta.headers['x-correlation-id']).toBeDefined();
    expect(respuesta.body.correlationId).toBe(
      respuesta.headers['x-correlation-id'],
    );
  });
});
