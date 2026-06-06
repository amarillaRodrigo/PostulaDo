const KEYWORDS_MAP: { [key: string]: RegExp } = {
  JavaScript: /\b(javascript|js)\b/i,
  TypeScript: /\b(typescript|ts)\b/i,
  'Node.js': /\b(node\.js|node|nodejs)\b/i,
  NestJS: /\b(nestjs|nest\.js)\b/i,
  React: /\b(react|react\.js|reactjs)\b/i,
  Angular: /\b(angular|angularjs)\b/i,
  Vue: /\b(vue|vue\.js|vuejs)\b/i,
  'Next.js': /\b(next\.js|nextjs)\b/i,
  Docker: /\b(docker)\b/i,
  Kubernetes: /\b(kubernetes|k8s)\b/i,
  PostgreSQL: /\b(postgresql|postgres)\b/i,
  MongoDB: /\b(mongodb|mongo)\b/i,
  MySQL: /\b(mysql)\b/i,
  Redis: /\b(redis)\b/i,
  Prisma: /\b(prisma)\b/i,
  AWS: /\b(aws|amazon\s+web\s+services)\b/i,
  Azure: /\b(azure)\b/i,
  GCP: /\b(gcp|google\s+cloud)\b/i,
  GraphQL: /\b(graphql)\b/i,
  REST: /\b(rest|restful)\b/i,
  Git: /\b(git)\b/i,
  'Docker-Compose': /\b(docker-compose)\b/i,
  'CI/CD': /\b(ci\/cd|ci-cd)\b/i,
  Python: /\b(python)\b/i,
  Django: /\b(django)\b/i,
  FastAPI: /\b(fastapi)\b/i,
  Java: /\b(java)\b/i,
  'Spring Boot': /\b(spring\s+boot|spring)\b/i,
  Golang: /\b(golang|go\s+programming|go\s+language)\b/i,
  Rust: /\b(rust)\b/i,
  Ruby: /\b(ruby|rails)\b/i,
  PHP: /\b(php|laravel|symfony)\b/i,
  SQL: /\b(sql|nosql)\b/i,
  Tailwind: /\b(tailwind|tailwindcss)\b/i,
  Jest: /\b(jest)\b/i,
  Cypress: /\b(cypress)\b/i,
};

export function extractTechnologies(text: string): string[] {
  if (!text) return [];
  const matches: string[] = [];

  for (const [key, regex] of Object.entries(KEYWORDS_MAP)) {
    if (regex.test(text)) {
      matches.push(key);
    }
  }

  return matches;
}
