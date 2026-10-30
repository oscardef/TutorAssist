/** Quick tags tutors attach to feedback on an attempt. */
export const ERROR_TAGS = ['Arithmetic slip', 'Sign error', 'Method', 'Notation', 'Misread the question', 'Rounding', 'Units', 'Incomplete', 'Well done']

export interface FeedbackItem {
  id: string
  attempt_id: string
  comment: string | null
  error_tags: string[] | null
  is_private: boolean
  created_at: string
}
