import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/** Account persistence requires a confirmed email; preview analysis does not. */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id ?? request.user?.sub;

    if (!userId) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });

    if (!user) throw new UnauthorizedException('La sesión ya no es válida');
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Confirmá tu correo para guardar ofertas y roadmaps.',
      );
    }

    return true;
  }
}
