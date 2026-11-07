import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CerrarSesionDto {
  @ApiPropertyOptional({
    description:
      'Refresh token de la sesión que se quiere cerrar. Sin token la respuesta es la misma, para no revelar si existía.',
  })
  @IsOptional()
  @IsString()
  @Length(32, 256)
  refresh_token?: string;
}
