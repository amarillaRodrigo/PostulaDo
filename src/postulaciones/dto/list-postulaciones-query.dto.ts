import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoPostulacion } from '@prisma/client';

export class ListPostulacionesQueryDto {
  @IsOptional()
  @IsEnum(EstadoPostulacion)
  status?: EstadoPostulacion;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isArchived?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
