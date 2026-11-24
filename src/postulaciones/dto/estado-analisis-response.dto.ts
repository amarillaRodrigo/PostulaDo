import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Respuesta de `GET /postulaciones/analizar/status/:jobId`.
 *
 * Un solo tipo para los cuatro estados: lo que cambia entre ellos es qué
 * campos vienen, no la forma de la respuesta.
 */
export class EstadoAnalisisResponseDto {
  @ApiProperty({ example: '1' })
  jobId!: string;

  @ApiProperty({
    example: 'waiting',
    enum: ['waiting', 'active', 'completed', 'failed'],
    description:
      '`waiting`: en la cola, todavía sin empezar. `active`: corriendo. `completed`: terminado con resultado. `failed`: terminó con error.',
  })
  status!: string;

  @ApiPropertyOptional({
    description:
      'Solo cuando `status` es `completed`: el informe estructurado de la oferta.',
    type: 'object',
    additionalProperties: true,
  })
  result?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Solo cuando `status` es `failed`: por qué falló.',
    example: 'No pudimos acceder a la oferta.',
  })
  error?: string;
}
