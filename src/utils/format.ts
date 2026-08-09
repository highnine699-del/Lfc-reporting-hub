import type { PeriodType } from '../types';

/**
 * Format a number as Nigerian Naira currency.
 * e.g. 150000 → "₦150,000"
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value == null || typeof value !== 'number') return '₦0';
  return `₦${value.toLocaleString('en-NG')}`;
}

/**
 * Format a date string or Date object for display.
 * e.g. "2026-07-01" → "1 Jul 2026"
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format a date+time string for display.
 * e.g. "2026-07-01T14:30:00Z" → "1 Jul 2026, 14:30"
 */
export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Human-readable label for a period type.
 * e.g. "half_year" → "Half-Yearly"
 */
export const PERIOD_LABELS: Record<PeriodType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_year: 'Half-Yearly',
  yearly: 'Yearly',
};

export function formatPeriodType(periodType: PeriodType | string): string {
  return PERIOD_LABELS[periodType as PeriodType] ?? periodType;
}

/**
 * Capitalise the first letter of a string.
 */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
