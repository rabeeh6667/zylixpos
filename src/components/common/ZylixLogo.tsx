import React from 'react';

interface ZylixLogoProps {
  size?: number;
  collapsed?: boolean;
  className?: string;
}

export const ZylixLogo: React.FC<ZylixLogoProps> = ({ size = 42, collapsed = false, className = '' }) => {
  return (
    <div className={`zylix-logo-container ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
      {/* LEFT: Modern Stylized Z Icon with Orange -> Pink -> Purple Gradient */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="zylix-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF7A59" />
            <stop offset="50%" stopColor="#F43F7A" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
          <filter id="zylix-glow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#F43F7A" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Rounded Squircle Container */}
        <rect width="44" height="44" rx="12" fill="url(#zylix-brand-grad)" filter="url(#zylix-glow)" />

        {/* Modern Stylized Ribbon Z */}
        <path
          d="M13.5 14.5 H30.5 L13.5 29.5 H30.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* CENTER/RIGHT: ZYLIX Wordmark, POS Badge, and Tagline (hidden if collapsed) */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: 1.1 }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: '1.375rem',
                letterSpacing: '-0.03em',
                color: '#0F172A',
                fontFamily: 'var(--font-sans)',
              }}
            >
              ZYLIX
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #FF7A59 0%, #F43F7A 50%, #A855F7 100%)',
                color: '#FFFFFF',
                padding: '2.5px 7px',
                borderRadius: '5px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                boxShadow: '0 2px 6px rgba(244, 63, 122, 0.25)',
                display: 'inline-block',
                lineHeight: 1,
              }}
            >
              POS
            </span>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: '#94A3B8',
              fontWeight: 500,
              marginTop: '3px',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            Powering Better Business.
          </span>
        </div>
      )}
    </div>
  );
};
