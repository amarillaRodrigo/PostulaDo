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

  let disponibles = [...keys].filter((k) => (faltantes.get(k) ?? 0) === 0);
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
    } satisfies NodoRuta;
  });

  return { totalOfertasAnalizadas: total, ecosistema, nodos };
}
