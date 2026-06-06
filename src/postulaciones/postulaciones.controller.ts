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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { PostulacionesService } from './postulaciones.service';
import { AnalyzePostulacionDto } from './dto/analyze-postulacion.dto';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { ListPostulacionesQueryDto } from './dto/list-postulaciones-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('postulaciones')
@Controller('postulaciones')
export class PostulacionesController {
  constructor(private readonly service: PostulacionesService) {}

  @Post('analizar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Analyze a job posting URL and return preview metadata',
  })
  @ApiResponse({ description: 'Preview of the URL' })
  async analyze(@Body() dto: AnalyzePostulacionDto, @Req() req: any) {
    // user must be logged in; we return preview for frontend
    return this.service.analyze(dto.url);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new postulacion for the authenticated user',
  })
  @ApiResponse({ description: 'Postulacion created' })
  async create(@Body() dto: CreatePostulacionDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List postulaciones for the authenticated user' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ description: 'List of postulaciones' })
  async findAll(@Req() req: any, @Query() query: ListPostulacionesQueryDto) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.findAll(userId, query);
  }

  @Get('analisis-aprendizaje')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Analyze application patterns and suggest learning topics',
  })
  @ApiResponse({ description: 'Learning roadmap analysis' })
  async getLearningAnalysis(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.getLearningAnalysis(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get postulacion by id' })
  @ApiResponse({ description: 'Postulacion returned' })
  async findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.findOne(userId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a postulacion' })
  @ApiResponse({ description: 'Postulacion updated' })
  async update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostulacionDto,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.update(userId, id, dto);
  }
}
