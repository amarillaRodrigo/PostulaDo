import { ApiProperty } from '@nestjs/swagger';

/**
 * Respuesta de `POST /postulaciones/analizar`.
 *
 * El trabajo no se ejecuta acá: se encola y el cliente sondea
 * `GET /postulaciones/analizar/status/:jobId` hasta que el estado pase a
 * `completed` (o `failed`).
 */
export class AnalizarResponseDto {
  @ApiProperty({
    example: '9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
    description: 'ID del trabajo en la cola. Es un UUID: opaco, no enumerable.',
  })
  jobId!: string;

  @ApiProperty({
    example: 'queued',
    description: 'El trabajo fue encolado; todavía no corrió',
  })
  status!: string;

  @ApiProperty({
    example: 'Desarrollador backend con 3 años de TypeScript y NestJS.',
    description:
      'El perfil con el que se va a analizar la oferta. Si el usuario no tiene `profileText`, es el perfil genérico por defecto: por eso el resultado depende de un dato que no viene en el request.',
  })
  profileText!: string;

  @ApiProperty({
    example: false,
    description:
      '`true` si se usó el perfil genérico por defecto porque el usuario no tiene `profileText`. El cliente puede avisarle que el análisis se hizo sin su perfil.',
  })
  perfilPorDefecto!: boolean;

  @ApiProperty({
    example: 2000,
    description:
      'Espera mínima en milisegundos entre consultas de estado. El cliente puede sumar jitter. Va en el body y no en un header `Retry-After` a propósito: `Retry-After` significa "reintentá esta request" y acá la request ya fue aceptada.',
  })
  pollAfterMs!: number;
}
