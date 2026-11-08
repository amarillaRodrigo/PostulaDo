/**
 * Marca de PostulaDo: un prisma recibe un haz y lo dispersa.
 *
 * El prisma va en tinta y la luz es lo único que lleva color. Es la misma
 * geometría del favicon, sin el fondo: una sola marca en dos escalas.
 */
export function Marca() {
  return (
    <a className="marca" href="#top" aria-label="PostulaDo — ir al inicio">
      <svg
        className="marca__simbolo"
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M16 5 5 24h22Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinejoin="round"
        />
        <path
          d="M1 17h22"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <path
          d="M23 17 31 10"
          stroke="#2563eb"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <path
          d="M23 17h8"
          stroke="#e879f9"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <path
          d="M23 17 31 24"
          stroke="#f59e0b"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
      </svg>
      <span className="marca__texto">PostulaDo</span>
    </a>
  );
}
