import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EstadoPostulacion } from '@prisma/client';

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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
