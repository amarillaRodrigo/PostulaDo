/**
 * El nombre de la cola de análisis. BullMQ lo usa para las claves en Redis.
 *
 * Vive en su propio archivo para no crear un ciclo de imports: el servicio
 * de mantenimiento importa al de marcas (que lo necesita para inyectar la
 * cola) y el de marcas necesita este nombre. Si la constante estuviera en el
 * servicio de mantenimiento, los dos módulos se importarían mutuamente y el
 * token de la cola llegaría `undefined` al decorador `@InjectQueue`.
 */
export const COLA_ANALISIS = 'analisis-trabajo';
