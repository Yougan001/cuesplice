import type { Metadata } from 'next';
import './globals.css';
const origin = 'https://yougan001.github.io';
export const metadata: Metadata = {
  title: 'CueSplice — retime subtitles after video cuts',
  description:
    'Remove sections from an SRT or WebVTT timeline without manually shifting every later cue. Private, local processing with an inspectable change report.',
  metadataBase: new URL(origin),
  alternates: { canonical: '/cuesplice/' },
  icons: {
    icon: process.env.GITHUB_PAGES ? '/cuesplice/favicon.svg' : '/favicon.svg',
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
