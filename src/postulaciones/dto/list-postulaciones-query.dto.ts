import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EstadoPostulacion } from '@prisma/client';

/**
 * Tope de registros por página.
 *
 * Sin este tope, `?limit=100000` hace que la base devuelva cien mil filas en
 * una request. El 422 lo produce el `ValidationPipe` global: el pedido se
 * entiende pero no cumple las reglas.
 */
export const LIMITE_MAXIMO = 100;

export class ListPostulacionesQueryDto {
  @ApiPropertyOptional({ example: 'ENVIADO' })
  @IsOptional()
  @IsEnum(EstadoPostulacion)
  status?: EstadoPostulacion;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  // El casteo a booleano ocurre ANTES de este callback (conversión por
  // design:type): "false" ya entra como true. El valor crudo está en `obj`,
  // así que la comparación de texto se hace contra él.
  @Transform(({ key, obj }) => obj?.[key] === true || obj?.[key] === 'true')
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: LIMITE_MAXIMO,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  @Type(() => Number)
  limit?: number;

  /**
   * Cursor de la paginación: la última fila de la página anterior.
   *
   * Cuando viene, `page` se ignora. El cursor es opaco para el cliente:
   * el servidor lo manda en el header `X-Next-Cursor` y el cliente lo
   * devuelve tal cual.
   */
  @ApiPropertyOptional({
    example: '2026-11-18T12:00:00.000Z|9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
    description:
      'Cursor de la posición. Cuando viene, `page` se ignora: la página siguiente son las filas que están después de esta. El servidor lo devuelve en el header `X-Next-Cursor`.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
