import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: '"Trebuchet MS", "Gill Sans", sans-serif',
          background:
            'radial-gradient(circle at top left, #fff7cf 0, transparent 24%), linear-gradient(180deg, #fff1f7 0%, #fff9fc 48%, #ffeef5 100%)',
          color: '#341b36',
        }}
      >
        {children}
      </body>
    </html>
  );
}
