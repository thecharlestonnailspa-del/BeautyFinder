'use client';

import { useRouter } from 'next/navigation';
import { clearAdminSession } from '../lib/admin-api';

export function AdminSessionControls({ adminName }: { adminName: string }) {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div
        style={{
          background: '#fff9fb',
          color: '#8e657b',
          borderRadius: 999,
          padding: '10px 14px',
          border: '1px solid #f0cad8',
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        {adminName}
      </div>
      <button
        type="button"
        onClick={() => {
          void clearAdminSession().finally(() => {
            router.replace('/auth');
            router.refresh();
          });
        }}
        style={{
          border: '1px solid #f0cad8',
          background: '#ffffff',
          color: '#c72d63',
          borderRadius: 999,
          padding: '10px 14px',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </div>
  );
}
