import { UnprocessableEntityException } from '@nestjs/common';

/**
 * El pedido se entendió y pasó las validaciones de forma, pero una regla
 * del dominio impide procesarlo.
 *
 * La frontera con `BadRequestException` (400) es esta:
 *
 * - **400**: no pude parsear el pedido. El body es JSON roto, no hay
 *   Content-Type válido, el path tiene un percent-encoding inválido. Lo
 *   detecta el body-parser de Express, antes de que la app vea el pedido.
 * - **422**: pude parsear el pedido y pude entenderlo, pero su contenido no
 *   cumple las reglas: el mail no tiene forma de mail, el lote apunta a
 *   ofertas que no son tuyas, al lote le faltan ofertas.
 * - **409**: el pedido es válido y entendible, pero choca con el estado
 *   actual del mundo (ese mail ya está registrado).
 *
 * Se usa `422` y no `400` para las reglas de negocio porque un `400` en el
 * log no distingue "el cliente mandó algo que ni se puede parsear" de "el
 * cliente mandó algo bien formado pero que yo no puedo procesar".
 * Con 422 la distinction es visible de un vistazo.
 */
export class ReglaDeNegocioException extends UnprocessableEntityException {}
