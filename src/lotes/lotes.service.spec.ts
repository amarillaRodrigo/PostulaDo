import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LotesService } from './lotes.service';

const mockPrisma = {
  postulacion: { findMany: jest.fn() },
  lote: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('LotesService', () => {
  let service: LotesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LotesService>(LotesService);
  });

  describe('crear', () => {
    it('guarda solo las ofertas que pertenecen a la persona', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { id: 'a' },
        { id: 'b' },
      ]);
      mockPrisma.lote.create.mockResolvedValueOnce({ id: 'lote-1' });

      await service.crear('user-1', ['a', 'b', 'ajena'], 'Backend');

      expect(mockPrisma.postulacion.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', id: { in: ['a', 'b', 'ajena'] } },
        select: { id: true },
      });
      expect(mockPrisma.lote.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', nombre: 'Backend', ids: ['a', 'b'] },
      });
    });

    it('rechaza un lote sin ofertas propias', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);

      await expect(service.crear('user-1', ['ajena'])).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.lote.create).not.toHaveBeenCalled();
    });

    it('normaliza un nombre vacío a null', async () => {
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([{ id: 'a' }]);
      mockPrisma.lote.create.mockResolvedValueOnce({ id: 'lote-1' });

      await service.crear('user-1', ['a'], '   ');

      expect(mockPrisma.lote.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', nombre: null, ids: ['a'] },
      });
    });
  });

  describe('obtener', () => {
    it('rechaza un lote de otra persona', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'otro',
      });

      await expect(service.obtener('user-1', 'lote-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFound si no existe', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce(null);

      await expect(service.obtener('user-1', 'lote-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
