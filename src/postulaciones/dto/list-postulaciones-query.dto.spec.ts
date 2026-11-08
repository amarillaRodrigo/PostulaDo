import { plainToInstance } from 'class-transformer';
import { ValidationPipe } from '@nestjs/common';
import { ListPostulacionesQueryDto } from './list-postulaciones-query.dto';

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
});
