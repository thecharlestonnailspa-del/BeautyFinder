import type { CSSProperties } from 'react';

export type OwnerMotionIconName =
  | 'audience'
  | 'bookings'
  | 'gallery'
  | 'inbox'
  | 'listings'
  | 'promotion'
  | 'rating'
  | 'review'
  | 'services'
  | 'studio'
  | 'team'
  | 'traffic';

const shellStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  borderRadius: 18,
  border: '1px solid rgba(113, 70, 90, 0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72)',
};

const palettes: Record<
  OwnerMotionIconName,
  { background: string; stroke: string; accent: string; soft: string }
> = {
  audience: {
    background: 'linear-gradient(135deg, #f6ece7, #fff8f4)',
    stroke: '#5e3b44',
    accent: '#d46a73',
    soft: '#f0c7b3',
  },
  bookings: {
    background: 'linear-gradient(135deg, #f5ede6, #fffaf6)',
    stroke: '#5b454d',
    accent: '#b96b62',
    soft: '#edd4c3',
  },
  gallery: {
    background: 'linear-gradient(135deg, #f4eee8, #fff9f4)',
    stroke: '#56424a',
    accent: '#ce806f',
    soft: '#e7ccbf',
  },
  inbox: {
    background: 'linear-gradient(135deg, #f5ece8, #fff9f6)',
    stroke: '#564049',
    accent: '#c26d76',
    soft: '#efd2ca',
  },
  listings: {
    background: 'linear-gradient(135deg, #f2eee7, #fffaf4)',
    stroke: '#59434b',
    accent: '#9f7a4c',
    soft: '#eadcc5',
  },
  promotion: {
    background: 'linear-gradient(135deg, #f8efe7, #fffaf3)',
    stroke: '#5f4342',
    accent: '#d07e52',
    soft: '#efd6bf',
  },
  rating: {
    background: 'linear-gradient(135deg, #fbf1e3, #fff9f0)',
    stroke: '#61463e',
    accent: '#d39b38',
    soft: '#f1ddb2',
  },
  review: {
    background: 'linear-gradient(135deg, #f6ece6, #fff9f6)',
    stroke: '#5e4347',
    accent: '#be7564',
    soft: '#efd1c6',
  },
  services: {
    background: 'linear-gradient(135deg, #f6ece7, #fff9f7)',
    stroke: '#584248',
    accent: '#c96c7f',
    soft: '#efcfda',
  },
  studio: {
    background: 'linear-gradient(135deg, #f4ece9, #fff9f5)',
    stroke: '#56414a',
    accent: '#9e5870',
    soft: '#e7ced6',
  },
  team: {
    background: 'linear-gradient(135deg, #f4ede8, #fffaf5)',
    stroke: '#58424a',
    accent: '#c37c68',
    soft: '#edd0c5',
  },
  traffic: {
    background: 'linear-gradient(135deg, #f5ede8, #fff9f4)',
    stroke: '#5a4348',
    accent: '#ae7f4e',
    soft: '#eedcc9',
  },
};

function renderIcon(name: OwnerMotionIconName, stroke: string, accent: string, soft: string) {
  switch (name) {
    case 'bookings':
      return (
        <>
          <rect x="8" y="10" width="32" height="28" rx="8" stroke={stroke} strokeWidth="2.2" />
          <path d="M15 8v7M33 8v7M8 18h32" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <rect x="15" y="23" width="18" height="8" rx="4" fill={soft} />
          <circle cx="18" cy="27" r="3" fill={accent}>
            <animate attributeName="cx" values="18;30;18" dur="2.8s" repeatCount="indefinite" />
          </circle>
        </>
      );
    case 'inbox':
      return (
        <>
          <path
            d="M10 15.5C10 12.46 12.46 10 15.5 10h17C35.54 10 38 12.46 38 15.5v13C38 31.54 35.54 34 32.5 34h-7.3L20.7 38l-1.53-4H15.5C12.46 34 10 31.54 10 28.5v-13Z"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {[0, 1, 2].map((dot) => (
            <circle key={dot} cx={18 + dot * 6} cy="22" r="2.2" fill={accent}>
              <animate
                attributeName="opacity"
                values="0.25;1;0.25"
                dur="1.5s"
                begin={`${dot * 0.2}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </>
      );
    case 'audience':
      return (
        <>
          <circle cx="24" cy="24" r="4" fill={accent} />
          <circle cx="24" cy="24" r="10" stroke={soft} strokeWidth="2" />
          <circle cx="24" cy="24" r="16" stroke={stroke} strokeWidth="2.2" />
          <path d="M24 8a16 16 0 0 1 0 32" stroke={soft} strokeWidth="2" strokeLinecap="round" />
          <g>
            <circle cx="24" cy="8" r="3.2" fill={accent}>
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="0 24 24"
                to="360 24 24"
                dur="5.8s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </>
      );
    case 'review':
      return (
        <>
          <path
            d="M24 9l10 4v8c0 6.1-3.84 11.3-10 14-6.16-2.7-10-7.9-10-14v-8l10-4Z"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <rect x="22.35" y="16" width="3.3" height="10" rx="1.65" fill={accent}>
            <animate attributeName="height" values="10;13;10" dur="2.2s" repeatCount="indefinite" />
          </rect>
          <circle cx="24" cy="30.5" r="2" fill={accent} />
        </>
      );
    case 'rating':
      return (
        <>
          <path
            d="M24 10.5l4.25 8.62 9.5 1.38-6.87 6.7 1.62 9.47L24 32.2l-8.5 4.47 1.62-9.47-6.87-6.7 9.5-1.38L24 10.5Z"
            fill={soft}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M34.5 11.5l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3Z" fill={accent}>
            <animate attributeName="opacity" values="0.25;1;0.25" dur="1.8s" repeatCount="indefinite" />
          </path>
        </>
      );
    case 'listings':
      return (
        <>
          <path d="M11 19h26v16H11V19Z" stroke={stroke} strokeWidth="2.2" />
          <path d="M9 19h30l-2-7H11l-2 7Z" fill={soft} stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M17 25v10M31 25v10" stroke={soft} strokeWidth="2" strokeLinecap="round" />
          <rect x="20.5" y="25" width="7" height="10" rx="3.5" fill={accent}>
            <animate attributeName="y" values="25;23.5;25" dur="2.4s" repeatCount="indefinite" />
          </rect>
        </>
      );
    case 'studio':
      return (
        <>
          <path d="M11 16h26M11 24h26M11 32h26" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="18" cy="16" r="4" fill={accent}>
            <animate attributeName="cx" values="18;29;18" dur="3.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="29" cy="24" r="4" fill={soft}>
            <animate attributeName="cx" values="29;18;29" dur="2.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="22" cy="32" r="4" fill={accent}>
            <animate attributeName="cx" values="22;32;22" dur="3.5s" repeatCount="indefinite" />
          </circle>
        </>
      );
    case 'gallery':
      return (
        <>
          <rect x="9" y="11" width="30" height="24" rx="7" stroke={stroke} strokeWidth="2.2" />
          <circle cx="18.5" cy="18.5" r="3.5" fill={soft} />
          <path d="M14 31l7-7 4.5 4.5L30 23l5 8H14Z" fill={accent} opacity="0.86" />
          <path d="M33.5 11l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3Z" fill={accent}>
            <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite" />
          </path>
        </>
      );
    case 'promotion':
      return (
        <>
          <path
            d="M12 18.5c2.5 0 4-2.04 4-4.5h16c0 2.46 1.5 4.5 4 4.5v11c-2.5 0-4 2.04-4 4.5H16c0-2.46-1.5-4.5-4-4.5v-11Z"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="19" cy="21" r="2.5" fill={accent} />
          <circle cx="29" cy="29" r="2.5" fill={accent} />
          <path d="M30.5 18.5 17.5 31.5" stroke={soft} strokeWidth="2.2" strokeLinecap="round">
            <animate attributeName="opacity" values="0.35;1;0.35" dur="1.8s" repeatCount="indefinite" />
          </path>
        </>
      );
    case 'services':
      return (
        <>
          <rect x="16" y="12" width="16" height="22" rx="5" stroke={stroke} strokeWidth="2.2" />
          <path d="M20 12V9h8v3" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M20 23h8" stroke={soft} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 18.5c2.6 0 4.5-1.9 4.5-4.5" stroke={accent} strokeWidth="2.2" strokeLinecap="round">
            <animate attributeName="opacity" values="0.35;1;0.35" dur="1.6s" repeatCount="indefinite" />
          </path>
          <path d="M24 18.5c-2.6 0-4.5-1.9-4.5-4.5" stroke={accent} strokeWidth="2.2" strokeLinecap="round">
            <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />
          </path>
        </>
      );
    case 'team':
      return (
        <>
          <circle cx="18" cy="19" r="5" fill={soft} stroke={stroke} strokeWidth="2" />
          <circle cx="30" cy="17" r="4" fill={accent} opacity="0.9" />
          <path d="M11.5 33c1.7-4.3 5.2-6.5 10.5-6.5s8.8 2.2 10.5 6.5" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M28 31c.9-2.7 2.9-4.1 6-4.1 3.1 0 5.1 1.4 6 4.1" stroke={accent} strokeWidth="2.2" strokeLinecap="round">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
          </path>
        </>
      );
    case 'traffic':
      return (
        <>
          <path d="M11 33h26" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 28l6-7 5 4 9-11" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="34" cy="14" r="3" fill={accent}>
            <animate attributeName="r" values="3;4.2;3" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      );
  }
}

export function OwnerMotionIcon({
  name,
  size = 44,
}: {
  name: OwnerMotionIconName;
  size?: number;
}) {
  const palette = palettes[name];
  const iconSize = Math.round(size * 0.56);

  return (
    <span
      aria-hidden="true"
      style={{
        ...shellStyle,
        width: size,
        height: size,
        background: palette.background,
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {renderIcon(name, palette.stroke, palette.accent, palette.soft)}
      </svg>
    </span>
  );
}
