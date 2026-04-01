import { rpc } from '@/src/lib/supabase/rpc'

import type { WordDetails } from '../types/wordDetails.types'

export async function getWordDetails(wordId: string): Promise<WordDetails> {
  const { data, error } = await rpc('get_word_details', {
    p_word_id: wordId,
  })

  if (error) {
    throw new Error(`Failed to get word details: ${error.message}`)
  }

  if (!data) {
    throw new Error('Word details not found')
  }

  return data as WordDetails
}
