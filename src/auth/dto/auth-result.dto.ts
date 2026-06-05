import { ApiProperty } from '@nestjs/swagger';
import { PublicUserDto } from '../../usuarios/dto/public-user.dto';

export class AuthResultDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token!: string;

  @ApiProperty({ type: () => PublicUserDto })
  user!: PublicUserDto;
}
