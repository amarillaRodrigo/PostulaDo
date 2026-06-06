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
    user: {
      id: 'user-uuid',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.USER,
      birthDate: new Date('1995-05-15'),
      countryCode: 'AR',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockAuthService = {
    register: jest.fn(),
    loginWithCredentials: jest.fn(),
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
});
