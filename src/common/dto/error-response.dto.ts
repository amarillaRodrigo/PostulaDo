import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * El cuerpo de error de la API, tal como lo arma `ApiExceptionFilter`.
 *
 * `statusCode` dice qué pasó a nivel HTTP; `code` dice qué significa, y es lo
 * que mira el cliente: un 422 `validacion` y un 422 `regla_de_negocio` son
 * cosas distintas, y un `503` `cola_llena` se reintenta con plazo mientras que
 * un `503` `servicio_no_disponible` no. El status no alcanza para distinguir.
 *
 * `message` cambia de forma según quién lo tira:
 *
 * - Una excepción del dominio (`ReglaDeNegocioException`, `NotFoundException`...)
 *   trae un texto que se puede mostrar tal cual.
 * - El `ValidationPipe` trae un **array**: un mensaje por campo que no pasó
 *   la validación.
 *
 * `correlationId` es el mismo que viaja en el header `x-correlation-id` y el
 * que aparece en el log cuando el error fue inesperado.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({
    example: 'validacion',
    description:
      'Qué significa el error, más allá del status. Un 422 puede ser `validacion` o `regla_de_negocio`; un 503 puede ser `cola_llena` o `servicio_no_disponible`.',
  })
  code!: string;

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

  @ApiPropertyOptional({
    description:
      'Datos que el cliente puede accionar, como el campo que chocó con un índice único.',
    example: { campos: ['email'] },
  })
  details?: { campos?: string[] };

  @ApiProperty({
    description:
      'Identificador del pedido, igual al header `x-correlation-id`. Sirve para cruzar el reporte con el log.',
    example: '9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
  })
  correlationId!: string;
}
