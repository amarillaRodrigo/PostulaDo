import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty({ example: '9a1b2c3d-...' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Rodrigo' })
  name?: string;

  @ApiPropertyOptional({ example: 'USER' })
  role?: string;

  @ApiProperty({ example: '1998-05-20T00:00:00.000Z' })
  birthDate!: string;

  @ApiPropertyOptional({ example: 'AR' })
  countryCode?: string;

  @ApiPropertyOptional({ example: 'Soy desarrollador backend con experiencia en NestJS.' })
  profileText?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt!: string;
}
