'use client';

import { useState } from 'react';
import { colorDeTema } from '@/lib/themes';
import {
  analizarLote,
  API_CONFIGURADA,
  SIN_API,
  type Resultado,
} from '@/lib/api';

const EXAMPLE = [
  '01  https://ejemplo.com/o/cloud-sre',
  '02  https://ejemplo.com/o/platform',
  '03  https://ejemplo.com/o/aws-cloud',
  '04  https://ejemplo.com/o/devops',
  '05  https://ejemplo.com/o/k8s',
].join('\n');

const MAX_URLS = 20;

type Cuenta = {
  nombre: string;
  email: string;
  password: string;
  birthDate: string;
};

type Estado =
  | { kind: 'idle' }
  | { kind: 'working'; hechos: number; total: number }
  | { kind: 'error'; message: string }
  | { kind: 'needs-account'; cuenta: Cuenta }
  | { kind: 'working-account'; cuenta: Cuenta }
  | { kind: 'account-error'; cuenta: Cuenta; message: string }
  | { kind: 'done'; result: Resultado };

const CUENTA_VACIA: Cuenta = { nombre: '', email: '', password: '', birthDate: '' };

function parseUrls(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

export function LoteForm() {
  const [urls, setUrls] = useState('');
  const [state, setState] = useState<Estado>({ kind: 'idle' });

  async function correr(cuenta: Cuenta) {
    const list = parseUrls(urls);
    if (list.length === 0) {
      setState({ kind: 'error', message: 'Pegá al menos una URL de oferta.' });
      return;
    }

    setState({ kind: 'working', hechos: 0, total: list.length });

    try {
      const result = await analizarLote(list, cuenta, (hechos, total) =>
        setState({ kind: 'working', hechos, total }),
      );
      setState({ kind: 'done', result });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'No pudimos analizar tus ofertas.';
      if (state.kind === 'working-account') {
        setState({ kind: 'account-error', cuenta, message });
      } else {
        setState({ kind: 'error', message });
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Resultado                                                         */
  /* ---------------------------------------------------------------- */
  if (state.kind === 'done') {
    const { result } = state;
    return (
      <div className="ingest ingest--done">
        <div className="ingest__head">
          <span>Tu plan</span>
          <span>
            {result.totalOfertasAnalizadas} ofertas ·{' '}
            {result.ecosistema ?? 'sin ecosistema'}
          </span>
        </div>
        <div className="ingest__done-body">
          {result.temas.map((tema) => (
            <div key={tema.key} className="cov">
              <div>
                <div className="cov__label">{tema.label}</div>
                <div className="bar">
                  <i
                    style={{
                      width: `${tema.porcentaje}%`,
                      background: colorDeTema(tema.key),
                    }}
                  />
                </div>
              </div>
              <div className="cov__pct">{tema.porcentaje}%</div>
              <div className="cov__alt">
                {tema.alternativas.slice(0, 2).join(' · ')}
              </div>
            </div>
          ))}
          <p className="ingest__done-suggestion">{result.sugerenciaAprendizaje}</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Paso de cuenta                                                    */
  /* ---------------------------------------------------------------- */
  if (
    state.kind === 'needs-account' ||
    state.kind === 'working-account' ||
    state.kind === 'account-error'
  ) {
    const { cuenta } = state;
    const error = state.kind === 'account-error' ? state.message : null;
    const enCursoCuenta = state.kind === 'working-account';

    return (
      <form className="ingest" onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        correr({
          nombre: String(form.get('nombre') ?? ''),
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          birthDate: String(form.get('birthDate') ?? ''),
        });
      }}>
        <div className="ingest__head">
          <span>Cargamos tu lote</span>
          <span>Creá una cuenta para verlo</span>
        </div>
        <div className="ingest__account">
          <p className="ingest__account-lead">
            Tu lote queda guardado, y por eso necesita una cuenta. Te la armamos en
            un paso.
          </p>
          <div className="field">
            <label htmlFor="cuenta-nombre">Nombre</label>
            <input
              id="cuenta-nombre"
              name="nombre"
              type="text"
              required
              autoComplete="name"
              placeholder="Cómo te llamás"
              defaultValue={cuenta.nombre}
            />
          </div>
          <div className="field">
            <label htmlFor="cuenta-email">Correo</label>
            <input
              id="cuenta-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vos@ejemplo.com"
              defaultValue={cuenta.email}
            />
          </div>
          <div className="field">
            <label htmlFor="cuenta-password">Contraseña</label>
            <input
              id="cuenta-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="mínimo 8 caracteres"
              defaultValue={cuenta.password}
            />
          </div>
          <div className="field">
            <label htmlFor="cuenta-birth">Fecha de nacimiento</label>
            <input
              id="cuenta-birth"
              name="birthDate"
              type="date"
              required
              autoComplete="bday"
              defaultValue={cuenta.birthDate}
            />
          </div>
          {error ? (
            <p className="ingest__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="ingest__foot">
          <span className="ingest__gets">
            <b>Vas a obtener:</b> el tipo de trabajo que comparten, los temas que lo
            cubren y por cuál empezar.
          </span>
          <button
            className="btn btn--ink btn--caustic"
            type="submit"
            disabled={enCursoCuenta}
          >
            {enCursoCuenta ? 'Leyendo…' : 'Crear cuenta y ver mi plan'}
          </button>
        </div>
      </form>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Paso 1: pegar el lote                                             */
  /* ---------------------------------------------------------------- */
  const lista = parseUrls(urls);
  const overflow = lista.length > MAX_URLS;
  const enCurso = state.kind === 'working';

  return (
    <form
      className="ingest"
      onSubmit={(e) => {
        e.preventDefault();
        if (!API_CONFIGURADA) {
          setState({ kind: 'error', message: SIN_API });
          return;
        }
        setState({ kind: 'needs-account', cuenta: CUENTA_VACIA });
      }}
    >
      <div className="ingest__head">
        <span>Ofertas (URL)</span>
        <span>Una por línea · pegá las tuyas</span>
      </div>
      <div className="ingest__body">
        <label className="sr-only" htmlFor="lote-urls">
          URLs de las ofertas, una por línea
        </label>
        <textarea
          id="lote-urls"
          className="ingest__textarea"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={EXAMPLE}
          rows={5}
          spellCheck={false}
        />
        {overflow ? (
          <p className="ingest__notice" role="status">
            Solo analizamos las primeras {MAX_URLS} ofertas de este lote.
          </p>
        ) : null}
      </div>
      <div className="ingest__foot">
        <span className="ingest__gets">
          <b>Vas a obtener:</b> el tipo de trabajo que comparten, los temas que lo
          cubren y por cuál empezar.
        </span>
        <button className="btn btn--ink btn--caustic" type="submit" disabled={enCurso}>
          {enCurso ? 'Leyendo…' : 'Ver mi plan'}
        </button>
      </div>
      {state.kind === 'working' ? (
        <p className="ingest__notice" role="status">
          Analizando {state.hechos} de {state.total}…
        </p>
      ) : null}
      {state.kind === 'error' ? (
        <p className="ingest__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
