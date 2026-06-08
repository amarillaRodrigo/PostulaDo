import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsInt, IsArray } from 'class-validator';
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

  @ApiPropertyOptional({ example: 'ACME Corp' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: ['React', 'NestJS'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tecnologias?: string[];

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  aniosExperiencia?: number;

  @ApiPropertyOptional({ example: ['Desarrollar APIs', 'Optimizar bases de datos'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsabilidades?: string[];

  @ApiPropertyOptional({ example: 'Profesional y dinámico' })
  @IsOptional()
  @IsString()
  tonoEmpresa?: string;
}
