import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const composeFile = resolve(process.cwd(), 'compose.test.yaml');
const envFile = resolve(process.cwd(), '.env.test');

function loadEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function run(command) {
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres() {
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      execSync(
        `docker compose -f "${composeFile}" exec -T db pg_isready -U test -d postulado_test`,
        {
          stdio: 'ignore',
          env: process.env,
        },
      );
      return;
    } catch {
      await wait(2000);
    }
  }

  throw new Error('Postgres no quedó listo a tiempo dentro de Docker Compose.');
}

async function main() {
  if (!readFileSync) {
    throw new Error('No se pudo preparar el runner.');
  }

  loadEnvFile(envFile);

  try {
    run(`docker compose -f "${composeFile}" up -d`);
    await waitForPostgres();

    run('npx prisma migrate deploy');
    run('npm run test:e2e -- --runInBand');
  } finally {
    try {
      run(`docker compose -f "${composeFile}" down -v`);
    } catch {
      // Si falla el teardown, no bloquea el diagnóstico del test.
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});