process.env.SWAGGER_GEN = 'true';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dummy-secret';

import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'fs';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { swaggerConfig } from '../src/common/swagger.config';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = swaggerConfig();

  const document = SwaggerModule.createDocument(app, config);

  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/openapi.json', JSON.stringify(document, null, 2), 'utf8');

  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});