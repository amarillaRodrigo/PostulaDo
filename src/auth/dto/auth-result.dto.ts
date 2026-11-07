import { ApiProperty } from '@nestjs/swagger';
import { PublicUserDto } from '../../usuarios/dto/public-user.dto';

export class AuthResultDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token!: string;

  @ApiProperty({ example: '9f2c...96 caracteres hexadecimales' })
  refresh_token!: string;

  @ApiProperty({
    example: 900,
    description: 'Segundos de vida del access token',
  })
  expires_in!: number;

  @ApiProperty({ type: () => PublicUserDto })
  user!: PublicUserDto;
}
