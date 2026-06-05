import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'fs';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Postulado API')
    .setDescription('API para la gestión de usuarios y postulaciones')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/openapi.json', JSON.stringify(document, null, 2), 'utf8');

  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});