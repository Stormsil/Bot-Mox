import type React from 'react';

type BotMoxLogoProps = {
  compact?: boolean;
};

export const BotMoxLogo: React.FC<BotMoxLogoProps> = ({ compact = false }) => {
  return (
    <span className="botmox-logo" role="img" aria-label="Bot-Mox">
      <svg
        className="botmox-logo__mark"
        viewBox="0 0 64 64"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="botmox-logo-gradient" x1="8" y1="10" x2="52" y2="54">
            <stop offset="0%" stopColor="var(--botmox-color-brand-primary)" />
            <stop offset="100%" stopColor="var(--botmox-color-brand-secondary)" />
          </linearGradient>
        </defs>
        <rect x="6" y="8" width="52" height="48" rx="14" fill="url(#botmox-logo-gradient)" />
        <path
          d="M20 22 L28 22 L32 30 L36 22 L44 22 L44 42 L38 42 L38 31 L33.5 38 L30.5 38 L26 31 L26 42 L20 42 Z"
          fill="var(--botmox-color-header-text)"
        />
        <circle cx="25" cy="18" r="3" fill="var(--botmox-color-brand-secondary)" />
        <circle cx="39" cy="18" r="3" fill="var(--botmox-color-brand-secondary)" />
        <rect
          x="27"
          y="45"
          width="10"
          height="3"
          rx="1.5"
          fill="var(--botmox-color-header-text-muted)"
          opacity="0.9"
        />
      </svg>
      {!compact ? (
        <span className="botmox-logo__type">
          <span className="botmox-logo__title">Bot-Mox</span>
          <span className="botmox-logo__subtitle">Control Surface</span>
        </span>
      ) : null}
    </span>
  );
};
