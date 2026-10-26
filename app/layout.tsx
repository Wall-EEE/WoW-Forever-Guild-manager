import type { Metadata } from 'next';
import './globals.css';
import './auth-styles.css';

export const metadata: Metadata = { title: 'WoW Forever | Guild Command Center', description: 'Guild and guest raid management.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
