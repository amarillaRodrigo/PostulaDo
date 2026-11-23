import { HttpStatus, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PostulacionesModule } from './postulaciones/postulaciones.module';
import { LotesModule } from './lotes/lotes.module';
import { MailModule } from './mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { BullModule } from '@nestjs/bullmq';
import { redisConnection } from './common/redis.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { StripPasswordInterceptor } from './common/interceptors/strip-password.interceptor';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnection(configService),
      }),
      inject: [ConfigService],
    }),
    UsuariosModule,
    PostulacionesModule,
    LotesModule,
    MailModule,
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // La configuración global de la app vive acá y no en `main.ts`.
    //
    // Si vive en `main.ts`, cada test tiene que replicarla a mano y el
    // contrato de validación de los e2e deja de ser el de producción: los
    // tests mienten. Con `APP_PIPE` y `APP_INTERCEPTOR` cualquier consumidor
    // de `AppModule` —los tests, un script, el server— recibe lo mismo.
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          // El body llegó bien formado (si el JSON estaba roto, Nest ya
          // devolvió 400 desde el body-parser, antes de llegar a este pipe)
          // pero no cumple el schema: 422, no 400.
          //   400 = no pude parsear el pedido.
          //   422 = pude parsearlo y entenderlo, pero su contenido no es válido.
          //   409 = el pedido es válido pero choca con el estado actual.
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StripPasswordInterceptor,
    },
    // El cuerpo de error de toda la API (status + `code` + `correlationId`) y
    // el `Retry-After` del 503 salen del mismo filtro: Nest usa el primer
    // filtro cuyo `@Catch` matchea, así que dos filtros que atrapen
    // `HttpException` harían que el envelope nunca se aplique. Va en
    // `AppModule` y no en `main.ts` por lo mismo que los pipes: los tests e2e
    // tienen que ver el mismo contrato que producción.
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
