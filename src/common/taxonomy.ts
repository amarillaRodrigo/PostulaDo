/**
 * TAXONOMÍA DEL OFICIO
 *
 * El vocabulario del producto no es "herramientas" sino "oficios": cada
 * tecnología detectada pertenece a uno o más temas, y cada tema trae las
 * alternativas que lo cubren. Así el plan no ata a nadie a un vendor.
 */

export interface Theme {
  key: string;
  label: string;
  summary: string;
  alternatives: string[];
  technologies: string[];
}

export const THEMES: Theme[] = [
  {
    key: 'testing',
    label: 'Pruebas automatizadas',
    summary: 'Verificar el comportamiento, no compilarlo.',
    alternatives: ['JUnit', 'Vitest', 'Playwright', 'Pytest'],
    technologies: ['Jest', 'Cypress'],
  },
  {
    key: 'ci',
    label: 'Integración y entrega continua',
    summary: 'El camino del commit a producción.',
    alternatives: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI'],
    technologies: ['CI/CD', 'Git'],
  },
  {
    key: 'cloud',
    label: 'Despliegue en la nube',
    summary: 'Levantar, versionar y revertir.',
    alternatives: ['AWS', 'Azure', 'GCP', 'Cloudflare'],
    technologies: ['AWS', 'Azure', 'GCP'],
  },
  {
    key: 'containers',
    label: 'Contenedores y orquestación',
    summary: 'Por qué el contenedor solo no alcanza.',
    alternatives: ['Docker', 'Kubernetes', 'ECS', 'Nomad'],
    technologies: ['Docker', 'Docker-Compose', 'Kubernetes'],
  },
  {
    key: 'data',
    label: 'Datos y persistencia',
    summary: 'Modelar y consultar sin perder consistencia.',
    alternatives: ['PostgreSQL', 'MySQL', 'MongoDB', 'DynamoDB'],
    technologies: ['PostgreSQL', 'MySQL', 'MongoDB', 'Prisma'],
  },
  {
    key: 'cache',
    label: 'Caché y colas de trabajo',
    summary: 'Responder rápido y repartir el trabajo.',
    alternatives: ['Redis', 'Memcached', 'RabbitMQ', 'SQS'],
    technologies: ['Redis'],
  },
  {
    key: 'backend',
    label: 'Backend y APIs',
    summary: 'Modelar el dominio y exponerlo de forma estable.',
    alternatives: ['NestJS', 'Spring Boot', 'FastAPI', 'Gin', 'Express'],
    technologies: [
      'Node.js',
      'NestJS',
      'Java',
      'Spring Boot',
      'Golang',
      'Rust',
      'Python',
      'Django',
      'FastAPI',
      'PHP',
      'Ruby',
      'GraphQL',
      'REST',
      'TypeScript',
    ],
  },
  {
    key: 'frontend',
    label: 'Frontend y experiencia',
    summary: 'Construir interfaces que se sostienen.',
    alternatives: ['React', 'Vue', 'Svelte', 'Angular', 'Next.js'],
    technologies: [
      'React',
      'Angular',
      'Vue',
      'Next.js',
      'JavaScript',
      'TypeScript',
      'Tailwind',
    ],
  },
];

/** Índice technology → theme keys. Una tecnología puede pertenecer a varios temas. */
export const TECHNOLOGY_THEMES: Map<string, string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const theme of THEMES) {
    for (const tech of theme.technologies) {
      const keys = index.get(tech) ?? [];
      if (!keys.includes(theme.key)) keys.push(theme.key);
      index.set(tech, keys);
    }
  }
  return index;
})();

export interface Ecosystem {
  label: string;
  /** Temas que, si aparecen juntos, definen este tipo de trabajo. */
  signature: string[];
}

export const ECOSYSTEMS: Ecosystem[] = [
  { label: 'Cloud Engineering', signature: ['cloud', 'containers', 'ci'] },
  { label: 'Backend Engineering', signature: ['backend', 'data', 'cache'] },
  { label: 'Frontend Engineering', signature: ['frontend', 'testing'] },
  { label: 'Ingeniería de Datos', signature: ['data'] },
  { label: 'Ingeniería de Calidad', signature: ['testing'] },
  { label: 'Ingeniería de Plataforma', signature: ['containers', 'ci'] },
];

/** Convierte una lista de tecnologías en la lista de temas que implica. */
export function temasDe(tecnologias: string[]): string[] {
  const temas = new Set<string>();
  for (const tech of tecnologias) {
    for (const key of TECHNOLOGY_THEMES.get(tech) ?? []) temas.add(key);
  }
  return [...temas];
}

export function temaPorKey(key: string): Theme | undefined {
  return THEMES.find((t) => t.key === key);
}

/**
 * Detecta el tipo de trabajo del lote: el ecosistema es el que más coincide con
 * los temas presentes, ponderado por cobertura. No es una etiqueta inventada —
 * sale de qué temas pidió el conjunto de ofertas.
 */
export function detectarEcosistema(
  coberturaPorTema: Map<string, number>,
): string {
  let mejor = { label: 'Ingeniería de Software', puntos: 0 };

  for (const eco of ECOSYSTEMS) {
    let puntos = 0;
    for (const key of eco.signature) {
      puntos += coberturaPorTema.get(key) ?? 0;
    }
    if (puntos > mejor.puntos) mejor = { label: eco.label, puntos };
  }

  return mejor.label;
}
