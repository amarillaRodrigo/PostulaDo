import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class BorrarCuentaDto {
  @ApiProperty({
    description: 'Contraseña actual: borrar la cuenta es irreversible',
  })
  @IsString()
  @Length(8, 128)
  password!: string;
}
