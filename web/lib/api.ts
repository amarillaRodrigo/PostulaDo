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
  /** Token corto: viaja en cada request. */
  token: string;
  /** Token largo: solo sirve para pedir un par nuevo. */
  refreshToken: string;
  /** Epoch ms en que vence `token`. */
  expiraEn: number;
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
 * Son los dos tokens, no la contraseña. El access token dura 15 minutos; el
 * refresh token 30 días y rota en cada uso, así que una sesión abierta no se
 * cae cada cuarto de hora. El plan se recalcula desde la API, así que lo
 * guardado son los ids y el lote, no una foto vieja.
 */
export type SesionGuardada = {
  token: string;
  /** `null` en sesiones anteriores a los refresh tokens. */
  refreshToken: string | null;
  /** Epoch ms de vencimiento del access token. `0` si no se sabe. */
  expiraEn: number;
  email: string;
  emailVerificado: boolean;
  ids: string[];
  loteId: string | null;
};

const CLAVE_SESION = 'postulado.sesion';

/** Antes de vencer, se renueva: evita que un request salga con un token muerto. */
const MARGEN_REFRESCO_MS = 60 * 1000;

/** Error de la API con el status HTTP: el 401 es el que dispara el refresco. */
export class ErrorApi extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ErrorApi';
    this.status = status;
  }
}

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

/** Lee `exp` del JWT. Sirve para sesiones guardadas antes de `expires_in`. */
function vencimientoDeToken(token: string): number {
  const payload = token.split('.')[1];
  if (!payload) return 0;

  try {
    const datos = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };

    return typeof datos.exp === 'number' ? datos.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function leerSesion(): SesionGuardada | null {
  if (typeof window === 'undefined') return null;

  try {
    const crudo = window.localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;

    const datos = JSON.parse(crudo) as Partial<SesionGuardada>;
    if (typeof datos.token !== 'string' || !Array.isArray(datos.ids)) {
      return null;
    }

    // `ids: []` es válido: la sesión existe y el lote todavía se está armando.
    return {
      token: datos.token,
      refreshToken:
        typeof datos.refreshToken === 'string' && datos.refreshToken
          ? datos.refreshToken
          : null,
      expiraEn:
        typeof datos.expiraEn === 'number' && datos.expiraEn > 0
          ? datos.expiraEn
          : vencimientoDeToken(datos.token),
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
    throw new ErrorApi(message, res.status);
  }
  return body as T;
}

function autorizacion(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

type RespuestaAuth = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user: Usuario;
  emailEnviado?: boolean;
};

function aSesion(body: RespuestaAuth): Sesion {
  return {
    token: body.access_token,
    refreshToken: body.refresh_token ?? '',
    expiraEn:
      body.expires_in && body.expires_in > 0
        ? Date.now() + body.expires_in * 1000
        : vencimientoDeToken(body.access_token),
    usuario: body.user,
    emailEnviado: body.emailEnviado,
  };
}

/** Guarda la sesión apenas se entra: el lote se completa después. */
function guardarDesdeSesion(
  sesion: Sesion,
  ids: string[],
  loteId: string | null,
): SesionGuardada {
  const guardada: SesionGuardada = {
    token: sesion.token,
    refreshToken: sesion.refreshToken || null,
    expiraEn: sesion.expiraEn,
    email: sesion.usuario.email,
    emailVerificado: Boolean(sesion.usuario.emailVerifiedAt),
    ids,
    loteId,
  };

  guardarSesion(guardada);
  return guardada;
}

/**
 * Cambia el refresh token por un par nuevo.
 *
 * Una sola promesa compartida: si dos partes de la app se quedan sin token a
 * la vez, se hace un único refresh. Dos refresh en paralelo con el mismo
 * token serían una carrera (la API tolera 30 s, pero no hace falta probarla).
 */
let refrescoEnCurso: Promise<SesionGuardada | null> | null = null;

export async function refrescarSesion(): Promise<SesionGuardada | null> {
  if (refrescoEnCurso) return refrescoEnCurso;

  const guardada = leerSesion();

  if (!guardada || !guardada.refreshToken || !API_CONFIGURADA) return null;

  refrescoEnCurso = (async () => {
    try {
      const body = await pedir<RespuestaAuth>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: guardada.refreshToken }),
      });

      const actualizada: SesionGuardada = {
        ...guardada,
        token: body.access_token,
        refreshToken: body.refresh_token ?? guardada.refreshToken,
        expiraEn:
          body.expires_in && body.expires_in > 0
            ? Date.now() + body.expires_in * 1000
            : vencimientoDeToken(body.access_token),
        email: body.user?.email ?? guardada.email,
        emailVerificado: Boolean(body.user?.emailVerifiedAt),
      };

      guardarSesion(actualizada);
      return actualizada;
    } catch (e) {
      // Solo se borra si la API rechazó el token. Sin red o con la API
      // dormida, lo guardado sigue sirviendo para el próximo intento.
      if (e instanceof ErrorApi && e.status === 401) borrarSesion();
      return null;
    }
  })();

  try {
    return await refrescoEnCurso;
  } finally {
    refrescoEnCurso = null;
  }
}

/**
 * Request autenticado.
 *
 * Antes de salir, si al access token le quedan menos de 60 s, se renueva. Si
 * igual vuelve un 401 (el token venció mientras se usaba), se renueva y se
 * reintenta una sola vez. Es lo que permite tener tokens de 15 minutos sin que
 * la persona vea un "cerrá sesión" cada cuarto de hora.
 */
async function pedirConSesion<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let sesion = leerSesion();

  if (!sesion) {
    throw new ErrorApi('Entrá de nuevo para continuar.', 401);
  }

  if (sesion.expiraEn > 0 && sesion.expiraEn - Date.now() < MARGEN_REFRESCO_MS) {
    sesion = (await refrescarSesion()) ?? sesion;
  }

  try {
    return await pedir<T>(path, {
      ...init,
      headers: { ...(init.headers ?? {}), ...autorizacion(sesion.token) },
    });
  } catch (e) {
    if (!(e instanceof ErrorApi) || e.status !== 401) throw e;

    const renovada = await refrescarSesion();
    if (!renovada) throw e;

    return pedir<T>(path, {
      ...init,
      headers: { ...(init.headers ?? {}), ...autorizacion(renovada.token) },
    });
  }
}

/** Crea la cuenta. El correo de confirmación puede fallar sin romper nada. */
export async function crearCuenta(cuenta: Credenciales): Promise<Sesion> {
  const body = await pedir<RespuestaAuth>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: cuenta.email,
      password: cuenta.password,
      name: cuenta.nombre || undefined,
      birthDate: cuenta.birthDate || undefined,
      countryCode: 'AR',
    }),
  });

  const sesion = aSesion(body);
  guardarDesdeSesion(sesion, [], null);
  return sesion;
}

/** Entra con una cuenta existente. */
export async function entrarCuenta(
  email: string,
  password: string,
): Promise<Sesion> {
  const body = await pedir<RespuestaAuth>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const sesion = aSesion(body);
  guardarDesdeSesion(sesion, [], null);
  return sesion;
}

/** Relee el perfil: sirve para saber si el correo ya se confirmó. */
export async function miPerfil(): Promise<Usuario | null> {
  try {
    return await pedirConSesion<Usuario>('/auth/yo');
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

export async function reenviarVerificacion(): Promise<{
  enviado: boolean;
  yaVerificado: boolean;
  esperaSegundos?: number;
}> {
  return pedirConSesion('/auth/reenviar-verificacion', { method: 'POST' });
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

/**
 * Cierra la sesión en la API y borra lo guardado.
 *
 * Si la API no responde igual se borra local: nadie queda "adentro" por un
 * timeout. El refresh token se revoca del lado del servidor cuando se puede.
 */
export async function cerrarSesion(): Promise<void> {
  const sesion = leerSesion();
  borrarSesion();

  if (!sesion?.refreshToken || !API_CONFIGURADA) return;

  try {
    await pedir('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: sesion.refreshToken }),
    });
  } catch {
    // Sin red o sin API: la sesión local ya se borró.
  }
}

/**
 * Cierra la sesión en todos los dispositivos.
 *
 * Revoca cada refresh token de la cuenta, incluido el de este navegador, y
 * después limpia lo local. Devuelve cuántas sesiones cerró, o `null` si la API
 * no pudo hacerlo: en ese caso la landing lo dice en vez de fingir.
 */
export async function cerrarTodasLasSesiones(): Promise<{
  cerradas: number;
} | null> {
  try {
    const resultado = await pedirConSesion<{ cerradas: number }>(
      '/auth/logout-todos',
      { method: 'POST' },
    );

    borrarSesion();
    return resultado;
  } catch {
    // Sin respuesta no se puede afirmar que se cerraron las demás: se deja la
    // sesión local como está y la persona decide reintentar.
    return null;
  }
}

export async function listarLotes(): Promise<LoteGuardado[]> {
  try {
    return await pedirConSesion<LoteGuardado[]>('/lotes');
  } catch {
    return [];
  }
}

/**
 * Una oferta guardada, tal como la dejó el extractor: es lo que permite
 * mostrar el lote de adentro en vez de solo el agregado.
 */
export type OfertaResumen = {
  id: string;
  url: string;
  title: string | null;
  company: string | null;
  status: string;
  tecnologias: string[];
  aniosExperiencia: number | null;
};

/**
 * Lee las ofertas del lote, en el orden del lote.
 *
 * El listado de la API es paginado y no acepta varios ids, así que se recorre
 * por páginas hasta completar el lote (o quedarse sin páginas).
 */
export async function listarPostulaciones(
  ids: string[],
): Promise<OfertaResumen[]> {
  const faltan = new Set(ids);
  const mapa = new Map<string, OfertaResumen>();

  for (let page = 1; page <= 10 && faltan.size > 0; page += 1) {
    const pagina = await pedirConSesion<OfertaResumen[]>(
      `/postulaciones?limit=100&page=${page}`,
    );

    for (const oferta of pagina) {
      if (faltan.delete(oferta.id)) mapa.set(oferta.id, oferta);
    }

    if (pagina.length < 100) break;
  }

  return ids
    .map((id) => mapa.get(id))
    .filter((o): o is OfertaResumen => Boolean(o));
}

/**
 * Cambia el estado de una postulación (aplicada, entrevista, rechazada…).
 * No toca el plan: el agregado sale del lote, este dato es por oferta.
 */
export async function actualizarOferta(
  id: string,
  cambios: { status: string },
): Promise<boolean> {
  try {
    await pedirConSesion<OfertaResumen>(`/postulaciones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cambios),
    });
    return true;
  } catch {
    return false;
  }
}

/** Plan de un lote ya guardado en la cuenta. */
export async function abrirLote(ids: string[]): Promise<Resultado | null> {
  if (ids.length === 0) return null;

  try {
    const resultado = await pedirConSesion<Resultado>(
      `/postulaciones/analisis-lote?ids=${encodeURIComponent(ids.join(','))}`,
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
 * cambiaron, lo que se muestra es lo que hay hoy. Solo se borra la sesión si
 * la API la rechaza de verdad (401): con la API dormida o sin red, lo guardado
 * sirve para el próximo intento.
 */
export async function recuperarPlan(): Promise<Resultado | null> {
  const sesion = leerSesion();
  if (!sesion || !API_CONFIGURADA) return null;

  // Una sesión sin ids es un lote a medio armar: no hay plan que recuperar.
  if (sesion.ids.length === 0) return null;

  try {
    const resultado = await pedirConSesion<Resultado>(
      `/postulaciones/analisis-lote?ids=${encodeURIComponent(sesion.ids.join(','))}`,
    );

    return resultado?.totalOfertasAnalizadas ? resultado : null;
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 401) borrarSesion();
    return null;
  }
}

/** Analiza una URL. Encola el trabajo y lo espera — el cliente hace el poll. */
async function analizar(
  url: string,
): Promise<{ datosOferta?: { tecnologias?: string[]; aniosExperiencia?: number } }> {
  const encolado = await pedirConSesion<{ jobId: string }>(
    '/postulaciones/analizar',
    {
      method: 'POST',
      body: JSON.stringify({ url }),
    },
  );

  for (let intento = 0; intento < 60; intento += 1) {
    await new Promise((r) => setTimeout(r, 1500));

    const estado = await pedirConSesion<{
      status?: string;
      result?: { datosOferta?: { tecnologias?: string[]; aniosExperiencia?: number } };
    }>(`/postulaciones/analizar/status/${encolado.jobId}`);

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
  /** La sesión ya con los ids y el lote guardados. */
  sesion: SesionGuardada;
};

/**
 * El flujo completo: analizar cada URL, guardarla, pedir el plan del lote y
 * dejarlo guardado en la cuenta. Todo desde el navegador, en paralelo.
 */
export async function analizarLote(
  urls: string[],
  alProgresar?: (hechos: number, total: number) => void,
): Promise<ResultadoLote> {
  const sesion = leerSesion();

  if (!sesion) {
    throw new ErrorApi('Entrá de nuevo para analizar el lote.', 401);
  }

  let hechos = 0;
  let rechazada = false;

  const ids = await Promise.all(
    urls.map(async (url) => {
      try {
        const analisis = await analizar(url);
        const guardada = await pedirConSesion<{ id: string }>(
          '/postulaciones',
          {
            method: 'POST',
            body: JSON.stringify({
              url,
              tecnologias: analisis.datosOferta?.tecnologias ?? [],
              aniosExperiencia: analisis.datosOferta?.aniosExperiencia,
            }),
          },
        );
        hechos += 1;
        alProgresar?.(hechos, urls.length);
        return guardada.id;
      } catch (e) {
        // Si el refresh tampoco sirvió, no es "la oferta no se pudo leer":
        // es la sesión. Se avisa eso en vez de culpar a las URLs.
        if (e instanceof ErrorApi && e.status === 401) rechazada = true;
        return null;
      }
    }),
  );

  const guardados = ids.filter((id): id is string => typeof id === 'string');
  if (guardados.length === 0) {
    throw new Error(
      rechazada
        ? 'Tu sesión venció. Entrá de nuevo y volvé a pegar las ofertas.'
        : 'No pudimos analizar ninguna de tus ofertas.',
    );
  }

  const resultado = await pedirConSesion<Resultado>(
    `/postulaciones/analisis-lote?ids=${encodeURIComponent(guardados.join(','))}`,
  );

  // El lote se guarda en la cuenta: así el plan no vive solo en este navegador.
  let loteId: string | null = null;
  try {
    const lote = await pedirConSesion<LoteGuardado>('/lotes', {
      method: 'POST',
      body: JSON.stringify({
        ids: guardados,
        nombre: resultado.ecosistema ?? undefined,
      }),
    });
    loteId = lote.id;
  } catch {
    // Sin lote en la cuenta el plan igual se ve; solo no cruza dispositivos.
  }

  // Se relee por si el refresh cambió los tokens durante el análisis.
  const actual = leerSesion() ?? sesion;
  const actualizada: SesionGuardada = { ...actual, ids: guardados, loteId };
  guardarSesion(actualizada);

  return {
    resultado,
    ids: guardados,
    loteId,
    fallidas: urls.length - guardados.length,
    sesion: actualizada,
  };
}
