import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = {
    get: jest.fn().mockReturnValue('a'.repeat(48)),
  } as unknown as ConfigService;
  const findFirst = jest.fn();
  const prisma = {
    refreshToken: { findFirst },
  } as unknown as PrismaService;
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(config, prisma);
  });

  it('solo acepta JWT ligado a una familia activa y toma el rol actual', async () => {
    findFirst.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'current@example.com', role: 'USER' },
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: 'family-1',
        email: 'stale@example.com',
        role: 'ADMIN',
      }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'current@example.com',
      role: 'USER',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        familyId: 'family-1',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: { user: { select: { id: true, email: true, role: true } } },
    });
  });

  it('rechaza tokens sin sid o con una familia revocada/inexistente', async () => {
    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: '',
        email: 'user@example.com',
        role: 'USER',
      }),
    ).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();

    findFirst.mockResolvedValueOnce(null);
    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: 'revoked-family',
        email: 'user@example.com',
        role: 'USER',
      }),
    ).resolves.toBeNull();
  });
});
