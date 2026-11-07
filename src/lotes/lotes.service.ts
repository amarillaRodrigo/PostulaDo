import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Guarda un lote.
   *
   * Solo se aceptan ids que pertenezcan a la persona: un lote no puede
   * arrastrar ofertas ajenas para inflar su denominador.
   */
  async crear(userId: string, ids: string[], nombre?: string) {
    const propias = await this.prisma.postulacion.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true },
    });

    if (propias.length === 0) {
      throw new BadRequestException(
        'El lote no tiene ofertas guardadas tuyas.',
      );
    }

    return this.prisma.lote.create({
      data: {
        userId,
        nombre: nombre?.trim() || null,
        ids: propias.map((p) => p.id),
      },
    });
  }

  async listar(userId: string, limite = 20) {
    return this.prisma.lote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
  }

  async obtener(userId: string, id: string) {
    const lote = await this.prisma.lote.findUnique({ where: { id } });

    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    if (lote.userId !== userId) {
      throw new ForbiddenException('No autorizado');
    }

    return lote;
  }
}
