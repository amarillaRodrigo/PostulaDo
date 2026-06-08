import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsInt, IsArray } from 'class-validator';

export class CreatePostulacionDto {
  @ApiProperty({ example: 'https://empresa.com/oferta/123' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: 'Frontend Developer' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Fullstack role at ACME' })
  @IsOptional()
  @IsString()
  description?: string;

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
