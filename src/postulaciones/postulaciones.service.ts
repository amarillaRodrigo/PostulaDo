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
import { JobAnalyzerService } from './job-analyzer.service';
import { detectarEcosistema, temaPorKey, temasDe } from '../common/taxonomy';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class PostulacionesService {
  constructor(
    private prisma: PrismaService,
    private jobAnalyzer: JobAnalyzerService,
    @InjectQueue('analisis-trabajo') private readonly queue: Queue,
  ) {}

  async analyze(url: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileText: true },
    });
    const profileText =
      user?.profileText ||
      'Desarrollador de software interesado en nuevas tecnologías.';

    const job = await this.queue.add(
      'analizar-url',
      { url, userId, profileText },
      {
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    );

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  async getJobStatus(userId: string, jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Trabajo de análisis no encontrado');
    }

    if (job.data.userId !== userId) {
      throw new ForbiddenException('No autorizado para ver este trabajo');
    }

    const state = await job.getState();

    if (state === 'completed') {
      return {
        jobId: job.id,
        status: 'completed',
        result: job.returnvalue,
      };
    }

    if (state === 'failed') {
      return {
        jobId: job.id,
        status: 'failed',
        error:
          job.failedReason || 'Error desconocido durante el procesamiento.',
      };
    }

    return {
      jobId: job.id,
      status: state,
    };
  }

  async create(dto: CreatePostulacionDto, userId: string) {
    const combinedText = `${dto.title || ''} ${dto.description || ''}`;
    const technologies = extractTechnologies(combinedText);

    const tecnologias = dto.tecnologias ?? technologies;

    return this.prisma.postulacion.create({
      data: {
        url: dto.url,
        title: dto.title,
        description: dto.description,
        company: dto.company,
        rawRequirements: tecnologias,
        tecnologias: tecnologias,
        aniosExperiencia: dto.aniosExperiencia,
        responsabilidades: dto.responsabilidades ?? [],
        tonoEmpresa: dto.tonoEmpresa,
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

  /**
   * Análisis de un LOTE concreto. El denominador son las postulaciones
   * indicadas y no todo el historial del usuario: un porcentaje sin el lote
   * al que corresponde no significa nada.
   *
   * Devuelve los temas del oficio (no las herramientas), su cobertura y las
   * alternativas que cubren cada uno.
   */
  async analisisDeLote(userId: string, ids: string[]) {
    const posts = await this.prisma.postulacion.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, tecnologias: true },
    });

    const total = posts.length;

    if (total === 0) {
      return {
        totalOfertasAnalizadas: 0,
        ecosistema: null,
        coberturaConjunta: 0,
        temas: [],
        sugerenciaAprendizaje:
          'No hay ofertas en este lote para analizar. Agregá al menos una y volvé a intentarlo.',
      };
    }

    const temasPorPost = posts.map((post) => temasDe(post.tecnologias ?? []));

    const conteo = new Map<string, number>();
    for (const temas of temasPorPost) {
      for (const key of temas) {
        conteo.set(key, (conteo.get(key) ?? 0) + 1);
      }
    }

    const temas = [...conteo.entries()]
      .map(([key, cobertura]) => {
        const theme = temaPorKey(key);
        return {
          key,
          label: theme?.label ?? key,
          summary: theme?.summary ?? '',
          alternativas: theme?.alternatives ?? [],
          cobertura,
          porcentaje: Math.round((cobertura / total) * 100),
        };
      })
      .sort(
        (a, b) => b.cobertura - a.cobertura || a.label.localeCompare(b.label),
      );

    const ecosistema = detectarEcosistema(conteo);

    // Los temas que aparecen en la mayoría del lote, y su cobertura conjunta.
    const umbral = Math.ceil(total * 0.6);
    const principales = temas.filter((t) => t.cobertura >= umbral);
    const clavesPrincipales = new Set(principales.map((t) => t.key));
    const cubiertos = temasPorPost.filter((temas) =>
      temas.some((key) => clavesPrincipales.has(key)),
    ).length;
    const coberturaConjunta = Math.round((cubiertos / total) * 100);

    const sugerenciaAprendizaje = principales.length
      ? `Estos ${principales.length} ${principales.length === 1 ? 'tema cubre' : 'temas cubren'} el ${coberturaConjunta}% de las ${total} ofertas del lote. Empezá por ${principales[0].label.toLowerCase()} y entrá por ${principales[0].alternativas.slice(0, 2).join(' o ')}, según lo que ya tengas a mano.`
      : `Este lote pide ${temas.length} oficios distintos y ninguno domina. Revisá las ${total} ofertas y elegí el tipo de trabajo que más te interese antes de armar un plan.`;

    return {
      totalOfertasAnalizadas: total,
      ecosistema,
      coberturaConjunta,
      temas,
      sugerenciaAprendizaje,
    };
  }
}
