/**
 * Locale / direction config. RTL-first (Persian) with English sport terminology.
 * Components must use logical CSS properties (ms/me/ps/pe, start/end) so LTR works later.
 * TODO(i18n): move strings into message catalogs and read preference from profile.
 */
export type Locale = { lang: "fa" | "en"; dir: "rtl" | "ltr" };

export const LOCALE: Locale = { lang: "fa", dir: "rtl" };

export const faNumber = (n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("fa-IR", opts).format(n);
