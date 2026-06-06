import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { ListPostulacionesQueryDto } from './dto/list-postulaciones-query.dto';

@Injectable()
export class PostulacionesService {
  constructor(private prisma: PrismaService) {}

  async analyze(url: string) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const finalUrl = res.url ?? url;
      const text = await res.text();

      const titleMatch =
        text.match(
          /<meta\s+property=("|')og:title\1\s+content=("|')([^"']+)\2/i,
        ) || text.match(/<title>([^<]+)<\/title>/i);
      const descriptionMatch =
        text.match(
          /<meta\s+name=("|')description\1\s+content=("|')([^"']+)\2/i,
        ) ||
        text.match(
          /<meta\s+property=("|')og:description\1\s+content=("|')([^"']+)\2/i,
        );

      const title = titleMatch ? titleMatch[3] || titleMatch[1] : undefined;
      const description = descriptionMatch
        ? descriptionMatch[3] || descriptionMatch[1]
        : undefined;

      return { url: finalUrl, title, description };
    } catch (err) {
      return { url, title: undefined, description: undefined };
    }
  }

  async create(dto: CreatePostulacionDto, userId: string) {
    return this.prisma.postulacion.create({
      data: {
        url: dto.url,
        title: dto.title,
        description: dto.description,
        user: { connect: { id: userId } },
      },
    });
  }

  async findAll(userId: string, query: ListPostulacionesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: any = { userId };
    if (typeof query.status !== 'undefined') where.status = query.status;
    if (typeof query.isArchived !== 'undefined')
      where.isArchived = query.isArchived;

    return this.prisma.postulacion.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const p = await this.prisma.postulacion.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Postulación no encontrada');
    if (p.userId !== userId) throw new ForbiddenException('No autorizado');
    return p;
  }

  async update(userId: string, id: string, dto: UpdatePostulacionDto) {
    const existing = await this.prisma.postulacion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Postulación no encontrada');
    if (existing.userId !== userId)
      throw new ForbiddenException('No autorizado');

    return this.prisma.postulacion.update({ where: { id }, data: dto as any });
  }
}
