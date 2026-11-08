import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';
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
  /** Token corto: viaja en cada request. */
  access_token: string;
  /** Token largo: solo sirve para pedir un par nuevo. Se guarda hasheado. */
  refresh_token: string;
  /** Segundos que dura el access token. */
  expires_in: number;
  user: PublicUser;
  /** `false` cuando no hay proveedor de correo configurado. */
  emailEnviado?: boolean;
};

const VIGENCIA_TOKEN_MS = 24 * 60 * 60 * 1000;
/** El enlace de recuperación vive menos: una hora y una sola vez. */
const VIGENCIA_RESET_MS = 60 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;
/** Un refresh token dura 30 días; cada uso lo rota. */
const VIGENCIA_REFRESCO_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Ventana para rotaciones simultáneas (dos pestañas que renuevan a la vez).
 * Pasado ese margen, un token ya rotado se considera robado.
 */
const GRACIA_ROTACION_MS = 30 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
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

    const sesion = await this.emitirSesion(user);

    return { ...sesion, emailEnviado: enviado };
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

  /**
   * Emite un par de tokens.
   *
   * El access token es corto (15 min en producción). El refresh token es
   * largo, se guarda hasheado y pertenece a una familia: cada refresh lo rota
   * y, si un token ya rotado reaparece fuera de la ventana de gracia, se corta
   * toda la familia.
   */
  private async emitirSesion(
    user: User,
    familiaId?: string,
  ): Promise<AuthResult> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const access_token = await this.jwtService.signAsync(payload);
    const refresh_token = randomBytes(48).toString('hex');
    const ahora = new Date();

    // Limpieza oportunista: al abrir una sesión nueva se borran los tokens
    // vencidos o revocados hace más de 30 días de esa persona.
    if (!familiaId) {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { expiresAt: { lt: ahora } },
            {
              revokedAt: {
                lt: new Date(ahora.getTime() - VIGENCIA_REFRESCO_MS),
              },
            },
          ],
        },
      });
    }

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refresh_token),
        familyId: familiaId ?? randomUUID(),
        expiresAt: new Date(ahora.getTime() + VIGENCIA_REFRESCO_MS),
      },
    });

    return {
      access_token,
      refresh_token,
      expires_in: this.segundosDeVida(access_token),
      user: this.toPublicUser(user),
    };
  }

  /** Lee `exp - iat` del JWT para informar cuánto dura el access token. */
  private segundosDeVida(accessToken: string): number {
    const payload = accessToken.split('.')[1];
    if (!payload) return 0;

    try {
      const datos = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as { iat?: number; exp?: number };

      if (typeof datos.iat !== 'number' || typeof datos.exp !== 'number') {
        return 0;
      }

      return Math.max(0, datos.exp - datos.iat);
    } catch {
      return 0;
    }
  }

  async login(user: User): Promise<AuthResult> {
    return this.emitirSesion(user);
  }

  async loginWithCredentials(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateUser(dto.email, dto.password);
    return this.login(user);
  }

  /**
   * Cambia un refresh token por un par nuevo.
   *
   * Rotación: el token usado se revoca y nace otro de la misma familia. Si
   * alguien presenta un token revocado hace más de 30 s, se asume que fue
   * robado y se revoca la familia completa.
   */
  async refrescar(refreshToken: string): Promise<AuthResult> {
    const guardado = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { user: true },
    });

    if (!guardado) {
      throw new UnauthorizedException(
        'La sesión ya no es válida. Entrá de nuevo.',
      );
    }

    if (guardado.revokedAt) {
      // Un token cerrado por logout o por cambio de contraseña no se toca:
      // tiene que dejar de servir en el acto.
      if (!guardado.rotated) {
        throw new UnauthorizedException(
          'La sesión ya no es válida. Entrá de nuevo.',
        );
      }

      const desdeRevocacion = Date.now() - guardado.revokedAt.getTime();

      if (desdeRevocacion > GRACIA_ROTACION_MS) {
        await this.revocarFamilia(guardado.familyId);
        throw new UnauthorizedException(
          'La sesión ya no es válida. Entrá de nuevo.',
        );
      }

      // Rotación simultánea: se emite otro par, pero no se extiende la
      // ventana de gracia (no se vuelve a tocar `revokedAt`).
      return this.emitirSesion(guardado.user, guardado.familyId);
    }

    if (guardado.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('La sesión venció. Entrá de nuevo.');
    }

    const nueva = await this.emitirSesion(guardado.user, guardado.familyId);

    await this.prisma.refreshToken.update({
      where: { id: guardado.id },
      data: { revokedAt: new Date(), rotated: true },
    });

    return nueva;
  }

  /** Cierra la sesión de ese token. Idempotente y sin revelar si existía. */
  async cerrarSesion(refreshToken?: string): Promise<{ cerrada: true }> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash: this.hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    return { cerrada: true };
  }

  /**
   * Cierra todas las sesiones de la cuenta.
   *
   * Sirve para "cerrar sesión en todos los dispositivos": revoca cada refresh
   * token vivo, incluido el de este dispositivo. Los access tokens siguen
   * siendo válidos hasta que vencen (15 min), pero ya no pueden renovarse.
   */
  async cerrarTodasLasSesiones(userId: string): Promise<{ cerradas: number }> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { cerradas: count };
  }

  /**
   * Lista las sesiones abiertas de la cuenta, marcando cuál es la del
   * dispositivo que pregunta. Es el listado del panel de cuenta: cada fila
   * es un dispositivo con la sesión activa, sin datos inventados — solo lo
   * que la cuenta puede saber de seguro (cuándo se abrió y cuándo vence).
   */
  async listarSesiones(
    userId: string,
    refreshToken?: string,
  ): Promise<
    Array<{
      id: string;
      esteDispositivo: boolean;
      abierta: Date;
      vence: Date;
    }>
  > {
    const ahora = new Date();

    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: ahora } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, tokenHash: true, createdAt: true, expiresAt: true },
    });

    const hashLocal = refreshToken ? this.hashToken(refreshToken) : null;

    return tokens.map((t) => ({
      id: t.id,
      esteDispositivo: Boolean(hashLocal) && t.tokenHash === hashLocal,
      abierta: t.createdAt,
      vence: t.expiresAt,
    }));
  }

  /**
   * Cierra las sesiones abiertas en los otros dispositivos: revoca cada
   * refresh token vivo que no sea el del dispositivo que pregunta. La
   * sesión actual queda abierta; los access tokens viejos vencen solos.
   */
  async cerrarOtrasSesiones(
    userId: string,
    refreshToken?: string,
  ): Promise<{ cerradas: number }> {
    const hashLocal = refreshToken ? this.hashToken(refreshToken) : null;

    if (!hashLocal) {
      // Sin manera de saber cuál es la actual, cerrar "las otras" no se
      // puede hacer sin cerrar también ésta: se niega.
      throw new BadRequestException(
        'Necesitamos el refresh token para saber qué sesión conservar.',
      );
    }

    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, NOT: { tokenHash: hashLocal } },
      data: { revokedAt: new Date() },
    });

    return { cerradas: count };
  }

  private async revocarFamilia(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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

    // Cambiar la contraseña cierra todas las sesiones abiertas: si alguien
    // tenía un token robado, deja de servirle.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { restablecida: true, email: user.email };
  }
}
