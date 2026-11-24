import { plainToInstance } from 'class-transformer';
import { ValidationPipe } from '@nestjs/common';
import {
  ListPostulacionesQueryDto,
  LIMITE_MAXIMO,
} from './list-postulaciones-query.dto';

describe('ListPostulacionesQueryDto', () => {
  it('convierte el texto "false" en el booleano false', () => {
    const dto = plainToInstance(ListPostulacionesQueryDto, {
      isArchived: 'false',
    });

    expect(dto.isArchived).toBe(false);
  });

  it('convierte el texto "true" en el booleano true', () => {
    const dto = plainToInstance(ListPostulacionesQueryDto, {
      isArchived: 'true',
    });

    expect(dto.isArchived).toBe(true);
  });

  it('el ValidationPipe del e2e entrega false para isArchived=false', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });

    const query = await pipe.transform(
      { isArchived: 'false' },
      {
        type: 'query',
        metatype: ListPostulacionesQueryDto,
      },
    );

    expect(query.isArchived).toBe(false);
  });

  it('sin el parametro, isArchived queda indefinido', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });

    const query = await pipe.transform(
      {},
      {
        type: 'query',
        metatype: ListPostulacionesQueryDto,
      },
    );

    expect(query.isArchived).toBeUndefined();
  });

  describe('límites de paginación', () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      errorHttpStatusCode: 422,
    });

    const transformar = (query: Record<string, unknown>) =>
      pipe.transform(query, {
        type: 'query',
        metatype: ListPostulacionesQueryDto,
      });

    /** El error de validación, con el detalle de qué campo falló. */
    const errorDe = async (query: Record<string, unknown>) => {
      const error = await transformar(query).catch((e) => e);
      const respuesta = error.getResponse() as { message: string[] };
      return {
        status: error.getStatus(),
        detalle: respuesta.message.join(' '),
      };
    };

    it('acepta el límite máximo', async () => {
      const query = await transformar({ limit: LIMITE_MAXIMO });

      expect(query.limit).toBe(LIMITE_MAXIMO);
    });

    it('rechaza un límite por encima del máximo', async () => {
      const error = await errorDe({ limit: LIMITE_MAXIMO + 1 });

      expect(error.status).toBe(422);
      expect(error.detalle).toMatch(/limit/);
    });

    it('rechaza un límite de cero o negativo', async () => {
      const cero = await errorDe({ limit: 0 });
      const negativo = await errorDe({ limit: -5 });

      expect(cero.status).toBe(422);
      expect(negativo.status).toBe(422);
      expect(cero.detalle).toMatch(/limit/);
    });

    it('rechaza una página de cero o negativa', async () => {
      const cero = await errorDe({ page: 0 });
      const negativa = await errorDe({ page: -1 });

      expect(cero.status).toBe(422);
      expect(negativa.status).toBe(422);
      expect(cero.detalle).toMatch(/page/);
    });

    it('acepta una página dentro de rango', async () => {
      const query = await transformar({ page: 3 });

      expect(query.page).toBe(3);
    });
  });
});
