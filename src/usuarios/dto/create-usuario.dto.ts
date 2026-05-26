import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  Length,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 128)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}
