import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isErrorCode } from '#shared/errors.ts';
import { LOCALES, type Locale } from '#shared/validators/index.ts';
import { readLocal, writeLocal } from '../data/local.ts';
import { cs } from './cs.ts';
import { en } from './en.ts';

type MessageKey = keyof typeof cs;
type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}_other` ? Base : never;
}[MessageKey];
type Params = Record<string, string | number>;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { cs, en };

function interpolate(text: string, params?: Params): string {
  if (!params) {
    return text;
  }
  // Only the given names are replaced: ChordPro examples like {chorus} in a string stay.
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function initialLocale(): Locale {
  const stored = readLocal('locale');
  if (stored && (LOCALES as readonly string[]).includes(stored)) {
    return stored as Locale;
  }
  const preferred = navigator.languages.map((l) => l.slice(0, 2));
  return preferred.some((l) => l === 'cs' || l === 'sk') ? 'cs' : 'en';
}

function makeTranslator(locale: Locale) {
  const dict = dictionaries[locale];
  const plurals = new Intl.PluralRules(locale);
  const t = (key: MessageKey, params?: Params) => interpolate(dict[key], params);
  /** A count with its noun: tn('common.songs', 3) → "3 písničky". */
  const tn = (key: PluralKey, count: number) => {
    const form = plurals.select(count);
    const pluralKey = `${key}_${form}` as MessageKey;
    return interpolate(dict[pluralKey] ?? dict[`${key}_other` as MessageKey], { count });
  };
  /** The translated message for a server error, or the generic one. */
  const tError = (error: unknown) => {
    const message = (error as { message?: unknown } | null)?.message;
    return isErrorCode(message) ? t(`error.${message}`) : t('common.somethingWrong');
  };
  const dates = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  /** A day, as the reader writes it: "10. 11. 2026". */
  const formatDate = (iso: string) => dates.format(new Date(iso));
  /** Text in the reader's alphabetical order (Czech: Č after C, Ch after H), case aside. */
  const compare = new Intl.Collator(locale, { sensitivity: 'base' }).compare;
  return { t, tn, tError, formatDate, compare };
}

type I18n = ReturnType<typeof makeTranslator> & {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    writeLocal('locale', next);
    setLocaleState(next);
  }, []);
  // From the first render, not only on a switch: index.html says cs, and a screen reader picks
  // its voice by it.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({ ...makeTranslator(locale), locale, setLocale }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n needs an I18nProvider');
  }
  return value;
}
