import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RenombrarLoteDto {
  @ApiProperty({ example: 'Backend Engineering' })
  @IsString()
  @Length(1, 80)
  nombre!: string;
}
