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
  // El query string trae "true"/"false" como texto: Boolean("false") es true,
  // así que el cast correcto es comparar el texto, no convertir.
  @Transform(({ value }) => value === true || value === 'true')
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
