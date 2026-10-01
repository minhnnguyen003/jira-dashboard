// Semantic badge colors. Values are CSS variables defined in globals.css so
// they follow the active theme (dark/light) with a single source of truth.
export type BadgeColor = { bg: string; text: string; border: string };

const tone = (name: 'accent' | 'success' | 'danger' | 'warning' | 'orange' | 'neutral'): BadgeColor => ({
  bg: `var(--${name}-bg)`,
  text: `var(--${name})`,
  border: `var(--${name}-border)`,
});

export const STATUS_MAP: Record<string, BadgeColor> = {
  'To Do': tone('neutral'),
  'In Progress': tone('accent'),
  'Done': tone('success'),
  'In Review': tone('warning'),
  'Waiting': tone('orange'),
  'Resolved': tone('success'),
  'Closed': tone('success'),
  'Open': tone('accent'),
};

export const PRIORITY_MAP: Record<string, BadgeColor> = {
  'Highest': tone('danger'),
  'High': tone('danger'),
  'Medium': tone('warning'),
  'Low': tone('success'),
  'Lowest': tone('neutral'),
  'None': tone('neutral'),
};

export const NEUTRAL_BADGE = tone('neutral');

// Surface/text colors shared by the modals. CSS variables, so every theme applies.
export const MODAL_COLORS = {
  cardBg: 'var(--modal-bg)',
  backdropBlur: 'var(--modal-backdrop)',
  border: 'var(--modal-border)',
  borderRow: 'var(--modal-row-border)',
  accent: 'var(--accent)',
  accentBg: 'var(--accent-bg)',
  accentBorder: 'var(--accent-border)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-dim)',
  textMuted: 'var(--text-muted)',
  cardBgInner: 'var(--modal-inner)',
  chipBg: 'var(--chip-bg)',
  chipBorder: 'var(--chip-border)',
  chipText: 'var(--text-secondary)',
  inputBg: 'var(--input-bg)',
  inputBorder: 'var(--input-border)',
};
