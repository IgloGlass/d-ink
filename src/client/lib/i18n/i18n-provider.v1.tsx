import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import en from "./locales/en.v1.json";

export type LocaleCodeV1 = "en";
export type TranslationKeyV1 = keyof typeof en;

type TranslateParamsV1 = Record<string, string | number>;

type I18nContextValueV1 = {
  locale: LocaleCodeV1;
  setLocale: (locale: LocaleCodeV1) => void;
  t: (key: TranslationKeyV1, params?: TranslateParamsV1) => string;
};

const localeByCodeV1 = {
  en,
} as const satisfies Record<LocaleCodeV1, Record<TranslationKeyV1, string>>;

const I18nContextV1 = createContext<I18nContextValueV1 | null>(null);

function interpolateV1(template: string, params?: TranslateParamsV1): string {
  if (!params) {
    return template;
  }

  return template.replaceAll(/\{([^}]+)\}/g, (match, groupName: string) => {
    const value = params[groupName];
    return value === undefined ? match : String(value);
  });
}

export function I18nProviderV1({
  children,
  defaultLocale = "en",
}: {
  children: ReactNode;
  defaultLocale?: LocaleCodeV1;
}) {
  const [locale, setLocale] = useState<LocaleCodeV1>(defaultLocale);

  const value = useMemo<I18nContextValueV1>(() => {
    return {
      locale,
      setLocale,
      t: (key, params) => {
        const translated = localeByCodeV1[locale][key];
        return interpolateV1(translated ?? key, params);
      },
    };
  }, [locale]);

  return (
    <I18nContextV1.Provider value={value}>{children}</I18nContextV1.Provider>
  );
}

export function useI18nContextV1(): I18nContextValueV1 {
  const value = useContext(I18nContextV1);
  if (!value) {
    throw new Error("useI18nContextV1 must be used inside I18nProviderV1.");
  }

  return value;
}
