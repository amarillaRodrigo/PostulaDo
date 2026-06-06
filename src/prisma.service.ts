import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prefer using PrismaPg adapter when a Postgres URL is present.
    const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (url && url.startsWith('postgres')) {
      const adapter = new PrismaPg({ connectionString: url });
      super({ adapter });
    } else {
      // Fallback for local development / SQLite-based config
      super();
    }
  }

  async onModuleInit() {
    if (process.env.SWAGGER_GEN === 'true') {
      return;
    }
    try {
      await this.$connect();
    } catch (err) {
      console.warn(
        '⚠️ No se pudo conectar a la base de datos PostgreSQL al iniciar.',
      );
      console.warn(
        'La API seguirá ejecutándose pero las consultas a la base de datos fallarán hasta que configures una base de datos PostgreSQL válida.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
