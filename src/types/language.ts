export type LanguageCode = 'pl' | 'en' | 'es' | 'de';

export type Language = {
  code: LanguageCode;
  /** English UI name */
  name: string;
  /** Name in that language (subtitle, Stitch-style). */
  endonym: string;
};
