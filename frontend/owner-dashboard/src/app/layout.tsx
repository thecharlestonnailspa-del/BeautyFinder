import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: '"Trebuchet MS", "Gill Sans", sans-serif',
          background:
            'radial-gradient(circle at top left, #fff6c5 0, transparent 24%), linear-gradient(180deg, #ffeef5 0%, #fff8fc 52%, #fff1f7 100%)',
          color: '#341b36',
        }}
      >
        {children}
      </body>
    </html>
  );
}
