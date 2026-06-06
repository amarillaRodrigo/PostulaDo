import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResultDto } from './dto/auth-result.dto';
import { PublicUserDto } from '../usuarios/dto/public-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user and return token' })
  @ApiCreatedResponse({
    description: 'User registered and token returned',
    type: AuthResultDto,
  })
  async register(@Body() dto: CreateUsuarioDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({
    description: 'Returns access token and user',
    type: AuthResultDto,
  })
  async login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.loginWithCredentials(dto);
  }
}
