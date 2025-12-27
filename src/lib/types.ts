// Database types for TutorAssist
// These types correspond to the Supabase schema

export type UserRole = 'platform_owner' | 'tutor' | 'student'

export type QuestionOrigin = 'manual' | 'ai_generated' | 'imported' | 'variant'
export type QuestionStatus = 'active' | 'needs_review' | 'archived' | 'draft'
export type AnswerType = 'exact' | 'numeric' | 'multiple_choice' | 'expression'

export type JobType = 
  | 'EXTRACT_MATERIAL'
  | 'GENERATE_QUESTIONS'
  | 'GENERATE_QUESTIONS_BATCH'
  | 'BATCH_GENERATE'
  | 'GENERATE_PDF'
  | 'REGEN_VARIANT'
  | 'DAILY_SPACED_REP_REFRESH'
  | 'PROCESS_BATCH_RESULT'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'batch_pending'

export interface Workspace {
  id: string
  name: string
  slug: string
  settings_json: WorkspaceSettings
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  allowStudentPractice?: boolean
  practiceRateLimit?: number
  defaultDifficulty?: number
  enableSpacedRepetition?: boolean
  questionGenerationEnabled?: boolean
}

export interface WorkspaceMember {
  id: string
  workspace_id: string | null
  user_id: string
  role: UserRole
  invited_at: string | null
  joined_at: string
  created_at: string
}

export interface InviteToken {
  id: string
  workspace_id: string
  token: string
  student_profile_id: string | null
  email: string | null
  expires_at: string
  used_at: string | null
  created_by: string
  created_at: string
}

export interface StudentProfile {
  id: string
  workspace_id: string
  user_id: string | null
  name: string
  email: string | null
  age: number | null
  school: string | null
  grade_current: string | null
  grade_rollover_month: number
  private_notes: string | null
  tags: string[]
  settings_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ============================================
// CURRICULUM & PROGRAM TYPES
// ============================================

export interface StudyProgram {
  id: string
  workspace_id: string
  code: string // 'IB', 'AP', 'GCSE', 'ALEVEL', 'GENERAL'
  name: string // 'International Baccalaureate'
  description: string | null
  color: string
  order_index: number
  is_active: boolean
  created_at: string
}

export interface GradeLevel {
  id: string
  workspace_id: string
  program_id: string | null
  code: string // 'M8', 'M9', 'DP1', 'DP2', 'AP1', etc.
  name: string // 'MYP Year 8', 'DP Year 1'
  description: string | null
  year_number: number | null
  order_index: number
  is_active: boolean
  created_at: string
  // Relations (populated by joins)
  program?: StudyProgram
}

export interface Topic {
  id: string
  workspace_id: string
  name: string
  description: string | null
  parent_id: string | null
  program_id: string | null
  grade_level_id: string | null
  is_core: boolean
  curriculum_code: string | null
  tags: string[]
  order_index: number
  created_at: string
  // Relations (populated by joins)
  program?: StudyProgram
  grade_level?: GradeLevel
}

export interface SourceMaterial {
  id: string
  workspace_id: string
  uploaded_by: string
  r2_key: string
  original_filename: string
  type: 'pdf' | 'image' | 'text'
  mime_type: string | null
  size_bytes: number | null
  extracted_text: string | null
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed'
  metadata_json: Record<string, unknown>
  created_at: string
}

export interface Question {
  id: string
  workspace_id: string
  topic_id: string | null
  source_material_id: string | null
  origin: QuestionOrigin
  status: QuestionStatus
  prompt_text: string
  prompt_latex: string | null
  prompt_image_r2_key: string | null
  answer_type: AnswerType
  correct_answer_json: CorrectAnswer
  tolerance: number | null
  solution_steps_json: SolutionStep[]
  hints_json: string[]
  difficulty: number | null
  calculator_allowed: boolean
  estimated_minutes: number
  tags_json: string[]
  curriculum_json: Record<string, unknown>
  quality_score: number | null
  times_attempted: number
  times_correct: number
  avg_time_seconds: number | null
  parent_question_id: string | null
  variant_seed: string | null
  // Program/Grade fields
  primary_program_id: string | null
  primary_grade_level_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations (populated by joins)
  topic?: Topic
  primary_program?: StudyProgram
  primary_grade_level?: GradeLevel
  programs?: StudyProgram[]
  grade_levels?: GradeLevel[]
}

export interface CorrectAnswer {
  value: string | number
  alternatives?: string[]
  unit?: string
  tolerance?: number
  choices?: { text: string; latex?: string }[]
  correct?: number
}

export interface SolutionStep {
  step: string
  result: string
  latex?: string
}

export interface Assignment {
  id: string
  workspace_id: string
  created_by: string
  assigned_student_user_id: string | null
  student_profile_id: string | null
  title: string
  description: string | null
  due_at: string | null
  settings_json: AssignmentSettings
  status: 'draft' | 'active' | 'completed' | 'archived'
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AssignmentSettings {
  shuffle?: boolean
  timeLimit?: number
  showHints?: boolean
  showSolutions?: boolean
  allowRetry?: boolean
}

export interface AssignmentItem {
  id: string
  assignment_id: string
  question_id: string
  order_index: number
  points: number
  settings_json: Record<string, unknown>
  created_at: string
}

export interface Attempt {
  id: string
  workspace_id: string
  student_user_id: string
  question_id: string
  assignment_id: string | null
  assignment_item_id: string | null
  answer_raw: string | null
  answer_parsed: unknown
  is_correct: boolean | null
  partial_credit: number | null
  started_at: string | null
  submitted_at: string
  time_spent_seconds: number | null
  hints_viewed: number
  solution_viewed: boolean
  feedback_json: AttemptFeedback
  error_taxonomy_json: ErrorTaxonomy[]
  reflection_text: string | null
  created_at: string
}

export interface AttemptFeedback {
  message?: string
  correct?: boolean
  explanation?: string
}

export interface ErrorTaxonomy {
  category: string
  subcategory?: string
  description?: string
}

export interface SpacedRepetition {
  id: string
  workspace_id: string
  student_user_id: string
  question_id: string
  ease: number
  interval_days: number
  streak: number
  last_seen: string | null
  next_due: string
  last_outcome: 'correct' | 'incorrect' | 'skipped' | null
  total_reviews: number
  total_correct: number
  created_at: string
  updated_at: string
}

export interface QuestionFlag {
  id: string
  workspace_id: string
  student_user_id: string
  question_id: string
  flag_type: 'incorrect_answer' | 'unclear' | 'typo' | 'too_hard' | 'other'
  comment: string | null
  status: 'pending' | 'reviewed' | 'fixed' | 'dismissed'
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
}

export interface TutorFeedback {
  id: string
  workspace_id: string
  tutor_user_id: string
  student_user_id: string
  attempt_id: string | null
  comment: string
  error_tags: string[]
  is_private: boolean
  created_at: string
}

export interface Session {
  id: string
  workspace_id: string
  tutor_user_id: string
  student_user_id: string | null
  student_profile_id: string | null
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  google_event_id: string | null
  meet_link: string | null
  calendar_html_link: string | null
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  change_request_text: string | null
  change_request_at: string | null
  created_at: string
  updated_at: string
}

export interface OAuthConnection {
  id: string
  workspace_id: string | null
  user_id: string
  provider: 'google'
  encrypted_access_token: string | null
  encrypted_refresh_token: string
  token_expires_at: string | null
  scopes: string[]
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  workspace_id: string | null
  actor_user_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata_json: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface Job {
  id: string
  workspace_id: string | null
  created_by_user_id: string | null
  type: JobType
  status: JobStatus
  priority: number
  payload_json: Record<string, unknown>
  result_json: Record<string, unknown> | null
  error_text: string | null
  attempts: number
  max_attempts: number
  run_after: string
  locked_at: string | null
  locked_by: string | null
  openai_batch_id: string | null
  created_at: string
  updated_at: string
}

export interface PdfExport {
  id: string
  workspace_id: string
  created_by: string
  title: string
  r2_key: string
  assignment_id: string | null
  question_ids: string[]
  include_hints: boolean
  include_solutions: boolean
  page_count: number | null
  size_bytes: number | null
  expires_at: string | null
  download_count: number
  created_at: string
}

// Extended types with relations
export interface QuestionWithTopic extends Question {
  topic?: Topic
}

export interface AssignmentWithItems extends Assignment {
  items?: (AssignmentItem & { question?: Question })[]
}

export interface AttemptWithQuestion extends Attempt {
  question?: Question
}

export interface StudentProfileWithUser extends StudentProfile {
  user?: { email: string }
}

// User context type
export interface UserContext {
  userId: string
  email: string
  workspaceId: string
  role: UserRole
  isPlatformOwner: boolean
}

// Date formatting utilities
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB') // DD/MM/YYYY
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GB') // DD/MM/YYYY, HH:MM:SS
}
