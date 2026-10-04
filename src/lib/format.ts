// Eingaben lesen und Zahlen deutsch formatieren.

/**
 * Liest eine Zahl, wie man sie in Deutschland tippt:
 * "12,50", "1.234,56", "1234.5", "1.000", "12 €".
 * Gibt null zurück, wenn es keine gültige Zahl ist.
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[€\s]/g, '');
  if (s === '') return null;

  if (s.includes(',')) {
    // Komma = Dezimaltrennzeichen, Punkte = Tausendertrennzeichen
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.000" oder "1.234.567" = Tausenderpunkte
    s = s.replace(/\./g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

const euroFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function formatEuro(value: number): string {
  return euroFormatter.format(value);
}

/** Zahl für ein Eingabefeld, z. B. 12.5 → "12,50", 40 → "40". */
export function formatInput(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(decimals).replace('.', ',');
}

/** Stunden als "8 Std. 15 Min.", kleine Werte als "unter 1 Min." */
export function formatDuration(hours: number): string {
  if (!(hours > 0)) return '0 Min.';
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 1) return 'unter 1 Min.';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} Min.`;
  const hText = `${h.toLocaleString('de-DE')} Std.`;
  return m === 0 ? hText : `${hText} ${m} Min.`;
}

/** Tage mit einer Nachkommastelle, z. B. "1,5 Arbeitstage". */
export function formatWorkDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  const text = rounded.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return `${text} ${rounded === 1 ? 'Arbeitstag' : 'Arbeitstage'}`;
}
