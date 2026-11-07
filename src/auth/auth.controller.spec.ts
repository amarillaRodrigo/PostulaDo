import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, AuthResult } from './auth.service';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthResult: AuthResult = {
    access_token: 'mock-jwt-token',
    refresh_token: 'r'.repeat(96),
    expires_in: 900,
    user: {
      id: 'user-uuid',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.USER,
      birthDate: new Date('1995-05-15'),
      countryCode: 'AR',
      profileText: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockAuthService = {
    register: jest.fn(),
    loginWithCredentials: jest.fn(),
    olvidePassword: jest.fn(),
    resetPassword: jest.fn(),
    refrescar: jest.fn(),
    cerrarSesion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('debería registrar un usuario y retornar el token y el perfil', async () => {
      const dto: CreateUsuarioDto = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
        birthDate: '1995-05-15',
        countryCode: 'AR',
      };

      mockAuthService.register.mockResolvedValueOnce(mockAuthResult);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResult);
    });
  });

  describe('login', () => {
    it('debería iniciar sesión y retornar el token y el perfil', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      mockAuthService.loginWithCredentials.mockResolvedValueOnce(
        mockAuthResult,
      );

      const result = await controller.login(dto);

      expect(mockAuthService.loginWithCredentials).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResult);
    });
  });

  describe('olvidePassword', () => {
    it('debería delegar el pedido al servicio', async () => {
      mockAuthService.olvidePassword.mockResolvedValueOnce({ enviado: true });

      const result = await controller.olvidePassword({
        email: 'test@example.com',
      });

      expect(mockAuthService.olvidePassword).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result).toEqual({ enviado: true });
    });
  });

  describe('resetPassword', () => {
    it('debería pasar el token y la contraseña nueva', async () => {
      mockAuthService.resetPassword.mockResolvedValueOnce({
        restablecida: true,
        email: 'test@example.com',
      });

      const result = await controller.resetPassword({
        token: 'a'.repeat(64),
        password: 'NuevaClave123',
      });

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'a'.repeat(64),
        'NuevaClave123',
      );
      expect(result.restablecida).toBe(true);
    });
  });

  describe('refresh', () => {
    it('debería cambiar el refresh token por un par nuevo', async () => {
      mockAuthService.refrescar.mockResolvedValueOnce(mockAuthResult);

      const result = await controller.refresh({
        refresh_token: 'r'.repeat(96),
      });

      expect(mockAuthService.refrescar).toHaveBeenCalledWith('r'.repeat(96));
      expect(result.refresh_token).toBe(mockAuthResult.refresh_token);
    });
  });

  describe('logout', () => {
    it('debería revocar el refresh token', async () => {
      mockAuthService.cerrarSesion.mockResolvedValueOnce({ cerrada: true });

      const result = await controller.logout({
        refresh_token: 'r'.repeat(96),
      });

      expect(mockAuthService.cerrarSesion).toHaveBeenCalledWith('r'.repeat(96));
      expect(result).toEqual({ cerrada: true });
    });
  });
});
