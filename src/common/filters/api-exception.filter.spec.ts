import {
  ArgumentsHost,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiExceptionFilter } from './api-exception.filter';
import { ColaLlenaException } from '../exceptions/cola-llena.exception';
import { ReglaDeNegocioException } from '../exceptions/regla-de-negocio.exception';

describe('ApiExceptionFilter', () => {
  // Función auxiliar para simular Express (req y res)
  function hostDePrueba(headers: Record<string, string> = {}) {
    const cabeceras: Record<string, string> = {};
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn((nombre: string, valor: string) => {
        cabeceras[nombre.toLowerCase()] = valor;
      }),
    };
    const req: any = {
      headers,
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => req,
      }),
    } as unknown as ArgumentsHost;

    return { host, res, req, cabeceras };
  }

  // --- CASO 1 ---
  it('traduce una violación de unicidad a 409 y pone el campo en details', () => {
    const { host, res } = hostDePrueba();
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        meta: { modelName: 'User', target: ['email'] },
        clientVersion: '7.10.1',
      },
    );

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'conflicto',
        details: { campos: ['email'] },
        correlationId: expect.any(String),
      }),
    );
    // El mensaje de Prisma dice qué índice falló. Eso no sale hacia el cliente.
    expect(res.json.mock.calls[0][0].message).not.toContain('Unique constraint');
  });

  // --- CASO 2 ---
  it('traduce un P2025 a 404', () => {
    const { host, res } = hostDePrueba();
    const error = new Prisma.PrismaClientKnownRequestError(
      'Record to delete does not exist.',
      {
        code: 'P2025',
        clientVersion: '7.10.1',
      },
    );

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'no_encontrado',
        correlationId: expect.any(String),
      }),
    );
  });

  // --- CASO 3 ---
  it('una cola llena sale 503 con el header Retry-After', () => {
    const { host, res, cabeceras } = hostDePrueba();
    const error = new ColaLlenaException(
      'La cola de análisis está llena en este momento.',
      30,
    );

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'cola_llena',
        message: 'La cola de análisis está llena en este momento.',
        correlationId: expect.any(String),
      }),
    );
    expect(cabeceras['retry-after']).toBe('30');
  });

  // --- CASO 4 ---
  it('un error inesperado sale 500 genérico y no filtra el mensaje interno', () => {
    const { host, res } = hostDePrueba();
    const error = new Error('connect ECONNREFUSED 10.0.0.5:5432');

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'error_interno',
        message: 'Error interno',
        correlationId: expect.any(String),
      }),
    );
    // La dirección del servidor o detalle interno no debe estar en el mensaje
    expect(res.json.mock.calls[0][0].message).not.toContain('ECONNREFUSED');
  });

  // --- CASO 5 ---
  it('un 404 conserva su mensaje pero con el envelope', () => {
    const { host, res } = hostDePrueba();
    const error = new NotFoundException('Lote no encontrado');

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'no_encontrado',
        message: 'Lote no encontrado',
        correlationId: expect.any(String),
      }),
    );
  });

  // --- CASO 6 ---
  it('una regla de negocio gana al 422 genérico', () => {
    const { host, res } = hostDePrueba();
    const error = new ReglaDeNegocioException(
      'El lote no tiene ofertas guardadas tuyas.',
    );

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        code: 'regla_de_negocio',
        message: 'El lote no tiene ofertas guardadas tuyas.',
        correlationId: expect.any(String),
      }),
    );
  });

  it('un 422 que no es regla de negocio sale con el código de validación', () => {
    const { host, res } = hostDePrueba();
    const error = new UnprocessableEntityException('mail inválido');

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        code: 'validacion',
      }),
    );
  });

  // --- CASO 7 ---
  it('el correlationId va en el body y en el header (reutiliza si viene en la request)', () => {
    const correlationIdEsperado = 'req-trace-uuid-1234';
    const { host, res, cabeceras } = hostDePrueba({
      'x-correlation-id': correlationIdEsperado,
    });
    const error = new NotFoundException('Recurso no encontrado');

    new ApiExceptionFilter().catch(error, host);

    expect(cabeceras['x-correlation-id']).toBe(correlationIdEsperado);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: correlationIdEsperado,
      }),
    );
  });

  it('sin correlationId entrante, genera uno y lo repite en el header y el body', () => {
    const { host, res, cabeceras } = hostDePrueba();
    const error = new NotFoundException('Recurso no encontrado');

    new ApiExceptionFilter().catch(error, host);

    // Debe existir en el header y en el body
    expect(cabeceras['x-correlation-id']).toBeDefined();
    // Y deben ser exactamente el mismo string
    expect(res.json.mock.calls[0][0].correlationId).toBe(cabeceras['x-correlation-id']);
  });

  // --- CASO 8 ---
  it('un 503 que no es por cola llena no lleva header Retry-After', () => {
    const { host, res, cabeceras } = hostDePrueba();
    const error = new ServiceUnavailableException('Redis no responde');

    new ApiExceptionFilter().catch(error, host);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'servicio_no_disponible',
      }),
    );
    expect(cabeceras['retry-after']).toBeUndefined();
  });
});
