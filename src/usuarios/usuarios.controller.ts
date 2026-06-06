import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  ParseUUIDPipe,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { PublicUserDto } from './dto/public-user.dto';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import type { User as UserModel } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserOwnerGuard } from '../auth/guards/user-owner.guard';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  private withoutPassword(user: UserModel): Omit<UserModel, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...publicUser } = user;
    return publicUser;
  }

  private withoutPasswordOrNull(
    user: UserModel | null,
  ): Omit<UserModel, 'password'> | null {
    if (!user) {
      return null;
    }

    return this.withoutPassword(user);
  }

  private withoutPasswordList(users: UserModel[]) {
    return users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...publicUser } = user;
      return publicUser;
    });
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiOkResponse({ description: 'User returned', type: PublicUserDto })
  @UseGuards(JwtAuthGuard, UserOwnerGuard)
  async getUserById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Omit<UserModel, 'password'> | null> {
    return this.withoutPasswordOrNull(await this.usuariosService.user({ id }));
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List users (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({
    description: 'List of users',
    type: PublicUserDto,
    isArray: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<Omit<UserModel, 'password'>[]> {
    return this.withoutPasswordList(
      await this.usuariosService.users({
        take: limit,
        skip: (page - 1) * limit,
      }),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ description: 'User created', type: PublicUserDto })
  async createUser(
    @Body() dto: CreateUsuarioDto,
  ): Promise<Omit<UserModel, 'password'>> {
    return this.withoutPassword(await this.usuariosService.createUser(dto));
  }

  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update your user' })
  @ApiOkResponse({ description: 'User updated', type: PublicUserDto })
  @UseGuards(JwtAuthGuard, UserOwnerGuard)
  async updateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUsuarioDto,
  ): Promise<Omit<UserModel, 'password'>> {
    return this.withoutPassword(
      await this.usuariosService.updateUser({ where: { id }, data: dto }),
    );
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a user (admin)' })
  @ApiOkResponse({ description: 'User deleted', type: PublicUserDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Omit<UserModel, 'password'>> {
    return this.withoutPassword(await this.usuariosService.deleteUser({ id }));
  }
}
