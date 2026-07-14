import type { Metadata } from 'next';
import { Space_Grotesk, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Display: distinctive grotesk for headings & numeric emphasis.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});
// Body: humanist sans, comfortable at small sizes.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-hanken',
});
// Mono: technical values, hashes, logs.
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Prerender Manager',
  description: 'Pilotage du pré-rendu et du déploiement Vercel des sites Lovable.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${spaceGrotesk.variable} ${hanken.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
