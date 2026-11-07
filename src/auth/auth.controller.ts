import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerificarEmailDto } from './dto/verificar-email.dto';
import { AuthResultDto } from './dto/auth-result.dto';
import { PublicUserDto } from '../usuarios/dto/public-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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

  @Post('verificar')
  @ApiOperation({ summary: 'Confirm an email address with the token' })
  @ApiOkResponse({ description: 'Email confirmed' })
  async verificar(@Body() dto: VerificarEmailDto) {
    return this.authService.verificarEmail(dto.token);
  }

  @Post('reenviar-verificacion')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resend the confirmation email' })
  @ApiOkResponse({ description: 'Confirmation email sent again' })
  async reenviar(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.authService.reenviarVerificacion(userId);
  }

  @Get('yo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'Current user', type: PublicUserDto })
  async yo(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.authService.perfil(userId);
  }
}
