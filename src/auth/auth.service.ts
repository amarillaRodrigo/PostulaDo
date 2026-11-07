import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';

/** El token de verificación y su vencimiento nunca salen de la API. */
export type PublicUser = Omit<
  User,
  | 'password'
  | 'emailVerificationToken'
  | 'emailVerificationSentAt'
  | 'emailVerificationExpiresAt'
  | 'passwordResetToken'
  | 'passwordResetSentAt'
  | 'passwordResetExpiresAt'
>;

export type AuthResult = {
  access_token: string;
  user: PublicUser;
  /** `false` cuando no hay proveedor de correo configurado. */
  emailEnviado?: boolean;
};

const VIGENCIA_TOKEN_MS = 24 * 60 * 60 * 1000;
/** El enlace de recuperación vive menos: una hora y una sola vez. */
const VIGENCIA_RESET_MS = 60 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}

  private toPublicUser(user: User): PublicUser {
    const {
      password: _password,
      emailVerificationToken: _token,
      emailVerificationSentAt: _enviado,
      emailVerificationExpiresAt: _expira,
      passwordResetToken: _resetToken,
      passwordResetSentAt: _resetEnviado,
      passwordResetExpiresAt: _resetExpira,
      ...publicUser
    } = user;
    void _password;
    void _token;
    void _enviado;
    void _expira;
    void _resetToken;
    void _resetEnviado;
    void _resetExpira;

    return publicUser;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Genera un token nuevo, guarda su hash y manda el mail.
   *
   * Se guarda el hash para que una lectura de la base no alcance para
   * verificar cuentas ajenas.
   */
  private async emitirVerificacion(user: User): Promise<{ enviado: boolean }> {
    const token = randomBytes(32).toString('hex');
    const ahora = new Date();

    await this.usuariosService.updateUser({
      where: { id: user.id },
      data: {
        emailVerificationToken: this.hashToken(token),
        emailVerificationSentAt: ahora,
        emailVerificationExpiresAt: new Date(
          ahora.getTime() + VIGENCIA_TOKEN_MS,
        ),
      },
    });

    const envio = await this.mail.enviarVerificacion(
      user.email,
      user.name,
      token,
    );

    return { enviado: envio.enviado };
  }

  async register(dto: CreateUsuarioDto): Promise<AuthResult> {
    const existingUser = await this.usuariosService.user({ email: dto.email });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const user = await this.usuariosService.createUser(dto);

    // Si el correo falla, la cuenta ya está creada y la sesión funciona: se
    // avisa con `emailEnviado: false` en vez de romper el registro.
    const { enviado } = await this.emitirVerificacion(user);

    return { ...(await this.login(user)), emailEnviado: enviado };
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

  async perfil(userId: string): Promise<PublicUser> {
    const user = await this.usuariosService.user({ id: userId });

    if (!user) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }

    return this.toPublicUser(user);
  }

  /** Idempotente: abrir el enlace dos veces no es un error. */
  async verificarEmail(token: string): Promise<{
    verificado: boolean;
    email: string;
    yaEstaba: boolean;
  }> {
    const user = await this.usuariosService.user({
      emailVerificationToken: this.hashToken(token),
    });

    if (!user) {
      throw new BadRequestException(
        'El enlace no es válido o ya se usó. Pedí uno nuevo desde tu cuenta.',
      );
    }

    if (user.emailVerifiedAt) {
      return { verificado: true, email: user.email, yaEstaba: true };
    }

    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'El enlace venció. Pedí uno nuevo desde tu cuenta.',
      );
    }

    await this.usuariosService.updateUser({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    return { verificado: true, email: user.email, yaEstaba: false };
  }

  async reenviarVerificacion(userId: string): Promise<{
    enviado: boolean;
    yaVerificado: boolean;
    esperaSegundos?: number;
  }> {
    const user = await this.usuariosService.user({ id: userId });

    if (!user) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }

    if (user.emailVerifiedAt) {
      return { enviado: false, yaVerificado: true };
    }

    const desdeElUltimo = user.emailVerificationSentAt
      ? Date.now() - user.emailVerificationSentAt.getTime()
      : Number.POSITIVE_INFINITY;

    // Un reenvío cada 60 s: evita usar la cuenta como cañón de correo.
    if (desdeElUltimo < ESPERA_REENVIO_MS) {
      return {
        enviado: false,
        yaVerificado: false,
        esperaSegundos: Math.ceil((ESPERA_REENVIO_MS - desdeElUltimo) / 1000),
      };
    }

    const { enviado } = await this.emitirVerificacion(user);

    return { enviado, yaVerificado: false };
  }

  /**
   * Pide un enlace de recuperación.
   *
   * La respuesta es siempre la misma exista o no la cuenta: si dijera "ese
   * correo no está registrado", el formulario serviría para averiguar quién
   * tiene cuenta. Cuando la cuenta existe se manda el mail; cuando no, se
   * responde lo mismo y no pasa nada.
   */
  async olvidePassword(email: string): Promise<{ enviado: boolean }> {
    const user = await this.usuariosService.user({ email });

    if (!user) {
      // La misma respuesta que daría una cuenta real. Sin proveedor nadie
      // puede recibir nada, así que también se dice que no se pudo enviar.
      return { enviado: this.mail.configurado };
    }

    const desdeElUltimo = user.passwordResetSentAt
      ? Date.now() - user.passwordResetSentAt.getTime()
      : Number.POSITIVE_INFINITY;

    // Un pedido por minuto: sin esto, cualquiera puede usar el formulario
    // para llenar de mails el buzón de otra persona.
    if (desdeElUltimo < ESPERA_REENVIO_MS) {
      return { enviado: this.mail.configurado };
    }

    const token = randomBytes(32).toString('hex');
    const ahora = new Date();

    await this.usuariosService.updateUser({
      where: { id: user.id },
      data: {
        passwordResetToken: this.hashToken(token),
        passwordResetSentAt: ahora,
        passwordResetExpiresAt: new Date(ahora.getTime() + VIGENCIA_RESET_MS),
      },
    });

    const envio = await this.mail.enviarRecuperacion(
      user.email,
      user.name,
      token,
    );

    return { enviado: envio.enviado };
  }

  /**
   * Cambia la contraseña con un token válido.
   *
   * El token se borra al usarlo, así que el mismo enlace no sirve dos veces.
   * Si el correo todavía no estaba confirmado, este paso lo confirma: quien
   * abrió el enlace demostró que controla la dirección.
   */
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ restablecida: true; email: string }> {
    const user = await this.usuariosService.user({
      passwordResetToken: this.hashToken(token),
    });

    if (!user) {
      throw new BadRequestException(
        'El enlace no es válido o ya se usó. Pedí uno nuevo.',
      );
    }

    if (
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'El enlace venció. Pedí uno nuevo desde "Olvidé mi contraseña".',
      );
    }

    await this.usuariosService.updateUser({
      where: { id: user.id },
      data: {
        // `updateUser` hashea la contraseña antes de guardarla.
        password,
        passwordResetToken: null,
        passwordResetSentAt: null,
        passwordResetExpiresAt: null,
        ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
      },
    });

    return { restablecida: true, email: user.email };
  }
}
