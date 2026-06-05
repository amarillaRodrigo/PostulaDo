import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prefer using PrismaPg adapter when a Postgres URL is present.
    const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (url && url.startsWith('postgres')) {
      const adapter = new PrismaPg({ connectionString: url });
      super({ adapter } as any);
    } else {
      throw new Error(
        'PrismaService requires a Postgres DATABASE_URL at runtime. Set DATABASE_URL to a postgres://... URL (used by CI). For local SQLite-based generation use `npx prisma generate` only.',
      );
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
