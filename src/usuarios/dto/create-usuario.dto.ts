import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  Length,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Secret123', writeOnly: true })
  @IsString()
  @Length(6, 128)
  password!: string;

  @ApiPropertyOptional({ example: 'Rodrigo' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '1998-05-20' })
  @IsDateString()
  birthDate!: string;

  @ApiPropertyOptional({ example: 'AR' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({ example: 'Soy desarrollador backend con experiencia en NestJS y TypeScript.' })
  @IsOptional()
  @IsString()
  profileText?: string;
}
