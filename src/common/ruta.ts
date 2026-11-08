/**
 * LA RUTA DEL OFICIO
 *
 * El plan de la cuenta dice QUÉ temas pide el mercado del usuario y en cuánto
 * le falta. La ruta dice EN QUÉ ORDEN: un grafo curado a mano de prerequisitos
 * entre temas, ordenado topológicamente para que "empezá acá" sea una
 * afirmación con argumento y no un decorado.
 *
 * Nada de esto se consulta a un LLM ni se inventa en vivo: los prerequisitos
 * son decisiones de producto versionadas acá (y corregidas con un commit si
 * alguna está mal), y las fuentes son documentos reales de las alternativas
 * que cada tema ya declara. Lo que sí sale del corpus del usuario es el resto:
 * cuántas ofertas piden cada tema y qué cobertura tiene — los mismos
 * denominadores del plan.
 */

import { temaPorKey } from './taxonomy';

export interface Fuente {
  titulo: string;
  url: string;
  tipo: 'docs' | 'tutoriales';
}

/**
 * EL PLAN DE CADA TEMA
 *
 * Las fuentes dicen dónde leer; esto dice QUÉ CONSTRUIR. Un entregable real
 * (lo que queda en el portfolio), los pasos en orden concreto y una carga de
 * horas estimada. Vendor-neutral igual que los temas: los pasos hablan de "el
 * framework que uses", no de un producto — la alternativa concreta la elige
 * la persona, y la documentación está en `FUENTES`, plegada en el UI.
 *
 * Es contenido versionado como los prerequisitos: se corrige con un commit.
 */
export interface PlanTema {
  /** El entregable tal como lo describe una persona que lo tiene hecho. */
  objetivo: string;
  /**
   * Los pasos, en el orden en que se hacen. Cada uno es una acción verificable
   * ("levantá el esqueleto con 2 endpoints"), no un capítulo de documentación.
   */
  pasos: string[];
  /**
   * Estimación de esfuerzo total del entregable, en horas. Es la estimación
   * del producto con sus propias palabras, no un dato del mercado.
   */
  horas: number;
}

export const PLAN: Record<string, PlanTema> = {
  backend: {
    objetivo:
      'Una API que resuelve un dominio propio: modelado de datos, un CRUD con reglas de negocio, contrato de errores y un README que otra persona puede seguir solo.',
    horas: 20,
    pasos: [
      'Elegí un recurso de un dominio que entiendas (turnos, reclamos, gastos compartidos) y modelá sus datos: 4-6 campos con validaciones.',
      'Levantá el esqueleto del API con el framework de tu alternativa y exponé el CRUD completo del recurso: get / list / create con códigos 200, 201, 400 y 404 correctos.',
      'Agregá una regla de negocio que no sea CRUD: un límite, un estado, un único dueño. El CRUD solo no es un oficio.',
      'Manejá los errores de entrada: si te mandan un email inválido, la API responde con un error entendible en lugar de colgarse.',
      'Escribí pruebas del contrato: al menos un caso feliz y uno de error por endpoint, corriendo con un solo comando.',
      'Escribí el README: cómo levantar tu API, cómo probarla y qué decisiones tomaste. Si otra persona no puede correrlo sin preguntarte, el entregable no está.',
    ],
  },
  frontend: {
    objetivo:
      'Una pantalla real y usable que consume tu API: estados de cargando/error/éxito, validación de formulario y alguien más usándola sin ayuda.',
    horas: 15,
    pasos: [
      'Reproducí la pantalla más simple que uses todos los días (una grilla y un formulario) con datos fijos, sin backend.',
      'Escribí los tres estados de la pantalla antes de conectar nada: cargando, error, éxito. Una pantalla sin estados es una vista de laboratorio.',
      'Conectá la pantalla a tu API (o a una doble con la misma forma) y mostrá datos reales en la grilla.',
      'Validá el formulario con mensajes que una persona entienda sin ayuda.',
      'Hacé la pantalla usable solo con teclado, con las pestañas en orden y el foco visible.',
      'Hacé que alguien la use: si no entiende algo visible sin que se lo expliques, es un bug de UI.',
    ],
  },
  testing: {
    objetivo:
      'El entregable previo con una suite que lo mata sin nada a mano: pruebas de unidad y una end-to-end que toma un flujo completo, corriendo en un comando.',
    horas: 10,
    pasos: [
      'Tomá el entregable anterior (o tu proyecto) y escribí la primera prueba de una unidad con la librería de tu alternativa.',
      'Elegí el caso de error que hoy te daría más miedo en producción (entrada corrupta, doble envío, recurso inexistente) y cubrilo primero.',
      'Escribí una prueba end-to-end de la vida completa de tu recurso: se crea, se usa, se rechaza lo inválido, se elimina.',
      'Hacé que la suite corra con un solo comando y que una prueba rota deje el build en rojo.',
      'Mirá la suite andar una vez completa: la primera corrida verde es el entregable, no el bypass.',
    ],
  },
  containers: {
    objetivo:
      'Tu API corriendo en contenedores: imagen con versión, app + base de datos con compose, y levantar todo desde cero en cualquier máquina con un comando.',
    horas: 8,
    pasos: [
      'Escribí el Dockerfile de tu API: multi-stage, imagen chica, sin pasos manuales.',
      'Levantá tu API y tu base de datos con docker compose: volúmenes, variables de entorno, la base no queda en el host de nadie.',
      'Versioná tu imagen (build + tag con el commit) y documentá en el README cómo correr la versión exacta que tenés desplegada.',
      'Probá la reproducibilidad: docker compose down -v && up y todo levanta igual; si no, topaste un "en mi máquina" andando.',
      'Verificá que la API responde desde el contenedor, no del host: probala desde otro shell ya con el compose arriba.',
    ],
  },
  ci: {
    objetivo:
      'El pipeline de tu repo: push → pruebas automáticas → build de la imagen. Un rojo real y un significado de cada estado documentado.',
    horas: 6,
    pasos: [
      'Meté al runner de tu host (GitHub Actions, GitLab CI u otro) que corra tu suite al hacer push.',
      'Hacé que un paso fallando rompa el build: el rojo, no el verde mentiroso.',
      'Agregá al mismo pipeline el build de la imagen (y el push al registro, si ya tenés uno).',
      'Hacé fallar el pipeline a propósito: rompé una prueba y mirá qué pasa en el repo.',
      'Documentá en el README qué significa cada estado del pipeline en tu repo.',
    ],
  },
  cloud: {
    objetivo:
      'Tu API desplegada en la nube de tu alternativa, con configuración como código, un rollback probado y una URL que puedas dar de alta en tu CV.',
    horas: 12,
    pasos: [
      'Desplegá tu API contenerizada en un tier gratuito o barato de la nube de tu alternativa, con URL absoluta.',
      'Guardá la infraestructura como código o como una secuencia de pasos reproducible: si solo te lo acordás, no está desplegado.',
      'Verificá en producción una variable de entorno real (la base de datos, un token) — no tu localhost.',
      'Observá tu despliegue por primera vez: qué hace, qué consume, cómo despertarse cuando el tier gratuito lo duerme.',
      'Probá el rollback: desplegá una versión, revertí a la anterior y medí el tiempo. Si tarda más de 5 minutos, practicalo.',
    ],
  },
  data: {
    objetivo:
      'Tu API con un esquema de datos de verdad: relaciones, restricciones, tres consultas que piden joins y un índice con mejora medida antes y después.',
    horas: 12,
    pasos: [
      'Agregá a tu dominio una segunda entidad con relación de verdad a la primera: claves foráneas y restricciones, no solo ids.',
      'Escribí tres consultas que necesiten join o agregación (ranking, resumen, un detalle de varias entidades).',
      'Medí una con el explain del motor: mirá qué plan de ejecución armó antes de optimizar nada.',
      'Agregá un índice donde el explain te lo pida y medí otra vez la misma consulta.',
      'Dejá en el README la mejora antes/después con los dos números, no una interpretación.',
    ],
  },
  cache: {
    objetivo:
      'Tu API con el cache de tu alternativa sobre su endpoint más repetido: TTL, invalidación y la diferencia de antes/después representada en un número.',
    horas: 8,
    pasos: [
      'Elegí en tu API el endpoint que más se repite y no tolera re-cálculo pesado: ese es el candidato a cachear.',
      'Agregá la capa del cache de tu alternativa con un TTL explícito y la clave de cache bien armada.',
      'Verificá en producción que el cache salta: medí cuánto tarda con y sin.',
      'Escribí qué pasa cuando el dato de base cambia: la regla de invalidación que elegiste y qué riesgo aceptás mientras tanto.',
      'Medí el endpoint con cache una decena de veces: la mejora antes y después, con número, en el README.',
    ],
  },
};

/**
 * Prerequisitos del oficio: para aprender el tema `key` hace falta, al menos,
 * algo de cada tema de su lista. Las listas vacías son las raíces de la ruta:
 * la del usuario empieza ahí — "empezá acá" en el UI sale de esta lista.
 *
 * Las relaciones son de dominio, nunca de producto: el contenedor corre un
 * backend que alguien construyó, la nube despliega una pipeline de CI que ya
 * corre tests, el caché guarda resultados de consultas a datos ya modelados.
 */
export const PREREQUISITOS: Record<string, string[]> = {
  backend: [],
  frontend: [],
  data: ['backend'],
  cache: ['backend'],
  testing: ['backend', 'frontend'],
  containers: ['backend'],
  ci: ['testing', 'containers'],
  cloud: ['ci', 'containers'],
};

/**
 * Fuentes para empezar cada tema: la documentación oficial y los tutoriales
 * de las alternativas que el tema ya declara. Nada de cursos recomendados ni
 * páginas que pueden desaparecer: si la fuente no es la voz original de la
 * herramienta, no va.
 */
export const FUENTES: Record<string, Fuente[]> = {
  backend: [
    {
      titulo: 'MDN: HTTP, el idioma del oficio',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
      tipo: 'docs',
    },
    {
      titulo: 'NestJS: documentación oficial',
      url: 'https://docs.nestjs.com',
      tipo: 'docs',
    },
    {
      titulo: 'FastAPI: tutorial',
      url: 'https://fastapi.tiangolo.com/tutorial/',
      tipo: 'tutoriales',
    },
  ],
  frontend: [
    {
      titulo: 'React: aprendé a pensar en sus términos',
      url: 'https://react.dev/learn',
      tipo: 'docs',
    },
    {
      titulo: 'Vue: tutorial paso a paso',
      url: 'https://vuejs.org/tutorial/',
      tipo: 'tutoriales',
    },
    {
      titulo: 'MDN: la base de JavaScript',
      url: 'https://developer.mozilla.org/en-US/docs/Learn',
      tipo: 'docs',
    },
  ],
  data: [
    {
      titulo: 'PostgreSQL: el tutorial del manual',
      url: 'https://www.postgresql.org/docs/current/tutorial.html',
      tipo: 'tutoriales',
    },
    {
      titulo: 'MongoDB: los fundamentos',
      url: 'https://learn.mongodb.com/courses/quickstart-tutorial',
      tipo: 'tutoriales',
    },
  ],
  cache: [
    {
      titulo: 'Redis: primeros pasos',
      url: 'https://redis.io/docs/latest/get-started/',
      tipo: 'docs',
    },
    {
      titulo: 'RabbitMQ: los seis ejemplos',
      url: 'https://www.rabbitmq.com/tutorials',
      tipo: 'tutoriales',
    },
  ],
  testing: [
    {
      titulo: 'Jest: cómo escribir la primera prueba',
      url: 'https://jestjs.io/docs/getting-started',
      tipo: 'docs',
    },
    {
      titulo: 'Playwright: end-to-end desde cero',
      url: 'https://playwright.dev/docs/intro',
      tipo: 'docs',
    },
    {
      titulo: 'Pytest: un padrino de otro ecosistema',
      url: 'https://docs.pytest.org/en/stable/getting-started.html',
      tipo: 'docs',
    },
  ],
  containers: [
    {
      titulo: 'Docker: orientación y primer contenedor',
      url: 'https://docs.docker.com/get-started/',
      tipo: 'docs',
    },
    {
      titulo: 'Kubernetes: tutoriales oficiales',
      url: 'https://kubernetes.io/docs/tutorials/',
      tipo: 'tutoriales',
    },
  ],
  ci: [
    {
      titulo: 'GitHub Actions: la documentación',
      url: 'https://docs.github.com/actions',
      tipo: 'docs',
    },
    {
      titulo: 'GitLab CI/CD: primeros pasos',
      url: 'https://docs.gitlab.com/ci/',
      tipo: 'docs',
    },
  ],
  cloud: [
    {
      titulo: 'AWS: documentación',
      url: 'https://docs.aws.amazon.com/',
      tipo: 'docs',
    },
    {
      titulo: 'Microsoft Learn: fundamentos de Azure',
      url: 'https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/',
      tipo: 'tutoriales',
    },
    {
      titulo: 'Google Cloud: guía de inicio',
      url: 'https://cloud.google.com/docs/get-started',
      tipo: 'docs',
    },
  ],
};

export interface NodoRuta {
  key: string;
  label: string;
  summary: string;
  /** Cuántas ofertas del corpus piden este tema. 0 si nadie lo pidió. */
  piden: number;
  /** piden / total, en porcentaje redondeado: el mismo cálculo del plan. */
  cobertura: number;
  /** Keys de los temas que hacen falta antes de este, presentes en la ruta. */
  prerequisitos: string[];
  /** Quienes dependen de este tema dentro de la ruta: lo que desbloquea. */
  desbloquea: string[];
  /** Sin prerequisitos dentro del grafo: la ruta puede empezar por acá. */
  empiezaAca: boolean;
  /**
   * False cuando el corpus no pidió el tema pero entra a la ruta igual:
   * es prerequisito de algo que sí se pidió. El denominador sigue honesto —
   * `cobertura` queda en 0% y el UI lo dice con sus propias palabras.
   */
  presenteEnCorpus: boolean;
  fuentes: Fuente[];
  /** El qué construir del tema: entregable, pasos chequeables y carga en horas. */
  plan: PlanTema;
}

export interface Ruta {
  totalOfertasAnalizadas: number;
  ecosistema: string | null;
  nodos: NodoRuta[];
}

/**
 * El cierre por prerequisitos: si el corpus pide `cloud`, la ruta necesita
 * también a `ci` y `containers`, aunque nadie los pidiera. Sin esto la ruta
 * promete aprender despliegues sin explicar por dónde se llega.
 */
function cierreDePrerequisitos(presentes: Set<string>): Set<string> {
  const cierre = new Set(presentes);

  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const key of [...cierre]) {
      for (const prereq of PREREQUISITOS[key] ?? []) {
        if (!cierre.has(prereq)) {
          cierre.add(prereq);
          crecio = true;
        }
      }
    }
  }

  return cierre;
}

/**
 * Orden topológico de Kahn. El desempate importa y se hace por demanda
 * (cuántas ofertas piden el tema) y después alfabético: entre dos temas
 * disponibles, primero el que el mercado del usuario está pidiendo más.
 */
function ordenTopologico(
  keys: Set<string>,
  demanda: Map<string, number>,
): string[] {
  const dependientes = new Map<string, string[]>();
  const faltantes = new Map<string, number>();

  for (const key of keys) {
    const prereqs = (PREREQUISITOS[key] ?? []).filter((k) => keys.has(k));
    faltantes.set(key, prereqs.length);

    for (const p of prereqs) {
      dependientes.set(p, [...(dependientes.get(p) ?? []), key]);
    }
  }

  const disponibles = [...keys].filter((k) => (faltantes.get(k) ?? 0) === 0);
  const orden: string[] = [];

  while (disponibles.length > 0) {
    disponibles.sort(
      (a, b) =>
        (demanda.get(b) ?? 0) - (demanda.get(a) ?? 0) || a.localeCompare(b),
    );

    const siguiente = disponibles.shift() as string;
    orden.push(siguiente);

    for (const dep of dependientes.get(siguiente) ?? []) {
      const quedan = (faltantes.get(dep) ?? 0) - 1;
      faltantes.set(dep, quedan);

      if (quedan === 0) disponibles.push(dep);
    }
  }

  if (orden.length !== keys.size) {
    throw new Error(
      'Los prerequisitos entre temas forman un ciclo: la ruta no se puede ordenar.',
    );
  }

  return orden;
}

/**
 * La ruta completa del corpus: nodos en orden de estudio, con prerequisitos,
 * fuentes y los denominadores del plan. Los temas que nadie pidió aparecen
 * solo si otro tema de la ruta los necesita.
 */
export function armarRuta(
  conteo: Map<string, number>,
  total: number,
  ecosistema: string | null,
): Ruta {
  const presentes = new Set(
    [...conteo.keys()].filter((k) => temaPorKey(k) !== undefined),
  );
  const grafo = cierreDePrerequisitos(presentes);
  const orden = ordenTopologico(grafo, conteo);

  const desbloquea = new Map<string, string[]>();
  const prereqsEnGrafo = new Map<string, string[]>();
  for (const key of grafo) {
    const prereqs = (PREREQUISITOS[key] ?? []).filter((k) => grafo.has(k));
    prereqsEnGrafo.set(key, prereqs);

    for (const p of prereqs) {
      desbloquea.set(p, [...(desbloquea.get(p) ?? []), key]);
    }
  }

  const nodos = orden.map((key) => {
    const theme = temaPorKey(key);
    const piden = conteo.get(key) ?? 0;

    return {
      key,
      label: theme?.label ?? key,
      summary: theme?.summary ?? '',
      piden,
      cobertura: total > 0 ? Math.round((piden / total) * 100) : 0,
      prerequisitos: prereqsEnGrafo.get(key) ?? [],
      desbloquea: desbloquea.get(key) ?? [],
      empiezaAca: (prereqsEnGrafo.get(key) ?? []).length === 0,
      presenteEnCorpus: presentes.has(key),
      fuentes: FUENTES[key] ?? [],
      plan: PLAN[key],
    } satisfies NodoRuta;
  });

  return { totalOfertasAnalizadas: total, ecosistema, nodos };
}
