import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { compare } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { MailService } from '../mail/mail.service';

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
    profileText: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerifiedAt: null,
    emailVerificationToken: null,
    emailVerificationSentAt: null,
    emailVerificationExpiresAt: null,
    passwordResetToken: null,
    passwordResetSentAt: null,
    passwordResetExpiresAt: null,
  };

  const mockUsuariosService = {
    user: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockMail = {
    enviarVerificacion: jest.fn(),
    enviarRecuperacion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockUsuariosService.updateUser.mockResolvedValue(mockUser);
    mockMail.enviarVerificacion.mockResolvedValue({ enviado: true });
    mockMail.enviarRecuperacion.mockResolvedValue({ enviado: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: mockUsuariosService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMail },
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
        emailEnviado: true,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          birthDate: mockUser.birthDate,
          countryCode: mockUser.countryCode,
          profileText: mockUser.profileText,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
          emailVerifiedAt: null,
        },
      });
      expect((result.user as any).password).toBeUndefined();
      expect((result.user as any).emailVerificationToken).toBeUndefined();
    });

    it('guarda el hash del token, no el token que viaja por mail', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(null);
      mockUsuariosService.createUser.mockResolvedValueOnce(mockUser);
      mockJwtService.signAsync.mockResolvedValueOnce('mock-jwt-token');

      await service.register(registerDto);

      const datos = mockUsuariosService.updateUser.mock.calls[0][0].data;
      const tokenEnviado = mockMail.enviarVerificacion.mock.calls[0][2];

      expect(datos.emailVerificationToken).toMatch(/^[a-f0-9]{64}$/);
      expect(datos.emailVerificationToken).not.toBe(tokenEnviado);
      expect(createHash('sha256').update(tokenEnviado).digest('hex')).toBe(
        datos.emailVerificationToken,
      );
      expect(datos.emailVerificationExpiresAt.getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it('no rompe el registro si el correo no se pudo enviar', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(null);
      mockUsuariosService.createUser.mockResolvedValueOnce(mockUser);
      mockJwtService.signAsync.mockResolvedValueOnce('mock-jwt-token');
      mockMail.enviarVerificacion.mockResolvedValueOnce({
        enviado: false,
        motivo: 'sin-proveedor',
      });

      const result = await service.register(registerDto);

      expect(result.emailEnviado).toBe(false);
      expect(result.access_token).toBe('mock-jwt-token');
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
          profileText: mockUser.profileText,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
          emailVerifiedAt: null,
        },
      });
      expect((result.user as any).password).toBeUndefined();
      expect((result.user as any).emailVerificationToken).toBeUndefined();
    });
  });

  describe('verificarEmail', () => {
    const token = 'a'.repeat(64);
    const hash = createHash('sha256').update(token).digest('hex');

    it('marca el correo como verificado y borra el token', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        emailVerificationToken: hash,
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.verificarEmail(token);

      expect(mockUsuariosService.user).toHaveBeenCalledWith({
        emailVerificationToken: hash,
      });
      expect(result).toEqual({
        verificado: true,
        email: mockUser.email,
        yaEstaba: false,
      });
      expect(mockUsuariosService.updateUser).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          emailVerifiedAt: expect.any(Date),
          emailVerificationToken: null,
          emailVerificationExpiresAt: null,
        },
      });
    });

    it('es idempotente si el correo ya estaba verificado', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        emailVerifiedAt: new Date(),
        emailVerificationToken: hash,
      });

      const result = await service.verificarEmail(token);

      expect(result.yaEstaba).toBe(true);
      expect(mockUsuariosService.updateUser).not.toHaveBeenCalled();
    });

    it('rechaza un token que no existe', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(null);

      await expect(service.verificarEmail(token)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza un token vencido', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        emailVerificationToken: hash,
        emailVerificationExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verificarEmail(token)).rejects.toThrow(/venció/);
      expect(mockUsuariosService.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('reenviarVerificacion', () => {
    it('no reenvía si el correo ya está verificado', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        emailVerifiedAt: new Date(),
      });

      const result = await service.reenviarVerificacion(mockUser.id);

      expect(result).toEqual({ enviado: false, yaVerificado: true });
      expect(mockMail.enviarVerificacion).not.toHaveBeenCalled();
    });

    it('espera 60 segundos entre envíos', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        emailVerificationSentAt: new Date(Date.now() - 10_000),
      });

      const result = await service.reenviarVerificacion(mockUser.id);

      expect(result.yaVerificado).toBe(false);
      expect(result.enviado).toBe(false);
      expect(result.esperaSegundos).toBeGreaterThan(0);
      expect(mockMail.enviarVerificacion).not.toHaveBeenCalled();
    });

    it('reenvía pasado el minuto de espera', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        emailVerificationSentAt: new Date(Date.now() - 120_000),
      });

      const result = await service.reenviarVerificacion(mockUser.id);

      expect(result).toEqual({ enviado: true, yaVerificado: false });
      expect(mockMail.enviarVerificacion).toHaveBeenCalledTimes(1);
    });
  });

  describe('olvidePassword', () => {
    it('responde igual aunque el correo no tenga cuenta', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(null);

      const result = await service.olvidePassword('nadie@example.com');

      expect(result).toEqual({ enviado: true });
      expect(mockUsuariosService.updateUser).not.toHaveBeenCalled();
      expect(mockMail.enviarRecuperacion).not.toHaveBeenCalled();
    });

    it('guarda el hash del token, no el token, y manda el mail', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(mockUser);

      const result = await service.olvidePassword(mockUser.email);

      expect(result).toEqual({ enviado: true });
      const datos = mockUsuariosService.updateUser.mock.calls[0][0].data;
      const tokenEnviado = mockMail.enviarRecuperacion.mock.calls[0][2];

      expect(datos.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
      expect(datos.passwordResetToken).not.toBe(tokenEnviado);
      expect(createHash('sha256').update(tokenEnviado).digest('hex')).toBe(
        datos.passwordResetToken,
      );
      expect(datos.passwordResetExpiresAt.getTime()).toBeGreaterThan(
        Date.now(),
      );
      expect(mockMail.enviarRecuperacion).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        tokenEnviado,
      );
    });

    it('no manda dos mails en el mismo minuto', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        passwordResetSentAt: new Date(Date.now() - 5_000),
      });

      const result = await service.olvidePassword(mockUser.email);

      expect(result).toEqual({ enviado: true });
      expect(mockUsuariosService.updateUser).not.toHaveBeenCalled();
      expect(mockMail.enviarRecuperacion).not.toHaveBeenCalled();
    });

    it('informa si el proveedor no pudo enviar', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(mockUser);
      mockMail.enviarRecuperacion.mockResolvedValueOnce({
        enviado: false,
        motivo: 'sin-proveedor',
      });

      const result = await service.olvidePassword(mockUser.email);

      expect(result).toEqual({ enviado: false });
    });

    it('no reutiliza el token anterior al pedir uno nuevo', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        passwordResetSentAt: new Date(Date.now() - 120_000),
      });

      await service.olvidePassword(mockUser.email);

      const datos = mockUsuariosService.updateUser.mock.calls[0][0].data;
      expect(datos.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('resetPassword', () => {
    const token = 'c'.repeat(64);
    const hash = createHash('sha256').update(token).digest('hex');

    it('cambia la contraseña, borra el token y confirma el correo', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        passwordResetToken: hash,
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.resetPassword(token, 'NuevaClave123');

      expect(mockUsuariosService.user).toHaveBeenCalledWith({
        passwordResetToken: hash,
      });
      expect(result).toEqual({
        restablecida: true,
        email: mockUser.email,
      });
      expect(mockUsuariosService.updateUser).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          password: 'NuevaClave123',
          passwordResetToken: null,
          passwordResetSentAt: null,
          passwordResetExpiresAt: null,
          emailVerifiedAt: expect.any(Date),
        },
      });
    });

    it('no vuelve a confirmar un correo que ya estaba confirmado', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        emailVerifiedAt: new Date('2026-01-01'),
        passwordResetToken: hash,
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });

      await service.resetPassword(token, 'NuevaClave123');

      const datos = mockUsuariosService.updateUser.mock.calls[0][0].data;
      expect(datos.emailVerifiedAt).toBeUndefined();
    });

    it('rechaza un token que no existe', async () => {
      mockUsuariosService.user.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword(token, 'NuevaClave123'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsuariosService.updateUser).not.toHaveBeenCalled();
    });

    it('rechaza un token vencido y no toca la contraseña', async () => {
      mockUsuariosService.user.mockResolvedValueOnce({
        ...mockUser,
        passwordResetToken: hash,
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword(token, 'NuevaClave123'),
      ).rejects.toThrow(/venció/);
      expect(mockUsuariosService.updateUser).not.toHaveBeenCalled();
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
