import { colorDeTema, THEME_SHORT, type ThemeRow } from '@/lib/themes';

/**
 * EL PRISMA
 * Un haz blanco entra y sale disperso en un rayo por tema. El LARGO del rayo
 * es el porcentaje de ofertas que lo piden — por eso el diagrama usa la
 *percentage real y no una maqueta de cinco líneas iguales.
 */
export function PrismDiagram({
  temas,
  lote,
  ecosystem,
}: {
  temas: ThemeRow[];
  lote: number;
  ecosystem: string | null;
}) {
  const X0 = 400;
  const MAX_LEN = 540;
  const LABEL_X = 1060;

  return (
    <div className="prism">
      <div className="prism__cap">
        <span>Ejemplo · dispersión de un lote de {lote} ofertas</span>
        <span>{ecosystem ?? 'Sin ecosistema dominante'}</span>
      </div>
      <div className="prism__scroll">
        <svg
          viewBox="0 0 1240 250"
          role="img"
          aria-label={
            `Un haz blanco entra a un prisma y sale disperso en ${temas.length} rayos de colores, uno por tema. ` +
            `${temas
              .map((t) => `${t.label}: ${t.porcentaje}% de las ${lote} ofertas`)
              .join('. ')}`
          }
        >
          <defs>
            {/* gradientUnits userSpaceOnUse: sobre una <line> de altura cero el
                gradiente no resuelve y el elemento no se pinta. */}
            <linearGradient id="prism-in" gradientUnits="userSpaceOnUse" x1="0" y1="125" x2="300" y2="125">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          <rect x="0" y="120" width="300" height="10" rx="5" fill="url(#prism-in)" />
          <text
            x="18"
            y="108"
            fill="rgba(22,24,26,.82)"
            fontSize="12"
            fontFamily="var(--font-sans)"
            letterSpacing="1.5"
          >
            EL LOTE · {lote} OFERTAS
          </text>

          <polygon
            points="300,60 300,190 400,125"
            fill="none"
            stroke="rgba(22,24,26,.35)"
            strokeWidth="1.5"
          />

          {temas.map((tema, i) => {
            const y = 26 + i * (198 / Math.max(temas.length - 1, 1));
            const endX = X0 + MAX_LEN * (tema.porcentaje / 100);
            return (
              <g key={tema.key}>
                <line
                  x1={X0}
                  y1={125}
                  x2={endX}
                  y2={y}
                  stroke={colorDeTema(tema.key)}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line
                  x1={endX}
                  y1={y}
                  x2={LABEL_X - 12}
                  y2={y}
                  stroke="rgba(22,24,26,.22)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <text
                  x={LABEL_X}
                  y={y}
                  dy="-4"
                  fill="var(--ink)"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily="var(--font-sans)"
                >
                  {THEME_SHORT[tema.key] ?? tema.label}
                </text>
                <text
                  x={LABEL_X}
                  y={y}
                  dy="12"
                  fill="rgba(22,24,26,.72)"
                  fontSize="12"
                  fontFamily="var(--font-mono)"
                >
                  {tema.porcentaje}% · {tema.cobertura} de {lote}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="prism__hint">Deslizá el diagrama para ver los cinco temas →</p>
    </div>
  );
}
