export type WordCategory = {
  id: string
  code: string
  name: string
}

export type WordCefr = {
  id: string
  code: string
  order_index: number
}

export type WordLanguage = {
  id: string
  code: string
  name: string
}

export type WordPartOfSpeech = {
  id: string
  code: string
  name: string
  order_index: number
}

export type WordExample = {
  id: string
  text: string
  order: number
}

export type WordTranslation = {
  id: string
  text: string
  native_language_id: string
  examples: WordExample[]
}

export type WordSense = {
  sense_id: string
  sense_order: number
  part_of_speech: WordPartOfSpeech
  translation: WordTranslation
}

export type WordDetails = {
  word_id: string
  lemma: string
  ipa: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  cefr: WordCefr
  target_language: WordLanguage
  categories: WordCategory[]
  senses: WordSense[]
}
