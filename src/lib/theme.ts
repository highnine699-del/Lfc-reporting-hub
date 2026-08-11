/**
 * Shared design tokens matching the sign-in glassmorphism theme.
 * Import these in every page instead of repeating inline styles.
 */
import type { CSSProperties } from 'react';

// ── Colours ──────────────────────────────────────────────────
export const C = {
  bg: '#080A0F',
  textPrimary: '#F5F7FA',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  accent: '#4F46E5',
  accentHover: '#4338CA',
  border: 'rgba(255, 255, 255, 0.11)',
  borderFocus: 'rgba(79, 70, 229, 0.35)',
  glass: 'rgba(18, 21, 28, 0.72)',
  glassDarker: 'rgba(12, 14, 20, 0.85)',
  glassLighter: 'rgba(255, 255, 255, 0.035)',
  success: 'rgba(34, 197, 94, 0.12)',
  successBorder: 'rgba(34, 197, 94, 0.25)',
  successText: '#4ADE80',
  error: 'rgba(239, 68, 68, 0.08)',
  errorBorder: 'rgba(239, 68, 68, 0.15)',
  errorText: '#FCA5A5',
  warning: 'rgba(234, 179, 8, 0.08)',
  warningBorder: 'rgba(234, 179, 8, 0.2)',
  warningText: '#FDE68A',
  separator: 'rgba(255, 255, 255, 0.09)',
  highlight: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
  accentGlow: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
};

// ── Reusable style objects ────────────────────────────────────

/** Full-page dark background wrapper */
export const pageStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: C.bg,
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  color: C.textPrimary,
};

/** Glass card panel */
export const glassCard: CSSProperties = {
  background: C.glass,
  border: `1px solid ${C.border}`,
  backdropFilter: 'blur(24px) saturate(120%)',
  WebkitBackdropFilter: 'blur(24px) saturate(120%)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
  borderRadius: '16px',
  padding: '24px',
  boxSizing: 'border-box',
};

/** Darker/more opaque glass card for secondary sections */
export const glassCardDark: CSSProperties = {
  ...glassCard,
  background: C.glassDarker,
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
};

/** Glass header bar */
export const glassHeader: CSSProperties = {
  background: 'rgba(12, 14, 20, 0.80)',
  borderBottom: `1px solid ${C.border}`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
};

/** Text input */
export const glassInput: CSSProperties = {
  height: '44px',
  borderRadius: '10px',
  background: C.glassLighter,
  border: `1px solid ${C.border}`,
  padding: '0 12px',
  color: C.textPrimary,
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'all 0.15s',
};

/** Primary button */
export const primaryBtn: CSSProperties = {
  height: '44px',
  borderRadius: '10px',
  background: C.accent,
  border: 'none',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
  width: '100%',
  boxSizing: 'border-box',
};

/** Ghost / secondary button */
export const ghostBtn: CSSProperties = {
  height: '44px',
  borderRadius: '10px',
  background: C.glassLighter,
  border: `1px solid ${C.border}`,
  color: C.textSecondary,
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
  width: '100%',
  boxSizing: 'border-box',
};

/** Danger button */
export const dangerBtn: CSSProperties = {
  ...primaryBtn,
  background: 'rgba(239,68,68,0.18)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#FCA5A5',
};

/** Small badge */
export const badge = (colour: 'green' | 'yellow' | 'red' | 'indigo' | 'gray'): CSSProperties => {
  const map = {
    green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', text: '#4ADE80' },
    yellow: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.25)', text: '#FDE68A' },
    red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', text: '#FCA5A5' },
    indigo: { bg: 'rgba(79,70,229,0.15)', border: 'rgba(79,70,229,0.3)', text: '#A5B4FC' },
    gray: { bg: 'rgba(255,255,255,0.06)', border: C.border, text: C.textSecondary },
  };
  const { bg, border, text } = map[colour];
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: '6px',
    fontSize: '11px', fontWeight: 600,
    background: bg, border: `1px solid ${border}`, color: text,
  };
};

/** Focus handlers for inputs — kept for external use if needed */
export const inputFocus = (el: HTMLElement) => {
  (el as HTMLInputElement).style.borderColor = C.borderFocus;
  (el as HTMLInputElement).style.background = 'rgba(255,255,255,0.05)';
  (el as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(79,70,229,0.08)';
};
export const inputBlur = (el: HTMLElement) => {
  (el as HTMLInputElement).style.borderColor = C.border;
  (el as HTMLInputElement).style.background = C.glassLighter;
  (el as HTMLInputElement).style.boxShadow = 'none';
};
