import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { AgregarOfertasDto } from './dto/agregar-ofertas.dto';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { RenombrarLoteDto } from './dto/renombrar-lote.dto';
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

  @Put(':id/nombre')
  @ApiOperation({ summary: 'Rename a batch of the authenticated user' })
  @ApiOkResponse({ description: 'Batch renamed' })
  async renombrar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RenombrarLoteDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.lotesService.renombrar(userId, id, dto.nombre);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a batch of the authenticated user' })
  @ApiOkResponse({ description: 'Batch deleted; postings are kept' })
  async borrar(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.lotesService.borrar(userId, id);
  }

  @Post(':id/ofertas')
  @ApiOperation({ summary: 'Add own postings to a saved batch' })
  @ApiCreatedResponse({ description: 'Batch with the added postings' })
  async agregar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AgregarOfertasDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.lotesService.agregar(userId, id, dto.ids);
  }
}
