import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoPostulacion } from '@prisma/client';

export class UpdatePostulacionDto {
  @ApiPropertyOptional({ example: 'New title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'ENTREVISTA' })
  @IsOptional()
  @IsEnum(EstadoPostulacion)
  status?: EstadoPostulacion;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
