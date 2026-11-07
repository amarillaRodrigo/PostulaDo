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

export type Usuario = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: string | null;
};

export type Sesion = {
  token: string;
  usuario: Usuario;
  /** `false` cuando la API no pudo mandar el correo de confirmación. */
  emailEnviado?: boolean;
};

export type LoteGuardado = {
  id: string;
  nombre: string | null;
  ids: string[];
  createdAt: string;
};

export type Credenciales = {
  nombre: string;
  email: string;
  password: string;
  birthDate: string;
};

/**
 * Lo que se guarda en el navegador para sobrevivir a un F5.
 *
 * Es el token, no la contraseña: la sesión dura lo que dura el JWT (30 días)
 * y se puede revocar del lado de la API. El plan se recalcula desde la API,
 * así que lo guardado son los ids y el lote, no una foto vieja.
 */
export type SesionGuardada = {
  token: string;
  email: string;
  emailVerificado: boolean;
  ids: string[];
  loteId: string | null;
};

const CLAVE_SESION = 'postulado.sesion';

export function guardarSesion(sesion: SesionGuardada): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    // Modo privado o almacenamiento lleno: la demo sigue andando sin memoria.
  }
}

export function borrarSesion(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Nada que hacer.
  }
}

export function leerSesion(): SesionGuardada | null {
  if (typeof window === 'undefined') return null;

  try {
    const crudo = window.localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;

    const datos = JSON.parse(crudo) as Partial<SesionGuardada>;
    if (
      typeof datos.token !== 'string' ||
      !Array.isArray(datos.ids) ||
      datos.ids.length === 0
    ) {
      return null;
    }

    return {
      token: datos.token,
      email: typeof datos.email === 'string' ? datos.email : '',
      emailVerificado: datos.emailVerificado === true,
      ids: datos.ids.filter((id): id is string => typeof id === 'string'),
      loteId: typeof datos.loteId === 'string' ? datos.loteId : null,
    };
  } catch {
    return null;
  }
}

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

function autorizacion(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/** Crea la cuenta. El correo de confirmación puede fallar sin romper nada. */
export async function crearCuenta(cuenta: Credenciales): Promise<Sesion> {
  const body = await pedir<{
    access_token: string;
    user: Usuario;
    emailEnviado?: boolean;
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: cuenta.email,
      password: cuenta.password,
      name: cuenta.nombre || undefined,
      birthDate: cuenta.birthDate || undefined,
      countryCode: 'AR',
    }),
  });

  return {
    token: body.access_token,
    usuario: body.user,
    emailEnviado: body.emailEnviado,
  };
}

/** Entra con una cuenta existente. */
export async function entrarCuenta(
  email: string,
  password: string,
): Promise<Sesion> {
  const body = await pedir<{ access_token: string; user: Usuario }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );

  return { token: body.access_token, usuario: body.user };
}

/** Relee el perfil: sirve para saber si el correo ya se confirmó. */
export async function miPerfil(token: string): Promise<Usuario | null> {
  try {
    return await pedir<Usuario>('/auth/yo', { headers: autorizacion(token) });
  } catch {
    return null;
  }
}

export async function verificarEmail(token: string): Promise<{
  verificado: boolean;
  email: string;
  yaEstaba: boolean;
}> {
  return pedir('/auth/verificar', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function reenviarVerificacion(
  token: string,
): Promise<{ enviado: boolean; yaVerificado: boolean; esperaSegundos?: number }> {
  return pedir('/auth/reenviar-verificacion', {
    method: 'POST',
    headers: autorizacion(token),
  });
}

/**
 * Pide el enlace de recuperación.
 *
 * La API responde lo mismo exista o no la cuenta, así que la landing no puede
 * (ni debe) decir "ese correo no está registrado".
 */
export async function olvidePassword(
  email: string,
): Promise<{ enviado: boolean }> {
  return pedir('/auth/olvide-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ restablecida: boolean; email: string }> {
  return pedir('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function listarLotes(token: string): Promise<LoteGuardado[]> {
  try {
    return await pedir<LoteGuardado[]>('/lotes', {
      headers: autorizacion(token),
    });
  } catch {
    return [];
  }
}

/** Plan de un lote ya guardado en la cuenta. */
export async function abrirLote(
  token: string,
  ids: string[],
): Promise<Resultado | null> {
  if (ids.length === 0) return null;

  try {
    const resultado = await pedir<Resultado>(
      `/postulaciones/analisis-lote?ids=${encodeURIComponent(ids.join(','))}`,
      { headers: autorizacion(token) },
    );

    return resultado?.totalOfertasAnalizadas ? resultado : null;
  } catch {
    return null;
  }
}

/**
 * Vuelve a pedir el plan del último lote guardado.
 *
 * Se recalcula en la API en vez de guardar el resultado: si los datos
 * cambiaron, lo que se muestra es lo que hay hoy. Un token vencido borra la
 * sesión y devuelve `null` para que la landing muestre el formulario.
 */
export async function recuperarPlan(): Promise<Resultado | null> {
  const sesion = leerSesion();
  if (!sesion || !API_CONFIGURADA) return null;

  const resultado = await abrirLote(sesion.token, sesion.ids);

  if (!resultado) {
    // Antes de rendirse, comprobar si el token sigue siendo válido: si no,
    // la sesión local es basura y conviene borrarla.
    const perfil = await miPerfil(sesion.token);
    if (!perfil) borrarSesion();
    return null;
  }

  return resultado;
}

/** Analiza una URL. Encola el trabajo y lo espera — el cliente hace el poll. */
async function analizar(
  url: string,
  token: string,
): Promise<{ datosOferta?: { tecnologias?: string[]; aniosExperiencia?: number } }> {
  const encolado = await pedir<{ jobId: string }>('/postulaciones/analizar', {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: autorizacion(token),
  });

  for (let intento = 0; intento < 60; intento += 1) {
    await new Promise((r) => setTimeout(r, 1500));

    const estado = await pedir<{
      status?: string;
      result?: { datosOferta?: { tecnologias?: string[]; aniosExperiencia?: number } };
    }>(`/postulaciones/analizar/status/${encolado.jobId}`, {
      headers: autorizacion(token),
    });

    if (estado.status === 'completed') return estado.result ?? {};
    if (estado.status === 'failed') {
      throw new Error('No pudimos analizar una de las ofertas.');
    }
  }

  throw new Error('El análisis tardó demasiado. Probá con menos ofertas.');
}

export type ResultadoLote = {
  resultado: Resultado;
  ids: string[];
  loteId: string | null;
  /** Ofertas que no se pudieron leer. Se muestra, no se esconde. */
  fallidas: number;
};

/**
 * El flujo completo: analizar cada URL, guardarla, pedir el plan del lote y
 * dejarlo guardado en la cuenta. Todo desde el navegador, en paralelo.
 */
export async function analizarLote(
  urls: string[],
  sesion: Sesion,
  alProgresar?: (hechos: number, total: number) => void,
): Promise<ResultadoLote> {
  const { token } = sesion;

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
          headers: autorizacion(token),
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

  const resultado = await pedir<Resultado>(
    `/postulaciones/analisis-lote?ids=${encodeURIComponent(guardados.join(','))}`,
    { headers: autorizacion(token) },
  );

  // El lote se guarda en la cuenta: así el plan no vive solo en este navegador.
  let loteId: string | null = null;
  try {
    const lote = await pedir<LoteGuardado>('/lotes', {
      method: 'POST',
      body: JSON.stringify({
        ids: guardados,
        nombre: resultado.ecosistema ?? undefined,
      }),
      headers: autorizacion(token),
    });
    loteId = lote.id;
  } catch {
    // Sin lote en la cuenta el plan igual se ve; solo no cruza dispositivos.
  }

  guardarSesion({
    token,
    email: sesion.usuario.email,
    emailVerificado: Boolean(sesion.usuario.emailVerifiedAt),
    ids: guardados,
    loteId,
  });

  return {
    resultado,
    ids: guardados,
    loteId,
    fallidas: urls.length - guardados.length,
  };
}
