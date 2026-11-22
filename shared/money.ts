/**
 * Money is stored as an integer in the currency's minor unit (ISO 4217): cents for USD,
 * whole shillings for UGX (which has no minor unit). Providers speak major units.
 */
export function minorDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ??
      2
    );
  } catch {
    return 2;
  }
}

export const toMajor = (minor: number, currency: string) => minor / 10 ** minorDigits(currency);

export const toMinor = (major: number, currency: string) => Math.round(major * 10 ** minorDigits(currency));

/** "$10", "$9.50", "UGX 10,000". Whole amounts drop the decimals. */
export function formatMoney(minor: number, currency: string): string {
  const major = toMajor(minor, currency);
  const whole = Number.isInteger(major);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: whole ? 0 : minorDigits(currency),
      maximumFractionDigits: minorDigits(currency),
    }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString('en-US')}`;
  }
}
