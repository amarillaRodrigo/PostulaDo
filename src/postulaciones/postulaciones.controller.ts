import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  identidadAnonimaAnalisis,
  PostulacionesService,
} from './postulaciones.service';
import { AnalyzePostulacionDto } from './dto/analyze-postulacion.dto';
import { AnalizarResponseDto } from './dto/analizar-response.dto';
import { EstadoAnalisisResponseDto } from './dto/estado-analisis-response.dto';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { ListPostulacionesQueryDto } from './dto/list-postulaciones-query.dto';
import { PreviewRoadmapDto } from './dto/preview-roadmap.dto';
import { PreviewTextoDto } from './dto/preview-texto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { VerifiedEmailGuard } from '../auth/guards/verified-email.guard';

@ApiTags('postulaciones')
@Controller('postulaciones')
export class PostulacionesController {
  constructor(private readonly service: PostulacionesService) {}

  @Post('preview-roadmap')
  @ApiOperation({
    summary:
      'Build a non-persistent roadmap preview from analyzed technologies',
  })
  previewRoadmap(@Body() dto: PreviewRoadmapDto) {
    return this.service.previewDeTecnologias(
      dto.ofertas.map((oferta) => oferta.tecnologias),
    );
  }

  @Post('preview-texto')
  @ApiOperation({ summary: 'Build a non-persistent roadmap from pasted text' })
  previewTexto(@Body() dto: PreviewTextoDto) {
    return this.service.previewDeTexto(dto.texto);
  }

  @Post('analizar')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Queue a job posting URL for asynchronous analysis',
    description: [
      'Encola el análisis de la oferta y devuelve `202 Accepted`: el trabajo todavía no corrió.',
      '',
      'La respuesta trae lo que el cliente necesita y antes tenía que adivinar:',
      '- `jobId`: el identificador del trabajo (un UUID).',
      '- `Location`: la URL donde consultar el estado (`GET /postulaciones/analizar/status/:jobId`).',
      '- `pollAfterMs`: cuántos milisegundos esperar entre consultas.',
      '',
      'El intervalo de polling va en el body y no en el header `Retry-After`:',
      '`Retry-After` significa "reintentá **esta** request" y acá no hay nada que',
      'reintentar — el trabajo ya está encolado. Un cliente con lógica genérica que',
      'reintenta lo mismo en cada `Retry-After` duplicaría jobs.',
      '',
      'La autenticación es opcional: con sesión usa el `profileText` del usuario; sin sesión usa un perfil genérico.',
      'El resultado es un preview. Guardar ofertas y roadmaps requiere una cuenta con correo confirmado.',
    ].join('\n'),
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description:
      'Trabajo encolado. Trae `jobId` y `pollAfterMs` en el body, y `Location` (dónde consultar) en los headers.',
    type: AnalizarResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      'La cola de análisis está llena (Redis cerca del tope de memoria del plan) y no se pudo encolar. Es transitorio: reintentá con backoff. El header `Retry-After` dice cada cuántos segundos.',
  })
  async analyze(
    @Body() dto: AnalyzePostulacionDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    const encolado = await this.service.analyze(dto.url, userId);

    // 202: el trabajo no terminó, se encoló. Le decimos al cliente dónde
    // preguntar. Cada cuánto está en el body (`pollAfterMs`), no en un
    // `Retry-After`: ese header pide reintentar esta misma request, y acá
    // la request ya fue aceptada.
    res.setHeader(
      'Location',
      `/postulaciones/analizar/status/${encolado.jobId}`,
    );

    return encolado;
  }

  @Get('analizar/status/:jobId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Check the status and retrieve results of an analysis job',
    description: [
      'Devuelve el estado del trabajo: `waiting`, `active`, `completed` o `failed`.',
      '',
      'Los trabajos autenticados solo los consulta su dueño. Para previews anónimos, el UUID funciona como credencial de consulta:',
      'compartilo solo con quien deba ver el resultado. Un `403` no revela datos del trabajo ajeno.',
      '',
      'La ventana de consulta es finita: los trabajos terminados se borran de Redis a las',
      '24 h de terminar, o antes si se supera el tope de 200 trabajos completados.',
      'Después de eso, `410` dice que el trabajo existió pero expiró y hay que encolarlo',
      'de nuevo.',
    ].join('\n'),
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estado del trabajo y, si terminó bien, el resultado.',
    type: EstadoAnalisisResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'El trabajo existe (o existió), pero pertenece a otro usuario autenticado; no se entrega su resultado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'No existe ningún trabajo con ese `jobId`: nunca se encoló, o su marca de vida ya venció.',
  })
  @ApiResponse({
    status: HttpStatus.GONE,
    description:
      'El trabajo existió pero expiró: los resultados se purgan de la cola a las 24 h de terminar (o antes, al superar el tope de 200 completados). Hay que encolar el análisis de nuevo.',
  })
  async getStatus(@Req() req: any, @Param('jobId') jobId: string) {
    const userId =
      req.user?.sub ?? req.user?.id ?? identidadAnonimaAnalisis(jobId);
    return this.service.getJobStatus(userId, jobId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new postulacion for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Postulacion created',
  })
  async create(@Body() dto: CreatePostulacionDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List postulaciones for the authenticated user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of postulaciones',
    headers: {
      'X-Total-Count': {
        description:
          'Total de postulaciones que matchean el filtro, no las de esta página. Con este número el cliente sabe cuántas páginas hay y no tiene que adivinar por el tamaño de la respuesta.',
        schema: { type: 'integer', example: 347 },
      },
      'X-Next-Cursor': {
        description:
          'Cursor de la página siguiente. Viene solo si hay más: el cliente lo devuelve tal cual en el query param `cursor`. Con cursor el listado no se duplica ni se saltea aunque se agreguen ofertas en el medio.',
        schema: {
          type: 'string',
          example:
            '2026-11-18T12:00:00.000Z|9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
        },
      },
      'Cache-Control': {
        description:
          'La lista es de un recurso por usuario y cambia cuando el usuario la edita: no se cachea. Se declara explícitamente porque hoy no cachearse es un efecto del default de HTTP ante un `Authorization`, no una decisión.',
        schema: { type: 'string', example: 'private, no-store' },
      },
    },
  })
  async findAll(
    @Req() req: any,
    @Query() query: ListPostulacionesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    const { items, total, nextCursor } = await this.service.findAll(
      userId,
      query,
    );

    res.setHeader('X-Total-Count', String(total));
    // La lista es de una sesión y caduca con ella. Sin esto no se cachea
    // por el default de HTTP ante un `Authorization`, no porque alguien lo
    // haya decidido.
    res.setHeader('Cache-Control', 'private, no-store');

    if (nextCursor) {
      res.setHeader('X-Next-Cursor', nextCursor);
    }

    // El body sigue siendo un array pelado: el total y el cursor van en los
    // headers para no romper a los que ya consumen esta respuesta.
    return items;
  }

  @Get('analisis-aprendizaje')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Analyze application patterns and suggest learning topics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Learning roadmap analysis',
  })
  async getLearningAnalysis(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.getLearningAnalysis(userId);
  }

  @Get('analisis-lote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Analyze a specific batch of postulaciones (the denominator is the batch)',
  })
  @ApiResponse({
    description: 'Batch analysis with themes, coverage and alternatives',
  })
  async getLoteAnalysis(
    @Req() req: any,
    @Query('ids') ids: string | undefined,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    const list = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    // Sin ids explícitos, el lote es el corpus entero: todas las ofertas no
    // archivadas de la cuenta. Es el plan global que la UI llama "Tu plan
    // completo".
    if (list.length === 0) {
      return this.service.analisisDeCorpus(userId);
    }

    return this.service.analisisDeLote(userId, list);
  }

  @Get('analisis-ruta')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Learning route for a batch (or the whole corpus): temas in study order with prerequisites',
  })
  @ApiResponse({
    description:
      'Route nodes topologically ordered, with sources and honest denominators',
  })
  async getRutaAnalysis(
    @Req() req: any,
    @Query('ids') ids: string | undefined,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    const list = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    // Misma convención que analisis-lote: sin ids, la ruta aprende del corpus.
    if (list.length === 0) {
      return this.service.rutaDeCorpus(userId);
    }

    return this.service.rutaDeLote(userId, list);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get postulacion by id' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Postulacion returned',
  })
  async findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.findOne(userId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a postulacion' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Postulacion updated',
  })
  async update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostulacionDto,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.update(userId, id, dto);
  }
}
