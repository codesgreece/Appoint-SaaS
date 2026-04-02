import type { AppLanguage } from "@/contexts/LanguageContext"

/** BCP 47 locale for Intl / toLocaleDateString */
export function appLocaleTag(lang: AppLanguage): string {
  if (lang === "el") return "el-GR"
  if (lang === "de") return "de-DE"
  return "en-GB"
}

export function pickLang(language: AppLanguage, m: Record<AppLanguage, string>): string {
  return m[language]
}

/** English / Greek / German UI string (common pattern in forms). */
export function uiLang(language: AppLanguage, en: string, el: string, de: string): string {
  if (language === "el") return el
  if (language === "de") return de
  return en
}

/** Locale string for `String.localeCompare` sorting. */
export function appCollatorLocale(lang: AppLanguage): string {
  if (lang === "en") return "en"
  if (lang === "de") return "de"
  return "el"
}
