export const locales = ['tj', 'ru'] as const;
export const defaultLocale = 'tj' as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  tj: 'Тоҷикӣ',
  ru: 'Русский',
};

export const localeShort: Record<Locale, string> = {
  tj: 'TJ',
  ru: 'RU',
};
