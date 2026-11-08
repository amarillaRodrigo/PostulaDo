import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** Tope igual al del DTO de creación: un lote no crece sin control. */
const MAX_IDS = 50;

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

  /**
   * Cambia el nombre que se muestra para el lote. Un nombre vacío devuelve
   * al "Lote sin nombre": hay que poder deshacer un nombre mal puesto.
   */
  async renombrar(userId: string, id: string, nombre: string) {
    await this.obtener(userId, id);

    return this.prisma.lote.update({
      where: { id },
      data: { nombre: nombre.trim() || null },
    });
  }

  /** Borra el lote: las ofertas guardadas no se tocan, solo el plan. */
  async borrar(userId: string, id: string) {
    const lote = await this.obtener(userId, id);

    await this.prisma.lote.delete({ where: { id: lote.id } });

    return { borrado: true, id: lote.id };
  }

  /**
   * Agrega ofertas propias a un lote guardado, sin duplicar: las que ya
   * están quedan donde estaban y la denominación del plan crece con las
   * nuevas al final.
   */
  async agregar(userId: string, loteId: string, ids: string[]) {
    const lote = await this.obtener(userId, loteId);

    const propias = await this.prisma.postulacion.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true },
    });

    if (propias.length === 0) {
      throw new BadRequestException(
        'Esas ofertas no están guardadas en tu cuenta.',
      );
    }

    const existentes = new Set<string>(lote.ids);
    const nuevas = propias.map((p) => p.id).filter((id) => !existentes.has(id));

    if (nuevas.length === 0) {
      return lote;
    }

    if (lote.ids.length + nuevas.length > MAX_IDS) {
      throw new BadRequestException(
        `El lote puede tener hasta ${MAX_IDS} ofertas; este paso lo llevaría a ${lote.ids.length + nuevas.length}.`,
      );
    }

    return this.prisma.lote.update({
      where: { id: lote.id },
      data: { ids: [...lote.ids, ...nuevas] },
    });
  }
}
