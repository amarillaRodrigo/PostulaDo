import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoPostulacion } from '@prisma/client';

export class UpdatePostulacionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EstadoPostulacion)
  status?: EstadoPostulacion;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
