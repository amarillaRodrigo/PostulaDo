import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Dos modos:
 *  - dev / servidor: `next dev` o `next start`, la app corre como siempre.
 *  - export estatico: `STATIC_EXPORT=1 npm run build` genera `out/` con HTML
 *    plano, para publicar en cualquier hosting estatico (Cloudflare Pages,
 *    Vercel, o dentro del portfolio).
 *
 * BASE_PATH permite servirla bajo un prefijo (`/postulado`) sin tocar el codigo.
 */
const isExport = process.env.STATIC_EXPORT === '1';
const basePath = process.env.BASE_PATH ?? '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El repo tiene dos lockfiles (API y web): fijamos la raiz del workspace
  // para que Next no la infiera mal.
  outputFileTracingRoot: path.join(__dirname, '..'),
  ...(isExport
    ? {
        output: 'export',
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
