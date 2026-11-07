/**
 * EL HAZ
 * Siete capas de color que divergen desde el 30% izquierdo, con núcleo blanco.
 * Saturado al 42%: tiene que leerse como luz con bordes cromáticos, no como
 * pintura. Si lo subís, deja de ser un haz y pasa a ser una franja.
 */
const RAYS = [
  { color: 'var(--sp-1)', angle: '-6deg' },
  { color: 'var(--sp-2)', angle: '-4deg' },
  { color: 'var(--sp-3)', angle: '-2.2deg' },
  { color: 'var(--sp-5)', angle: '-0.4deg' },
  { color: 'var(--sp-6)', angle: '1.4deg' },
  { color: 'var(--sp-8)', angle: '3deg' },
  { color: 'var(--sp-9)', angle: '4.4deg' },
];

export function Beam() {
  return (
    <div className="beam" aria-hidden="true">
      <span className="beam__bloom" />
      {RAYS.map((ray) => (
        <span
          key={ray.color}
          className="beam__ray"
          style={{ background: ray.color, transform: `rotate(${ray.angle})` }}
        />
      ))}
      <span className="beam__core" />
    </div>
  );
}
