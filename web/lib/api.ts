/**
 * Cliente de la API. El frontend es una app estatica: habla con la API
 * directamente desde el navegador, asi que necesita CORS y una URL publica.
 *
 * La app se deployed en cualquier lado (Vercel, Cloudflare Pages, o dentro
 * del portfolio). Sin NEXT_PUBLIC_API_URL, el formulario no inventa nada:
 * dice que la API no esta conectada.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const API_CONFIGURADA = API_URL.length > 0;

export const SIN_API =
  'La API no esta conectada en esta demo. El codigo esta en GitHub y la podes correr con Docker.';

export type Tema = {
  key: string;
  label: string;
  summary: string;
  alternativas: string[];
  cobertura: number;
  porcentaje: number;
};

export type Resultado = {
  totalOfertasAnalizadas: number;
  ecosistema: string | null;
  coberturaConjunta: number;
  temas: Tema[];
  sugerenciaAprendizaje: string;
};

type Credenciales = {
  nombre: string;
  email: string;
  password: string;
  birthDate: string;
};

async function pedir<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body?.message === 'string'
        ? body.message
        : 'No pudimos completar la operacion.';
    throw new Error(message);
  }
  return body as T;
}

/** Login; si la cuenta no existe, la crea. */
async function autenticar(cuenta: Credenciales): Promise<string> {
  const login = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cuenta.email, password: cuenta.password }),
  });

  if (login.ok) {
    const body = await login.json();
    return body.access_token as string;
  }

  const registro = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: cuenta.email,
      password: cuenta.password,
      name: cuenta.nombre || undefined,
      birthDate: cuenta.birthDate || undefined,
      countryCode: 'AR',
    }),
  });

  if (!registro.ok) {
    throw new Error(
      'No pudimos entrar con ese correo y esa contraseña. Revisá los datos o probá con otra contraseña.',
    );
  }

  const body = await registro.json();
  return body.access_token as string;
}

/** Analiza una URL. Encola el trabajo y lo espera — el cliente hace el poll. */
async function analizar(
  url: string,
  token: string,
): Promise<{ datosOferta?: { tecnologias?: string[]; aniosExperiencia?: number } }> {
  const encolado = await pedir<{ jobId: string }>('/postulaciones/analizar', {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: { Authorization: `Bearer ${token}` },
  });

  for (let intento = 0; intento < 60; intento += 1) {
    await new Promise((r) => setTimeout(r, 1500));

    const estado = await pedir<{
      status?: string;
      result?: { datosOferta?: { tecnologias?: string[]; aniosExperiencia?: number } };
    }>(`/postulaciones/analizar/status/${encolado.jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (estado.status === 'completed') return estado.result ?? {};
    if (estado.status === 'failed') {
      throw new Error('No pudimos analizar una de las ofertas.');
    }
  }

  throw new Error('El análisis tardó demasiado. Probá con menos ofertas.');
}

/**
 * El flujo completo: autenticar, analizar cada URL, guardarla y pedir el
 * analisis del lote. Todo desde el navegador, en paralelo.
 */
export async function analizarLote(
  urls: string[],
  cuenta: Credenciales,
  alProgresar?: (hechos: number, total: number) => void,
): Promise<Resultado> {
  const token = await autenticar(cuenta);

  let hechos = 0;

  const ids = await Promise.all(
    urls.map(async (url) => {
      try {
        const analisis = await analizar(url, token);
        const guardada = await pedir<{ id: string }>('/postulaciones', {
          method: 'POST',
          body: JSON.stringify({
            url,
            tecnologias: analisis.datosOferta?.tecnologias ?? [],
            aniosExperiencia: analisis.datosOferta?.aniosExperiencia,
          }),
          headers: { Authorization: `Bearer ${token}` },
        });
        hechos += 1;
        alProgresar?.(hechos, urls.length);
        return guardada.id;
      } catch {
        return null;
      }
    }),
  );

  const guardados = ids.filter((id): id is string => typeof id === 'string');
  if (guardados.length === 0) {
    throw new Error('No pudimos analizar ninguna de tus ofertas.');
  }

  return pedir<Resultado>(
    `/postulaciones/analisis-lote?ids=${encodeURIComponent(guardados.join(','))}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
