import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ReglaDeNegocioException } from '../common/exceptions/regla-de-negocio.exception';
import { PrismaService } from '../prisma.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { ListPostulacionesQueryDto } from './dto/list-postulaciones-query.dto';
import { extractTechnologies } from './helpers/technology-extractor.helper';
import { JobAnalyzerService } from './job-analyzer.service';
import { detectarEcosistema, temaPorKey, temasDe } from '../common/taxonomy';
import { armarRuta } from '../common/ruta';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  COLA_ANALISIS,
  ColaMantenimientoService,
  MAX_COMPLETADOS,
  MAX_FALLIDOS,
  RETENCION_SEGUNDOS,
} from './cola-mantenimiento.service';
import { MarcaTrabajoService } from './marca-trabajo.service';

/**
 * El perfil con el que se analiza cuando el usuario no tiene `profileText`.
 *
 * No es un detalle interno: el resultado del análisis depende de este texto.
 * Dos personas que mandan exactamente el mismo body reciben análisis
 * distintos, y sin esto el cliente no puede explicar por qué.
 */
export const PERFIL_POR_DEFECTO =
  'Desarrollador de software interesado en nuevas tecnologías.';

/** An anonymous job id acts as a capability only for that anonymous job. */
export function identidadAnonimaAnalisis(jobId: string): string {
  return `anon:${jobId}`;
}

/**
 * Cada cuánto consultar el estado de un trabajo.
 *
 * Viaja en el body de la respuesta 202 (`pollAfterMs`), no en un header
 * `Retry-After`: ese header significa "reintentá **esta** request" y el 202
 * no es un reintento — el trabajo ya está encolado, hay que ir a buscar el
 * resultado a otra URL. Un cliente con lógica genérica ("si viene
 * `Retry-After`, espero y reintento lo mismo") reencolaría el análisis cada
 * dos segundos y duplicaría jobs.
 *
 * Dos segundos es un compromise entre la latencia que ve la persona y la
 * carga que le ponemos a la API: el trabajo tarda decenas de segundos en
 * correr, así que preguntar cada 2 s no cambia nada para quien espera y
 * multiplica las consultas de todas las personas que esperan a la vez.
 */
export const INTERVALO_POLLING_MS = 2000;

/**
 * Los campos que devuelve el listado.
 *
 * Lo que la UI necesita y nada más. El detalle completo de una postulación
 * —con `description` y `rawRequirements`— está en `GET /postulaciones/:id`.
 */
const CAMPOS_LISTADO = {
  id: true,
  userId: true,
  url: true,
  title: true,
  company: true,
  status: true,
  tecnologias: true,
  aniosExperiencia: true,
  isArchived: true,
  createdAt: true,
} as const;

/** El cursor de una fila: `<createdAt>|<id>`. */
function cursorDe(fila: { createdAt: Date; id: string }): string {
  return `${fila.createdAt.toISOString()}|${fila.id}`;
}

/**
 * Al revés: el cursor dice "seguí después de esta fila".
 *
 * Un cursor roto es un `422`: se lo pasó el cliente y no tiene sentido
 * seguir con un pedido que no se puede interpretar.
 */
function parsearCursor(cursor: string): { createdAt: Date; id: string } {
  const [createdAt, id] = cursor.split('|');
  const fecha = new Date(createdAt);

  if (!id || Number.isNaN(fecha.getTime())) {
    throw new ReglaDeNegocioException(
      'El cursor de paginación no es válido: se espera `<createdAt>|<id>`.',
    );
  }

  return { createdAt: fecha, id };
}

/**
 * Las filas que están "después" del cursor, con el mismo orden del listado.
 *
 * Con `orderBy createdAt desc, id desc`, lo que viene después es lo que tiene
 * un `createdAt` menor, o el mismo `createdAt` con un `id` menor.
 */
function filasDespuesDe(cursor: { createdAt: Date; id: string }) {
  return [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
  ];
}

@Injectable()
export class PostulacionesService {
  constructor(
    private prisma: PrismaService,
    private jobAnalyzer: JobAnalyzerService,
    private mantenimiento: ColaMantenimientoService,
    private marca: MarcaTrabajoService,
    @InjectQueue(COLA_ANALISIS) private readonly queue: Queue,
  ) {}

  async analyze(url: string, userId?: string) {
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { profileText: true },
        })
      : null;
    const sinPerfil = !user?.profileText;
    const profileText = user?.profileText || PERFIL_POR_DEFECTO;

    // Con el plan free (30 MB) la cola no puede crecer sin techo: si Redis
    // está por llenarse, esto limpia lo terminado o responde 503.
    await this.mantenimiento.asegurarEspacio();

    // El id lo elegimos nosotros y no BullMQ. El que pone BullMQ es un
    // `INCR`: enteros correlativos y enumerables, así que un `GET
    // .../status/1`, `/2`, `/3` recorre la cola entera. Con un UUID no hay
    // nada que enumerar, y el `403` de "este trabajo es de otro" vuelve a
    // poder usarse sin filtrar la existencia de nada.
    const jobId = randomUUID();

    const job = await this.queue.add(
      'analizar-url',
      { url, userId, profileText },
      {
        jobId,
        // Edad y cantidad: lo que sobreviva al día, igual se borra al llegar
        // al tope, para que un pico de tráfico no llene la memoria.
        removeOnComplete: {
          age: RETENCION_SEGUNDOS,
          count: MAX_COMPLETADOS,
        },
        removeOnFail: { age: RETENCION_SEGUNDOS, count: MAX_FALLIDOS },
      },
    );

    // BullMQ siempre asigna id a un trabajo encolado, pero el tipo lo deja
    // opcional. Sin id no hay nada que consultar ni marcar: es un fallo de
    // la cola, no del cliente.
    if (!job.id) {
      throw new InternalServerErrorException(
        'El trabajo se encoló sin identificador: no se puede consultar su estado.',
      );
    }

    // La marca va después del encolado: si `queue.add` falló, ese trabajo
    // nunca existió y no tiene por qué dejar rastro.
    await this.marca.marcar(jobId, userId ?? identidadAnonimaAnalisis(jobId));

    return {
      jobId,
      status: 'queued',
      // El perfil viaja en la respuesta: el resultado depende de él y el
      // cliente necesita poder decirlo.
      profileText,
      perfilPorDefecto: sinPerfil,
      // Cada cuánto consultar. Va en el body, no en `Retry-After`: ese
      // header significa "reintentá esta request" y acá no hay nada que
      // reintentar.
      pollAfterMs: INTERVALO_POLLING_MS,
    };
  }

  /**
   * El estado de un trabajo: solo el dueño puede verlo.
   *
   * Los `jobId` son UUID, así que no hay nada que enumerar y el `403` no
   * filtra la existencia de ningún trabajo. La taxonomía queda:
   *
   *   200  el trabajo existe y es tuyo
   *   403  el trabajo existe (o existió) pero es de otro
   *   410  el trabajo era tuyo pero expiró: hay que reencolarlo
   *   404  ese `jobId` no existió nunca
   *
   * Lo que hay detrás no es un dato cualquiera: el `result` de un trabajo
   * ajeno es el CV optimizado y la carta de presentación de otra persona,
   * construidos con su `profileText`.
   */
  async getJobStatus(userId: string, jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      // El trabajo ya no está en Redis. Puede que nunca existiera, o que se
      // haya purgado (24 h, o al llegar al tope de 200 terminados). La marca
      // dice cuál de los dos es.
      const marca = await this.marca.buscar(jobId);

      if (!marca) {
        throw new NotFoundException('Trabajo de análisis no encontrado');
      }

      if (marca.userId !== userId) {
        throw new ForbiddenException('No autorizado para ver este trabajo');
      }

      // La marca dice que existió. Si su ventana sigue abierta, el trabajo se
      // purgó o fue expulsado por el tope de 200: en los dos casos existió y
      // hay que reencolarlo.
      if (marca.vigente) {
        throw new GoneException(
          'Este trabajo de análisis expiró: los resultados se borran de la cola a las 24 h de terminar. Volvé a encolarlo.',
        );
      }

      throw new NotFoundException('Trabajo de análisis no encontrado');
    }

    const dueñoDelJob = job.data.userId ?? identidadAnonimaAnalisis(jobId);
    if (dueñoDelJob !== userId) {
      throw new ForbiddenException('No autorizado para ver este trabajo');
    }

    const state = await job.getState();

    if (state === 'completed') {
      let resultado = job.returnvalue;

      // BullMQ puede marcar el trabajo como completado un instante antes de
      // que el valor quede legible. Si llega vacío se relee una vez: devolver
      // `null` haría que la landing guarde la oferta con cero tecnologías y
      // ensucie los porcentajes sin avisar.
      if (resultado === null || resultado === undefined) {
        await new Promise((listo) => setTimeout(listo, 250));
        const fresco = await this.queue.getJob(jobId);
        resultado = fresco?.returnvalue;
      }

      if (resultado === null || resultado === undefined) {
        return {
          jobId: job.id,
          status: 'failed',
          error:
            'El análisis terminó sin resultado. Probá de nuevo con esa oferta.',
        };
      }

      return {
        jobId: job.id,
        status: 'completed',
        result: resultado,
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
    // Sin URL hay que pegar el texto de la oferta: es el camino cuando el
    // portal no se puede abrir. Con nada de las dos, no hay nada que analizar.
    if (!dto.url && !dto.title && !dto.description) {
      throw new ReglaDeNegocioException(
        'La oferta necesita una URL o su texto pegado.',
      );
    }

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

  /**
   * Las postulaciones del usuario, paginadas.
   *
   * Devuelve la página, el total de registros que matchean el filtro y el
   * cursor de la página siguiente. El total no es un lujo: es lo que le dice
   * al cliente cuántas páginas hay. Sin él, la única forma de saber que se
   * acabó es que la página vino más corta que el límite, que es una
   * heurística, no un contrato.
   *
   * Hay dos formas de paginar y conviven:
   *
   * - `page`: el desplazamiento clásico. Simple, pero deriva: si entre la
   *   página 1 y la 2 se inserta una postulación, todos los offsets se
   *   corren un lugar y un registro se duplica o se salta.
   * - `cursor`: la posición exacta de la última fila de la página anterior.
   *   No deriva. Cuando viene, `page` se ignora.
   */
  async findAll(userId: string, query: ListPostulacionesQueryDto) {
    const limit = query.limit ?? 10;
    const where: any = { userId };
    if (typeof query.status !== 'undefined') where.status = query.status;
    if (typeof query.isArchived !== 'undefined')
      where.isArchived = query.isArchived;

    // Un cursor es una *posición*, no un filtro: la página siguiente son las
    // filas que están después de la última de la anterior. Por eso no entra
    // en el `count`: el total sigue siendo el del filtro.
    const cursor = query.cursor ? parsearCursor(query.cursor) : null;
    const filasWhere = cursor
      ? { ...where, OR: filasDespuesDe(cursor) }
      : where;

    // El cursor se implementa con un filtro en el `where`, no con el cursor
    // nativo de Prisma: así la fila del cursor ya está excluida de la
    // consulta y no hay que saltarla con `skip`. Con `skip: 1` se perdía una
    // fila real de cada página.
    //
    // Con `page`, en cambio, sí hay que saltar lo que indica la página.
    const skip = cursor ? 0 : ((query.page ?? 1) - 1) * limit;

    // Se pide una fila de más: si viene, es que hay otra página. Es la forma
    // de saberlo sin contar dos veces.
    const [rows, total] = await this.prisma.$transaction(
      [
        this.prisma.postulacion.findMany({
          where: filasWhere,
          // El listado no necesita el texto de la oferta: `description` son
          // miles de caracteres por fila y `rawRequirements` un JSON que
          // nadie mira en una lista. El detalle completo está en
          // `GET /postulaciones/:id`.
          select: CAMPOS_LISTADO,
          take: limit + 1,
          skip,
          // El `id` desempata las que comparten timestamp: sin él, el orden
          // no es determinista y el cursor no significa nada.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.postulacion.count({ where }),
      ],
      // `RepeatableRead` y no el default (`READ COMMITTED`): en `READ
      // COMMITTED` cada query de la transacción ve un snapshot distinto, así
      // que el total puede no coincidir con la página que se armó.
      { isolationLevel: 'RepeatableRead' },
    );

    const items = rows.slice(0, limit);
    const ultima = items[items.length - 1];

    return {
      items,
      total,
      nextCursor: rows.length > limit && ultima ? cursorDe(ultima) : null,
    };
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

    return this.analisisDeTecnologias(
      posts.map((post) => post.tecnologias ?? []),
    );
  }

  /** A non-persistent preview uses the same taxonomy as a saved roadmap. */
  analisisDeTecnologias(tecnologiasPorOferta: string[][]) {
    const total = tecnologiasPorOferta.length;

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

    const temasPorPost = tecnologiasPorOferta.map((tecnologias) =>
      temasDe(tecnologias),
    );

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
    const umbral = Math.ceil(total * 0.6);
    const principales = temas.filter((t) => t.cobertura >= umbral);
    const clavesPrincipales = new Set(principales.map((t) => t.key));
    const cubiertos = temasPorPost.filter((temas) =>
      temas.some((key) => clavesPrincipales.has(key)),
    ).length;
    const coberturaConjunta = Math.round((cubiertos / total) * 100);

    const verbo = principales.length === 1 ? 'cubre' : 'cubren';
    const sujeto =
      principales.length === 1
        ? 'Este tema'
        : `Estos ${principales.length} temas`;
    const cantidadOfertas =
      total === 1 ? 'la 1 oferta del lote' : `las ${total} ofertas del lote`;
    const sugerenciaAprendizaje = principales.length
      ? `${sujeto} ${verbo} el ${coberturaConjunta}% de ${cantidadOfertas}. El orden de estudio —y por dónde empezar— lo decide la ruta.`
      : `Este lote pide ${temas.length} oficios distintos y ninguno domina. Revisá ${total === 1 ? 'la oferta' : `las ${total} ofertas`} y elegí el tipo de trabajo que más te interese antes de armar un plan.`;

    return {
      totalOfertasAnalizadas: total,
      ecosistema,
      coberturaConjunta,
      temas,
      sugerenciaAprendizaje,
    };
  }

  previewDeTexto(texto: string) {
    return this.previewDeTecnologias([extractTechnologies(texto)]);
  }

  previewDeTecnologias(tecnologiasPorOferta: string[][]) {
    const analisis = this.analisisDeTecnologias(tecnologiasPorOferta);
    const conteo = new Map<string, number>();
    for (const tema of analisis.temas) {
      conteo.set(tema.key, tema.cobertura);
    }

    const ruta = analisis.totalOfertasAnalizadas
      ? armarRuta(conteo, analisis.totalOfertasAnalizadas, analisis.ecosistema)
      : { totalOfertasAnalizadas: 0, ecosistema: null, nodos: [] };

    return { analisis, ruta };
  }

  /**
   * El plan sobre todo el corpus: cada oferta no archivada de la cuenta,
   * sin importar el lote. Es la misma mecánica que un lote, con el historial
   * completo como denominador.
   */
  async analisisDeCorpus(userId: string) {
    const propias = await this.prisma.postulacion.findMany({
      where: { userId, isArchived: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (propias.length === 0) {
      return {
        totalOfertasAnalizadas: 0,
        ecosistema: null,
        coberturaConjunta: 0,
        temas: [],
        sugerenciaAprendizaje:
          'Tu cuenta todavía no tiene ofertas guardadas. Analizá las que te interesan y este plan se arma con todas juntas.',
      };
    }

    return this.analisisDeLote(
      userId,
      propias.map((p) => p.id),
    );
  }

  /**
   * La ruta de estudio de un lote: mismos denominadores que el análisis,
   * pero con los temas en orden de estudio según sus prerequisitos.
   * Reusa `analisisDeLote` para heredar el mensaje del lote vacío y el
   * cálculo del conteo sin copiarlo.
   */
  async rutaDeLote(userId: string, ids: string[]) {
    const analisis = await this.analisisDeLote(userId, ids);

    if (!analisis.temas.length) {
      return {
        totalOfertasAnalizadas: 0,
        ecosistema: analisis.ecosistema,
        nodos: [],
      };
    }

    const conteo = new Map<string, number>();
    for (const tema of analisis.temas) {
      conteo.set(tema.key, tema.cobertura);
    }

    return armarRuta(
      conteo,
      analisis.totalOfertasAnalizadas,
      analisis.ecosistema,
    );
  }

  /** La ruta sobre todo el corpus, igual que el plan completo. */
  async rutaDeCorpus(userId: string) {
    const propias = await this.prisma.postulacion.findMany({
      where: { userId, isArchived: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (propias.length === 0) {
      return { totalOfertasAnalizadas: 0, ecosistema: null, nodos: [] };
    }

    return this.rutaDeLote(
      userId,
      propias.map((p) => p.id),
    );
  }
}
