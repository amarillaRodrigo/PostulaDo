import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { StripPasswordInterceptor } from './common/interceptors/strip-password.interceptor';

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new StripPasswordInterceptor(),
  );

  const config = new DocumentBuilder()
    .setTitle('Postulado API')
    .setDescription('API para la gestión de usuarios y postulaciones')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
