import { IsUrl } from 'class-validator';

export class AnalyzePostulacionDto {
  @IsUrl()
  url!: string;
}
