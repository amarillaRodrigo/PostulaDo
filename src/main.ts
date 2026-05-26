import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { StripPasswordInterceptor } from './common/interceptors/strip-password.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.get(PrismaService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor(), new StripPasswordInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
