import { ApiProperty } from '@nestjs/swagger';

/**
 * Cuerpo de error que devuelve Nest.
 *
 * `message` cambia de forma según quién lo tira:
 *
 * - Una excepción del dominio (`ReglaDeNegocioException`, `GoneException`,
 *   `NotFoundException`...) trae un texto que se puede mostrar tal cual.
 * - El `ValidationPipe` trae un **array**: un mensaje por campo que no pasó
 *   la validación.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [
      {
        type: 'string',
        example: 'La oferta necesita una URL o su texto pegado.',
      },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email'],
      },
    ],
  })
  message!: string | string[];

  @ApiProperty({ example: 'Unprocessable Entity' })
  error!: string;
}
