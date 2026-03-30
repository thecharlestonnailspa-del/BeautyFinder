'use client';

import { useState } from 'react';

export function PublicIdChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        color: '#8e657b',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      <span>{label}</span>
      <code
        style={{
          background: '#fff7fa',
          border: '1px solid #f0cad8',
          borderRadius: 999,
          padding: '4px 8px',
          color: '#4f2d3f',
          fontSize: 12,
          textTransform: 'none',
        }}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          void handleCopy();
        }}
        style={{
          border: '1px solid #f0cad8',
          background: copied ? '#ffedf4' : '#ffffff',
          color: copied ? '#b11f54' : '#8e657b',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 800,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {copied ? 'Copied' : 'Copy ID'}
      </button>
    </span>
  );
}
