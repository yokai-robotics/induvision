import english from "./en.json" with { type: "json" };

export type Locale = "fr" | "en";
export type TranslationValues = Record<string, string | number>;
export type Translator = (text: string, values?: TranslationValues) => string;
export const LOCALE_KEY = "induvision.language.v1";

const messages: Record<string, string> = english;

// Calculation and storage modules keep their original messages and data formats.
// Translate their parameterized messages only when displaying them in the UI.
const dynamicMessages = [
  { pattern: /^Enregistrement impossible : (.*)$/s, key: "Enregistrement impossible : {error}", names: ["error"] },
  { pattern: /^Import impossible : (.*)$/s, key: "Import impossible : {error}", names: ["error"] },
  { pattern: /^(\d+) étude\(s\) importée\(s\)\. Les références absentes du catalogue ont été remplacées\.$/, key: "{count} étude(s) importée(s). Les références absentes du catalogue ont été remplacées.", names: ["count"] },
  { pattern: /^Flou de mouvement supérieur à (.+) px\.$/, key: "Flou de mouvement supérieur à {limit} px.", names: ["limit"] },
  { pattern: /^Format de capteur incompatible \((.+) > (.+)\)\.$/, key: "Format de capteur incompatible ({camera} > {lens}).", names: ["camera", "lens"] },
  { pattern: /^Valeur invalide : (.+)\.$/, key: "Valeur invalide : {field}.", names: ["field"] }
];

export function translate(locale: Locale, text: string, values: TranslationValues = {}): string {
  const trimmed = text.trim();
  if (trimmed !== text && messages[trimmed]) {
    return text.slice(0, text.indexOf(trimmed)) + translate(locale, trimmed, values) + text.slice(text.indexOf(trimmed) + trimmed.length);
  }
  if (locale === "en" && !messages[text]) {
    for (const { pattern, key, names } of dynamicMessages) {
      const match = text.match(pattern);
      if (match) {
        const messageKey = names[0] === "count" && match[1] === "1"
          ? "{count} étude importée. Les références absentes du catalogue ont été remplacées."
          : key;
        return translate(locale, messageKey, Object.fromEntries(names.map((name, index) => [name, translate(locale, match[index + 1])])));
      }
    }
  }
  const template = locale === "en" ? messages[text] ?? text : text;
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => values[key] === undefined ? placeholder : String(values[key]));
}

export function localizedNumber(locale: Locale, value: number | null | undefined, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return translate(locale, "Non renseigné");
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}
