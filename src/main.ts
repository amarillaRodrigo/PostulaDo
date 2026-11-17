import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { swaggerConfig } from './common/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.get(PrismaService);

  // El frontend (web/) es una app estatica que corre en otro origen: sin CORS
  // el navegador no puede hablar con la API. Los origenes permitidos se
  // configuran por variable de entorno.
  const allowedOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost:3001,http://127.0.0.1:3001,http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // El `ValidationPipe` y los interceptores están registrados en `AppModule`
  // (`APP_PIPE` y `APP_INTERCEPTOR`), no acá: así los tests e2e usan la misma
  // configuración que producción, sin replicarla a mano.

  const config = swaggerConfig();

  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
