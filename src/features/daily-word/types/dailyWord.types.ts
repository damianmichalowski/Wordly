import type { WordDetails } from '../../word-details/types/wordDetails.types'

export type DailyWordAssignment = {
  daily_word_id: string
  word_id: string
  day_date: string
}

export type DailyWordResult = {
  assignment: DailyWordAssignment
  details: WordDetails
}
