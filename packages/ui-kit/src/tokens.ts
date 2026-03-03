export const uiTokens = {
  colors: {
    brand: 'var(--botmox-color-primary)',
    textPrimary: 'var(--botmox-color-text-primary)',
    textSecondary: 'var(--botmox-color-text-secondary)',
    bgBase: 'var(--botmox-color-bg-base)',
  },
  radius: {
    sm: 'var(--botmox-radius-sm)',
    md: 'var(--botmox-radius-md)',
    lg: 'var(--botmox-radius-lg)',
  },
} as const;

export type UiTokens = typeof uiTokens;
