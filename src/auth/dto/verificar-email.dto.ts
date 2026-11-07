import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerificarEmailDto {
  @ApiProperty({
    description: 'Token que viaja en el enlace del correo',
    example: 'a3f1...64 caracteres hexadecimales',
  })
  @IsString()
  @Length(32, 128)
  token!: string;
}
