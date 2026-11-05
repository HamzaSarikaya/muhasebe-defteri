import Decimal from 'decimal.js';

const Exact = Decimal.clone({precision: 50, rounding: Decimal.ROUND_HALF_UP});
const maxMinor = 9223372036854775807n;
export const currencies = ['TRY', 'USD', 'EUR'] as const;
export type Currency = typeof currencies[number];

export function currency(value: string): Currency {
  if (!currencies.includes(value as Currency)) throw new RangeError('currency');
  return value as Currency;
}

// Accept ungrouped decimal input in either interface language.
export function minor(value: string, allowZero = false): bigint {
  if (!/^\d{1,17}([.,]\d{1,2})?$/.test(value)) throw new RangeError('amount');
  const result = BigInt(new Exact(value.replace(',', '.')).times(100).toFixed(0));
  if (result > maxMinor || (!allowZero && result === 0n)) throw new RangeError('amount');
  return result;
}

export function rate(value: string): string {
  if (!/^\d{1,12}([.,]\d{1,6})?$/.test(value)) throw new RangeError('rate');
  const result = new Exact(value.replace(',', '.'));
  if (!result.isPositive() || result.isZero()) throw new RangeError('rate');
  return result.toFixed();
}

export function convert(amount: bigint, exchangeRate: string): bigint {
  return BigInt(new Exact(amount.toString()).times(rate(exchangeRate)).toFixed(0));
}

export function decimalAmount(amount: bigint): string {
  return new Exact(amount.toString()).div(100).toFixed(2);
}

export function formatMoney(amount: string | bigint, unit: Currency, locale: string) {
  // Intl accepts exact decimal strings at runtime (ECMA-402).
  const format = new Intl.NumberFormat(locale, {style: 'currency', currency: unit}).format as unknown as (v: string) => string;
  return format(decimalAmount(BigInt(amount)));
}

export function installments(total: bigint, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 120 || total < BigInt(count)) throw new RangeError('installments');
  const part = total / BigInt(count);
  return Array.from({length: count}, (_, i) => i === 0 ? part + total % BigInt(count) : part);
}

