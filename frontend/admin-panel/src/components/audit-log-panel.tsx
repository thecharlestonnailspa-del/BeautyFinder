import type { AdminActionRecord } from '@beauty-finder/types';

function formatActionLabel(action: string) {
  return action.replace(/_/g, ' ');
}

export function AuditLogPanel({
  actions,
}: {
  actions: AdminActionRecord[];
}) {
  return (
    <section
      style={{
        background: '#fffafc',
        borderRadius: 30,
        padding: 24,
        border: '1px solid #f0c8d6',
        display: 'grid',
        gap: 16,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <p
          style={{
            margin: 0,
            color: '#ff4f8c',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Audit Log
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>Recent admin actions</h2>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {actions.map((action) => (
          <article
            key={action.id}
            style={{
              display: 'grid',
              gap: 8,
              background: '#ffffff',
              borderRadius: 22,
              padding: 16,
              border: '1px solid #f0cad8',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 14,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div style={{ color: '#341b36', fontWeight: 800 }}>
                {formatActionLabel(action.action)} · {action.targetType} {action.targetId}
              </div>
              <div style={{ color: '#8e657b', fontSize: 13, fontWeight: 700 }}>
                {new Date(action.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ color: '#6d5060' }}>By {action.adminName}</div>
            {action.metadata ? (
              <div
                style={{
                  color: '#5c4456',
                  background: '#fff7fa',
                  borderRadius: 16,
                  padding: 12,
                  lineHeight: 1.6,
                }}
              >
                {action.metadata}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
