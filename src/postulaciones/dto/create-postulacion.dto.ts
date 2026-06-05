import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

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
}
