import { Beam } from './Beam';

/**
 * LA LENTE
 * El ground óptico donde vive el haz. Se reutiliza como superficie en cualquier
 * sección que necesite el gesto del prisma.
 */
export function Lens({ children }: { children: React.ReactNode }) {
  return (
    <div className="lens">
      <div className="lens__grid" aria-hidden="true" />
      <Beam />
      <div className="beam__flare" aria-hidden="true" />
      <div className="lens__inner">{children}</div>
    </div>
  );
}
