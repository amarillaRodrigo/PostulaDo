import { Lens } from '@/components/Lens';
import { LoteForm } from '@/components/LoteForm';
import { PrismDiagram } from '@/components/PrismDiagram';
import {
  colorDeTema,
  EXAMPLE_COBERTURA_CONJUNTA,
  EXAMPLE_ECOSYSTEM,
  EXAMPLE_LOTE,
  EXAMPLE_THEMES,
  temasPrincipales,
} from '@/lib/themes';
import { TECNOLOGIAS } from '@/lib/vocab';

const OFERTAS = [
  { n: '01', titulo: 'Site Reliability Engineer', empresa: 'Norte fintech', temas: '4 temas' },
  { n: '02', titulo: 'Platform Engineer', empresa: 'Pampa SaaS', temas: '4 temas' },
  { n: '03', titulo: 'Cloud Infrastructure Engineer', empresa: 'Delta Sur', temas: '3 temas' },
  { n: '04', titulo: 'DevOps Lead', empresa: 'Taller Norte', temas: '3 temas' },
  { n: '05', titulo: 'Infrastructure Developer', empresa: 'Kobalto', temas: '2 temas' },
];

const PASOS = [
  {
    titulo: 'Juntá el lote',
    texto:
      'Pegá las URLs de las ofertas que te interesan. Cinco, diez, las que tengas: no hace falta ordenarlas.',
  },
  {
    titulo: 'Dejá que lo lea',
    texto:
      'El servidor scrapea cada posting, extrae los requisitos y agrupa el lote por tipo de trabajo.',
  },
  {
    titulo: 'Recibe el plan',
    texto:
      'Los temas con su cobertura y sus alternativas. Tu lote queda guardado, así que podés volver a mirarlo cuando quieras.',
  },
];

const FAQ = [
  {
    q: '¿Esto reemplaza saber una herramienta concreta?',
    a: 'No. Te dice qué temas cubren más ofertas y, por cada tema, las alternativas que existen. Con eso elegís por dónde entrar según lo que tu trabajo ya tiene.',
  },
  {
    q: '¿De dónde salen los porcentajes?',
    a: 'De tu lote, y solo de tu lote. Cada cobertura cuenta cuántas de las ofertas que pegaste en este lote piden ese tema, y el lote queda a la vista: un porcentaje sin denominador no significa nada.',
  },
  {
    q: '¿Y si dos postings piden temas contradictorios?',
    a: 'Quedan a la vista. Si el 40% pide AWS y el 40% pide Azure, no escondemos ninguna: el tema es uno solo, la alternativa es decisión tuya.',
  },
  {
    q: '¿Puedo empezar con pocas ofertas?',
    a: 'Sí. Con cinco ya se ve un patrón. El lote crece y los porcentajes se recalculan; el lote queda guardado, así que podés volver a mirarlo cuando quieras.',
  },
];

const PRINCIPALES = temasPrincipales(EXAMPLE_THEMES, EXAMPLE_LOTE);

export default function Page() {
  return (
    <>
      <nav className="nav">
        <div className="wrap nav__in">
          <div className="nav__logo">PostulaDo</div>
          <div className="nav__links">
            <a href="#producto">Producto</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#dispersión">Ejemplo</a>
          </div>
          <div className="nav__cta">
            <a className="btn btn--ink" href="#lote">
              Ver mi plan
            </a>
            <details className="nav__menu">
              <summary aria-label="Abrir el menú">Menú</summary>
              <div className="nav__menu-panel">
                <a href="#producto">Producto</a>
                <a href="#como-funciona">Cómo funciona</a>
                <a href="#dispersión">Ejemplo</a>
                <a href="#lote">Ver mi plan</a>
              </div>
            </details>
          </div>
        </div>
      </nav>

      <Lens>
        <div className="wrap hero">
          <h1>
            Dejá de adivinar
            <br />
            <span className="hero__word">qué estudiar</span>.
          </h1>
          <p className="hero__sub">
            Las ofertas que estás mirando ya dicen qué tenés que saber. El problema
            es que están separadas. Leídas juntas, te dicen por dónde empezar.
          </p>
          <p className="hero__aud">Para profesionales de IT en búsqueda activa</p>
          <div id="lote">
            <LoteForm />
          </div>
          <p className="hero__micro">
            Tu lote queda guardado: podés volver a mirarlo cuando quieras
          </p>
        </div>
      </Lens>

      <section className="band band--tight" id="producto">
        <div className="wrap">
          <div className="shotcard">
            <div className="shotcard__bar" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="shotcard__body">
              <div className="shotcard__nav">
                <span className="is-on">Mi plan</span>
                <span>Ofertas (5)</span>
                <span>Temas</span>
                <span>Alternativas</span>
                <span>Brechas</span>
              </div>
              <div className="shotcard__main">
                <p className="shotcard__title">Plan de estudio</p>
                <p className="shotcard__meta">
                  Ejemplo · lote de {EXAMPLE_LOTE} ofertas · {EXAMPLE_ECOSYSTEM}
                </p>
                {EXAMPLE_THEMES.map((row) => (
                  <div key={row.key} className="cov">
                    <div>
                      <div className="cov__label">{row.label}</div>
                      <div className="bar">
                        <i
                          style={{
                            width: `${row.porcentaje}%`,
                            background: colorDeTema(row.key),
                          }}
                        />
                      </div>
                    </div>
                    <div className="cov__pct">{row.porcentaje}%</div>
                    <div className="cov__alt">
                      {row.alternativas.slice(0, 2).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="strip" id="ejemplo">
        <div className="wrap">
          <p>
            Reconoce {TECNOLOGIAS.length} tecnologías y las agrupa en el oficio al
            que apuntan — no solo en el nombre del producto:
          </p>
          <div className="strip__list">
            {TECNOLOGIAS.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <section className="band" id="como-funciona">
        <div className="wrap">
          <div className="sechead">
            <h2>
              Tres pasos y un denominador
              <br />
              siempre a la vista
            </h2>
            <p>
              El trabajo pesado —leer, extraer, agrupar, contar— ocurre en el
              servidor mientras seguís buscando ofertas.
            </p>
          </div>
          <ol className="flow">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className="flow__step">
                <span className="flow__node" aria-hidden="true" />
                <span className="flow__n">{String(i + 1).padStart(2, '0')}</span>
                <h3>{paso.titulo}</h3>
                <p>{paso.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band band--dark">
        <div className="wrap">
          <div className="sechead">
            <h2>
              No comparten herramientas.
              <br />
              Comparten ecosistema.
            </h2>
            <p>
              Cinco ofertas de cinco empresas piden React, AWS, Docker y Kubernetes.
              Leídas por separado son cuatro planes distintos. Leídas juntas, son un
              solo tipo de trabajo.
            </p>
          </div>
          <div className="converge">
            <div>
              <p className="ejemplo-tag">Ejemplo</p>
              {OFERTAS.map((o) => (
                <div key={o.n} className="post__row">
                  <span className="i">{o.n}</span>
                  <span>{o.titulo}</span>
                  <span className="co">{o.empresa}</span>
                  <span className="st">{o.temas}</span>
                </div>
              ))}
            </div>
            <div className="eco">
              <h3>{EXAMPLE_ECOSYSTEM}</h3>
              <div className="eco__lab">Tipo de trabajo detectado</div>
              <p>
                El agrupamiento no se basa en coincidencias de stacks: se basa en{' '}
                <span style={{ color: 'var(--sp-2)' }}>hacia dónde apuntan</span>. Las
                cinco postings describen el mismo oficio, con cinco vocabularios
                técnicos encima.
              </p>
              <div className="eco__bars">
                {EXAMPLE_THEMES.map((t) => (
                  <i
                    key={t.key}
                    style={{
                      width: `${t.porcentaje}%`,
                      background: colorDeTema(t.key),
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="band" id="dispersión">
        <div className="wrap">
          <div className="sechead">
            <h2>Una luz, cinco colores</h2>
            <p>
              El lote entra como luz blanca y sale descompuesto en los temas que lo
              cubren. Cada rayo es un tema; el largo del rayo es el porcentaje de
              ofertas que lo piden.
            </p>
          </div>
          <PrismDiagram
            temas={EXAMPLE_THEMES}
            lote={EXAMPLE_LOTE}
            ecosystem={EXAMPLE_ECOSYSTEM}
          />
        </div>
      </section>

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sechead">
            <h2>
              Lo que las cinco
              <br />
              ofertas tienen en común
            </h2>
            <p>
              No tools sueltas. Los temas que el lote pide en común, ordenados por
              la parte del oficio que cubren — con el porcentaje de ofertas que los
              piden a la vista.
            </p>
          </div>
          <p className="ejemplo-tag ejemplo-tag--light">Ejemplo</p>
          <div className="grid2">
            {EXAMPLE_THEMES.map((t) => (
              <article
                key={t.key}
                className="plan"
                style={{ ['--tone' as string]: colorDeTema(t.key) }}
              >
                <div className="plan__head">
                  <h3>{t.label}</h3>
                  <div className="plan__pct">
                    <span className="plan__swatch" aria-hidden="true" />
                    {t.porcentaje}%
                  </div>
                </div>
                <p className="plan__why">{t.summary}</p>
                <div className="alts">
                  {t.alternativas.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="wrap prose-lead">
          <p className="prose-lead__big">
            Ejemplo: de <b>{EXAMPLE_LOTE}</b> ofertas, <b>{PRINCIPALES.length}</b>{' '}
            temas cubren el <b>{EXAMPLE_COBERTURA_CONJUNTA}%</b>.
          </p>
          <p className="prose-lead__sub">
            De esos cinco temas, {PRINCIPALES.length} cubren el{' '}
            {EXAMPLE_COBERTURA_CONJUNTA}% del lote. Y para cada uno, las
            alternativas por las que podés entrar. El denominador —{EXAMPLE_LOTE}{' '}
            ofertas— es siempre el lote que vos pegaste.
          </p>
        </div>
      </section>

      <section className="ctaband">
        <div className="wrap">
          <h2>
            Pegá cinco ofertas.
            <br />
            Salí con un plan.
          </h2>
          <p>
            Cuando termine, el plan aparece en esta misma pantalla, con los temas
            ordenados por la cobertura que tienen en tu lote.
          </p>
          <a className="btn btn--ink btn--caustic" href="#lote">
            Ver mi plan
          </a>
        </div>
      </section>

      <section className="band" id="faq">
        <div className="wrap faq">
          <div>
            <h2>
              Lo que la correlación
              <br />
              no dice
            </h2>
            <p className="faq__lead">
              Un plan sale de lo que el mercado pidió, no de lo que va a pedir.
              PostulaDo te muestra de dónde viene cada porcentaje y deja las brechas
              a la vista.
            </p>
          </div>
          <div>
            {FAQ.map((item) => (
              <div key={item.q} className="qa">
                <b>{item.q}</b>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <div className="footer__mark">PostulaDo</div>
          <div className="footer__cols">
            <div>
              <h3>Producto</h3>
              <a href="#producto">El plan</a>
              <a href="#dispersión">Ejemplo</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#lote">Analizar un lote</a>
            </div>
            <div>
              <h3>Recursos</h3>
              <a href="#faq">Preguntas frecuentes</a>
              <a href="#dispersión">Cómo leer un plan</a>
              <a href="#ejemplo">Tecnologías que reconocemos</a>
            </div>
            <div>
              <h3>El proyecto</h3>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#faq">Qué no podemos prometerte</a>
            </div>
          </div>
          <div className="footer__bar">
            <span>© 2026 PostulaDo</span>
            <span>Hecho para quienes necesitan ganarse un sueldo</span>
            <span>Español · AR</span>
          </div>
        </div>
      </footer>
    </>
  );
}
