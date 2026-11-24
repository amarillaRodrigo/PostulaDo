import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { VerifiedEmailGuard } from './verified-email.guard';

describe('VerifiedEmailGuard', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  const request = { user: { id: 'user-1' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
  let guard: VerifiedEmailGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new VerifiedEmailGuard(prisma);
  });

  it('permite guardar con correo confirmado', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      emailVerifiedAt: new Date(),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rechaza guardar antes de confirmar el correo', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      emailVerifiedAt: null,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
