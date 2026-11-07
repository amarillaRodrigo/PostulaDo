/**
 * El mapa tema → color. UNA sola fuente: la grilla de temas, el diagrama del
 * prisma y las barras de cobertura tienen que leer igual.
 *
 * Ojo: los dos stops claros del espectro (#a5f3fc y #fbcfe8) NO sirven como
 * color de un dato sobre papel — se pierden. Por eso los temas que los
 * necesitan usan su propio valor opaco. El espectro queda para el haz, los
 * subrayados y la cáustica, que viven sobre el lente oscuro.
 */
export const THEME_COLOR: Record<string, string> = {
  testing: 'var(--sp-1)',
  ci: '#0e7490',
  cloud: 'var(--sp-8)',
  containers: 'var(--sp-7)',
  data: 'var(--sp-9)',
  cache: '#0e8fa8',
  backend: 'var(--sp-6)',
  frontend: '#d63a8a',
};

export interface ThemeRow {
  key: string;
  label: string;
  summary: string;
  alternativas: string[];
  cobertura: number;
  porcentaje: number;
}

export function colorDeTema(key: string): string {
  return THEME_COLOR[key] ?? 'var(--sp-1)';
}

/** Nombre corto para el diagrama, donde la columna de etiquetas es angosta. */
export const THEME_SHORT: Record<string, string> = {
  testing: 'Pruebas',
  ci: 'CI / CD',
  cloud: 'Despliegue',
  containers: 'Orquestación',
  data: 'Datos',
  cache: 'Caché',
  backend: 'Backend',
  frontend: 'Frontend',
};

/**
 * Los temas que aparecen en la mayoría del lote. Usa el mismo umbral que
 * `analisisDeLote` en el backend (ceil(total * 0.6)), para que la frase de la
 * landing y la del producto digan lo mismo.
 */
export function temasPrincipales(temas: ThemeRow[], lote: number): ThemeRow[] {
  const umbral = Math.ceil(lote * 0.6);
  return temas.filter((t) => t.cobertura >= umbral);
}

/**
 * Lote de demostración. Los valores salen de la taxonomía real del backend
 * (src/common/taxonomy.ts) y las cifras son de un lote inventado: por eso
 * siempre se rotula como EJEMPLO.
 */
export const EXAMPLE_LOTE = 5;
export const EXAMPLE_ECOSYSTEM = 'Cloud Engineering';
export const EXAMPLE_COBERTURA_CONJUNTA = 100;

export const EXAMPLE_THEMES: ThemeRow[] = [
  {
    key: 'testing',
    label: 'Pruebas automatizadas',
    summary: 'Verificar el comportamiento, no compilarlo.',
    alternativas: ['JUnit', 'Vitest', 'Playwright', 'Pytest'],
    cobertura: 5,
    porcentaje: 100,
  },
  {
    key: 'ci',
    label: 'Integración y entrega continua',
    summary: 'El camino del commit a producción.',
    alternativas: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI'],
    cobertura: 4,
    porcentaje: 80,
  },
  {
    key: 'cloud',
    label: 'Despliegue en la nube',
    summary: 'Levantar, versionar y revertir.',
    alternativas: ['AWS', 'Azure', 'GCP', 'Cloudflare'],
    cobertura: 3,
    porcentaje: 60,
  },
  {
    key: 'containers',
    label: 'Contenedores y orquestación',
    summary: 'Por qué el contenedor solo no alcanza.',
    alternativas: ['Docker', 'Kubernetes', 'ECS', 'Nomad'],
    cobertura: 2,
    porcentaje: 40,
  },
  {
    key: 'backend',
    label: 'Backend y APIs',
    summary: 'Modelar el dominio y exponerlo de forma estable.',
    alternativas: ['NestJS', 'Spring Boot', 'FastAPI', 'Gin'],
    cobertura: 1,
    porcentaje: 20,
  },
];
