import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service';
import { getJwtSecret } from '../jwt-secret';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
  /** Refresh-token family; revoking the family invalidates its access tokens. */
  sid: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['HS256'],
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub || !payload.sid) return null;

    // Access tokens are tied to the persisted session family. This makes
    // logout, password reset and account deletion invalidate them immediately.
    const session = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        familyId: payload.sid,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!session?.user) return null;

    // Use current account data rather than stale role/email claims in a JWT.
    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    };
  }
}
