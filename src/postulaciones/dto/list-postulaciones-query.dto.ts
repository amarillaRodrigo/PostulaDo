import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoPostulacion } from '@prisma/client';

export class ListPostulacionesQueryDto {
  @ApiPropertyOptional({ example: 'ENVIADO' })
  @IsOptional()
  @IsEnum(EstadoPostulacion)
  status?: EstadoPostulacion;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
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
