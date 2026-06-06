import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { compare } from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUser: User = {
    id: 'user-uuid',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    role: UserRole.USER,
    birthDate: new Date('1995-05-15'),
    countryCode: 'AR',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsuariosService = {
    user: jest.fn(),
    createUser: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: mockUsuariosService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test User',
      birthDate: '1995-05-15',
      countryCode: 'AR',
    };

    it('debería registrar un nuevo usuario exitosamente y retornar token', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(null);
      mockUsuariosService.createUser.mockResolvedValueOnce(mockUser);
      mockJwtService.signAsync.mockResolvedValueOnce('mock-jwt-token');

      const result = await service.register(registerDto);

      expect(mockUsuariosService.user).toHaveBeenCalledWith({
        email: registerDto.email,
      });
      expect(mockUsuariosService.createUser).toHaveBeenCalledWith(registerDto);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      // Debe retornar token y el usuario sin contraseña
      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          birthDate: mockUser.birthDate,
          countryCode: mockUser.countryCode,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
      expect((result.user as any).password).toBeUndefined();
    });

    it('debería lanzar ConflictException si el email ya existe', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUsuariosService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    const email = 'test@example.com';
    const password = 'Password123!';

    it('debería validar con éxito y retornar el usuario completo', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(mockUser);
      (compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.validateUser(email, password);

      expect(mockUsuariosService.user).toHaveBeenCalledWith({ email });
      expect(compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result).toEqual(mockUser);
    });

    it('debería lanzar UnauthorizedException si el usuario no existe', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(null);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(compare).not.toHaveBeenCalled();
    });

    it('debería lanzar UnauthorizedException si la contraseña no coincide', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(mockUser);
      (compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(compare).toHaveBeenCalledWith(password, mockUser.password);
    });
  });

  describe('login', () => {
    it('debería generar el token y retornar el usuario sin contraseña', async () => {
      mockJwtService.signAsync.mockResolvedValueOnce('mock-jwt-token');

      const result = await service.login(mockUser);

      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          birthDate: mockUser.birthDate,
          countryCode: mockUser.countryCode,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
      expect((result.user as any).password).toBeUndefined();
    });
  });

  describe('loginWithCredentials', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('debería validar y retornar login', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(mockUser);
      (compare as jest.Mock).mockResolvedValueOnce(true);
      mockJwtService.signAsync.mockResolvedValueOnce('mock-jwt-token');

      const result = await service.loginWithCredentials(loginDto);

      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.id).toBe(mockUser.id);
    });
  });
});
