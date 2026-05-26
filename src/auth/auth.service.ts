import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';

export type PublicUser = Omit<User, 'password'>;

export type AuthResult = {
  access_token: string;
  user: PublicUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  private toPublicUser(user: User): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...publicUser } = user;
    return publicUser;
  }

  async register(dto: CreateUsuarioDto): Promise<AuthResult> {
    const existingUser = await this.usuariosService.user({ email: dto.email });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const user = await this.usuariosService.createUser(dto);
    return this.login(user);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usuariosService.user({ email });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return user;
  }

  async login(user: User): Promise<AuthResult> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: this.toPublicUser(user),
    };
  }

  async loginWithCredentials(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateUser(dto.email, dto.password);
    return this.login(user);
  }
}