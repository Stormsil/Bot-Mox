export const uiTokens = {
  colors: {
    brand: 'var(--boxmox-color-primary)',
    textPrimary: 'var(--boxmox-color-text-primary)',
    textSecondary: 'var(--boxmox-color-text-secondary)',
    bgBase: 'var(--boxmox-color-bg-base)',
  },
  radius: {
    sm: 'var(--boxmox-radius-sm)',
    md: 'var(--boxmox-radius-md)',
    lg: 'var(--boxmox-radius-lg)',
  },
} as const;

export type UiTokens = typeof uiTokens;
