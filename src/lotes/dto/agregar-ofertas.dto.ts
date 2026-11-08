import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AgregarOfertasDto {
  @ApiProperty({
    description: 'Ids de las postulaciones que entran al lote',
    example: ['9a1b2c3d-0000-4000-8000-000000000000'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  ids!: string[];
}
