import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CrearLoteDto {
  @ApiProperty({
    description: 'Ids de las postulaciones que forman el lote',
    example: ['9a1b2c3d-0000-4000-8000-000000000000'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiPropertyOptional({ example: 'Backend Engineering' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  nombre?: string;
}
