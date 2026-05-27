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
import { PostulacionesService } from './postulaciones.service';
import { AnalyzePostulacionDto } from './dto/analyze-postulacion.dto';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { UpdatePostulacionDto } from './dto/update-postulacion.dto';
import { ListPostulacionesQueryDto } from './dto/list-postulaciones-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('postulaciones')
export class PostulacionesController {
  constructor(private readonly service: PostulacionesService) {}

  @Post('analizar')
  @UseGuards(JwtAuthGuard)
  async analyze(@Body() dto: AnalyzePostulacionDto, @Req() req: any) {
    // user must be logged in; we return preview for frontend
    return this.service.analyze(dto.url);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreatePostulacionDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: any, @Query() query: ListPostulacionesQueryDto) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.findAll(userId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.findOne(userId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostulacionDto,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.service.update(userId, id, dto);
  }
}
