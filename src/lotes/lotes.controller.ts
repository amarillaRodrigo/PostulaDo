import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { LotesService } from './lotes.service';

@ApiTags('lotes')
@ApiBearerAuth('access-token')
@Controller('lotes')
@UseGuards(JwtAuthGuard)
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Post()
  @ApiOperation({ summary: 'Save a batch of postings as a named plan' })
  @ApiCreatedResponse({ description: 'Batch saved' })
  async crear(@Body() dto: CrearLoteDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.lotesService.crear(userId, dto.ids, dto.nombre);
  }

  @Get()
  @ApiOperation({ summary: 'List the batches of the authenticated user' })
  @ApiOkResponse({ description: 'Batches, newest first' })
  async listar(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.lotesService.listar(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one batch by id' })
  @ApiOkResponse({ description: 'Batch' })
  async obtener(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.lotesService.obtener(userId, id);
  }
}
