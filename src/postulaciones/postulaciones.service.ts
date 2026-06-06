import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { ListPostulacionesQueryDto } from './dto/list-postulaciones-query.dto';
import { extractTechnologies } from './helpers/technology-extractor.helper';

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
    const combinedText = `${dto.title || ''} ${dto.description || ''}`;
    const technologies = extractTechnologies(combinedText);

    return this.prisma.postulacion.create({
      data: {
        url: dto.url,
        title: dto.title,
        description: dto.description,
        rawRequirements: technologies,
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

  async getLearningAnalysis(userId: string) {
    const postulaciones = await this.prisma.postulacion.findMany({
      where: {
        userId,
        isArchived: false,
      },
      select: {
        rawRequirements: true,
      },
    });

    const totalApplications = postulaciones.length;
    if (totalApplications === 0) {
      return {
        totalApplicationsAnalizadas: 0,
        tecnologiasMasDemandadas: [],
        sugerenciaAprendizaje:
          'Aún no tienes postulaciones guardadas para analizar. Registra tus ofertas para ver recomendaciones de aprendizaje.',
      };
    }

    const frequencyMap: { [key: string]: number } = {};
    for (const p of postulaciones) {
      const requirements = (p.rawRequirements as string[]) || [];
      for (const req of requirements) {
        frequencyMap[req] = (frequencyMap[req] || 0) + 1;
      }
    }

    const sortedTechnologies = Object.entries(frequencyMap)
      .map(([name, count]) => {
        const percentage = Math.round((count / totalApplications) * 100);
        return { name, count, percentage };
      })
      .sort((a, b) => b.count - a.count);

    // Generate intelligent suggestion
    let suggestion = '';
    if (sortedTechnologies.length > 0) {
      const topTechs = sortedTechnologies
        .filter((t) => t.percentage >= 40)
        .map((t) => t.name);

      if (topTechs.length > 0) {
        suggestion = `Basado en tus postulaciones, deberías priorizar el aprendizaje de: ${topTechs.join(', ')}. Estas tecnologías aparecen en el 40% o más de las vacantes a las que aspiras.`;
      } else {
        suggestion = `Te sugerimos enfocar tus esfuerzos en: ${sortedTechnologies
          .slice(0, 3)
          .map((t) => t.name)
          .join(
            ', ',
          )}, que son las tecnologías más comunes entre tus postulaciones actuales.`;
      }
    } else {
      suggestion =
        'No pudimos detectar requerimientos específicos en tus postulaciones actuales. Intenta incluir más descripciones en las ofertas que registres.';
    }

    return {
      totalApplicationsAnalizadas: totalApplications,
      tecnologiasMasDemandadas: sortedTechnologies,
      sugerenciaAprendizaje: suggestion,
    };
  }
}
