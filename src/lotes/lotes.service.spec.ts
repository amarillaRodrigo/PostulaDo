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
    update: jest.fn(),
    delete: jest.fn(),
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

  describe('renombrar', () => {
    it('renombra y normaliza un nombre vacío a null', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'user-1',
        ids: ['a'],
      });
      mockPrisma.lote.update.mockResolvedValueOnce({
        id: 'lote-1',
        nombre: null,
      });

      await service.renombrar('user-1', 'lote-1', '   ');

      expect(mockPrisma.lote.update).toHaveBeenCalledWith({
        where: { id: 'lote-1' },
        data: { nombre: null },
      });
    });

    it('no deja renombrar el lote de otro', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'otro',
      });

      await expect(service.renombrar('user-1', 'lote-1', 'X')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.lote.update).not.toHaveBeenCalled();
    });
  });

  describe('borrar', () => {
    it('borra el lote propio', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'user-1',
      });
      mockPrisma.lote.delete.mockResolvedValueOnce({ id: 'lote-1' });

      await expect(service.borrar('user-1', 'lote-1')).resolves.toEqual({
        borrado: true,
        id: 'lote-1',
      });

      expect(mockPrisma.lote.delete).toHaveBeenCalledWith({
        where: { id: 'lote-1' },
      });
    });

    it('no deja borrar el lote de otro', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'otro',
      });

      await expect(service.borrar('user-1', 'lote-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.lote.delete).not.toHaveBeenCalled();
    });
  });

  describe('agregar', () => {
    it('agrega al final solo las que no estaban', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'user-1',
        ids: ['a', 'b'],
      });
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { id: 'b' },
        { id: 'c' },
      ]);
      mockPrisma.lote.update.mockResolvedValueOnce({
        id: 'lote-1',
        ids: ['a', 'b', 'c'],
      });

      await service.agregar('user-1', 'lote-1', ['b', 'c', 'ajena']);

      expect(mockPrisma.lote.update).toHaveBeenCalledWith({
        where: { id: 'lote-1' },
        data: { ids: ['a', 'b', 'c'] },
      });
    });

    it('rechaza si ninguna oferta es propia', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'user-1',
        ids: ['a'],
      });
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([]);

      await expect(
        service.agregar('user-1', 'lote-1', ['ajena']),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.lote.update).not.toHaveBeenCalled();
    });

    it('devuelve el lote sin tocarlo si ya tiene esas ofertas', async () => {
      const lote = { id: 'lote-1', userId: 'user-1', ids: ['a', 'b'] };
      mockPrisma.lote.findUnique.mockResolvedValueOnce(lote);
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([{ id: 'a' }]);

      await expect(service.agregar('user-1', 'lote-1', ['a'])).resolves.toBe(
        lote,
      );
      expect(mockPrisma.lote.update).not.toHaveBeenCalled();
    });

    it('rechaza el paso que llevaría el lote por encima del tope', async () => {
      mockPrisma.lote.findUnique.mockResolvedValueOnce({
        id: 'lote-1',
        userId: 'user-1',
        ids: Array.from({ length: 49 }, (_, i) => `id-${i}`),
      });
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { id: 'x' },
        { id: 'y' },
      ]);

      await expect(
        service.agregar('user-1', 'lote-1', ['x', 'y']),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.lote.update).not.toHaveBeenCalled();
    });
  });
});
