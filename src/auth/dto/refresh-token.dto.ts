import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token emitido en el login o en un refresh anterior',
  })
  @IsString()
  @Length(32, 256)
  refresh_token!: string;
}
