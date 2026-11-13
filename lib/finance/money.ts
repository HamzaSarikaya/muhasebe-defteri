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
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > maxMinor || (!allowZero && result === 0n)) throw new RangeError('amount');
  return result;
}

export function rate(value: string): string {
  if (!/^\d{1,12}([.,]\d{1,6})?$/.test(value)) throw new RangeError('rate');
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const digits = fraction.replace(/0+$/, '');
  const result = BigInt(whole).toString() + (digits ? '.' + digits : '');
  if (result === '0') throw new RangeError('rate');
  return result;
}

export function convert(amount: bigint, exchangeRate: string): bigint {
  const [whole, fraction = ''] = rate(exchangeRate).split('.');
  const scale = 10n ** BigInt(fraction.length);
  const product = amount * BigInt(whole + fraction);
  // ROUND_HALF_UP, including negative amounts, without floating-point values.
  const rounded = ((product < 0n ? -product : product) + scale / 2n) / scale;
  return product < 0n ? -rounded : rounded;
}

export function decimalAmount(amount: bigint): string {
  const digits = (amount < 0n ? -amount : amount).toString().padStart(3, '0');
  return (amount < 0n ? '-' : '') + digits.slice(0, -2) + '.' + digits.slice(-2);
}

// Cache formatter configuration only; financial values never enter this cache.
const formatters = new Map<string, Intl.NumberFormat>();
export function formatMoney(amount: string | bigint, unit: Currency, locale: string) {
  const key = locale + '/' + unit;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {style: 'currency', currency: unit});
    if (formatters.size >= 24) formatters.delete(formatters.keys().next().value!);
    formatters.set(key, formatter);
  }
  // Intl accepts exact decimal strings at runtime (ECMA-402).
  const format = formatter.format as unknown as (v: string) => string;
  return format(decimalAmount(BigInt(amount)));
}

export function installments(total: bigint, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 120 || total < BigInt(count)) throw new RangeError('installments');
  const part = total / BigInt(count);
  return Array.from({length: count}, (_, i) => i === 0 ? part + total % BigInt(count) : part);
}

