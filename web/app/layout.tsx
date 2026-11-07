import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PostulaDo — Dejá de adivinar qué estudiar',
  description:
    'Pegá las ofertas que estás mirando y PostulaDo encuentra el tipo de trabajo que comparten, los temas que lo cubren y por cuál empezar.',
  openGraph: {
    title: 'PostulaDo — Dejá de adivinar qué estudiar',
    description:
      'Un plan de estudio construido con las ofertas que vos ya estás mirando.',
    locale: 'es_AR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
