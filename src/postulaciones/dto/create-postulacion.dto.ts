import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreatePostulacionDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
