import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PreviewTextoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  texto!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  titulo?: string;
}
