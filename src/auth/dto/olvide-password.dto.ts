import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class OlvidePasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description:
      'Correo de la cuenta. La respuesta es la misma exista o no, para no revelar qué correos están registrados.',
  })
  @IsEmail()
  email!: string;
}
