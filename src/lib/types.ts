// Database types for TutorAssist
// These types correspond to the Supabase schema

export type UserRole = 'platform_owner' | 'tutor' | 'student'

export type QuestionOrigin = 'manual' | 'ai_generated' | 'imported' | 'variant'
export type QuestionStatus = 'active' | 'needs_review' | 'archived' | 'draft'
export type AnswerType = 
  | 'short_answer'    // Short text answer (general math/text)
  | 'long_answer'     // Essay/paragraph answer
  | 'numeric'         // Pure number with tolerance checking
  | 'expression'      // Algebraic expression with symbolic equivalence
  | 'multiple_choice' // Multiple choice with options
  | 'true_false'      // True/False question
  | 'fill_blank'      // Fill in the blank
  | 'matching'        // Matching pairs

export type JobType = 
  | 'EXTRACT_MATERIAL'
  | 'GENERATE_QUESTIONS'
  | 'GENERATE_QUESTIONS_BATCH'
  | 'BATCH_GENERATE'
  | 'GENERATE_PDF'
  | 'REGEN_VARIANT'
  | 'DAILY_SPACED_REP_REFRESH'
  | 'PROCESS_BATCH_RESULT'
  | 'GENERATE_EMBEDDINGS'
  | 'RECONCILE_STATS'
  | 'REFRESH_MATERIALIZED_VIEWS'

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
  // Program/Grade associations
  study_program_id: string | null
  grade_level_id: string | null
  // Cohort tracking (Migration 013)
  academic_year: number | null
  cohort_id: string | null
  cohort_name: string | null
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
  code: string // 'M8', 'M9', 'AISL', 'AIHL', 'AASL', 'AAHL', 'AP1', etc.
  name: string // 'MYP Year 8', 'AI Standard Level', 'AA Higher Level'
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
  // AI Generation tracking (Migration 013)
  generation_metadata: QuestionGenerationMetadata
  batch_id: string | null
  // Timestamps
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
  choices?: Array<string | { text: string; latex?: string }>
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
  // Analytics context (Migration 013)
  context_json: AttemptContext
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
  tutor_id: string
  student_id: string | null
  student_profile_id: string | null
  scheduled_at: string
  duration_minutes: number
  notes: string | null
  location: string | null
  google_event_id: string | null
  meet_link: string | null
  calendar_html_link: string | null
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  // Session tracking (Migration 013)
  actual_start: string | null
  actual_end: string | null
  topics_covered: string[] | null
  questions_reviewed: string[] | null
  session_notes: string | null
  session_metadata: SessionMetadata
  created_at: string
  updated_at: string
}

export interface OAuthConnection {
  id: string
  workspace_id: string | null
  user_id: string
  provider: 'google'
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  provider_user_id: string | null
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

// ============================================
// AI GENERATION METADATA TYPES
// ============================================

export interface QuestionGenerationMetadata {
  // Model information
  model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | string
  model_version?: string
  prompt_version?: string
  temperature?: number
  
  // Generation context
  generated_at?: string  // ISO timestamp
  batch_id?: string      // OpenAI batch ID
  job_id?: string        // Internal job ID
  
  // Cost & performance
  tokens_used?: {
    input: number
    output: number
    total: number
  }
  generation_time_ms?: number
  cost_usd?: number
  
  // Quality control
  validation_passed?: boolean
  auto_fixes_applied?: string[]
  quality_checks?: {
    latex_valid: boolean
    answer_parseable: boolean
    difficulty_appropriate: boolean
  }
  
  // Source context
  source_context?: {
    material_id?: string
    material_page?: number
    similar_questions?: string[]
    topic_context?: string
  }
  
  // Pedagogical metadata
  pedagogical?: {
    blooms_level?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
    skill_type?: 'procedural' | 'conceptual' | 'factual'
    prerequisites?: string[]
    cognitive_load?: 'low' | 'medium' | 'high'
  }
  
  // Legacy migration marker
  legacy_migration?: boolean
}

export interface AttemptContext {
  // Device & environment
  device_type?: 'mobile' | 'tablet' | 'desktop'
  browser?: string
  screen_size?: { width: number; height: number }
  
  // Input method
  input_method?: 'keyboard' | 'mathlive_palette' | 'voice' | 'paste'
  answer_changes_count?: number
  
  // Help usage
  hints_viewed_at?: string[]  // ISO timestamps
  solution_viewed_at?: string
  
  // Question state
  question_difficulty_at_attempt?: number
  question_version?: string
  
  // Session context
  session_id?: string
  previous_attempts_count?: number
  time_since_last_attempt_hours?: number
  
  // Peer context (populated post-attempt for analytics)
  class_average_time?: number
  class_accuracy_rate?: number
  student_percentile?: number
}

export interface SessionMetadata {
  // Actual timing
  actual_duration_minutes?: number
  started_late_minutes?: number
  
  // Content covered
  topics_covered?: Array<{
    topic_id: string
    time_spent_minutes: number
    mastery_level: 'introduced' | 'practicing' | 'mastered'
  }>
  
  // Questions reviewed
  questions_reviewed?: Array<{
    question_id: string
    student_struggled: boolean
    time_spent_minutes: number
  }>
  
  // Student state
  student_preparation?: 'unprepared' | 'somewhat_prepared' | 'well_prepared'
  student_engagement?: 'low' | 'medium' | 'high'
  student_understanding?: 'struggling' | 'progressing' | 'excelling'
  
  // Session outcomes
  homework_assigned?: string[]
  goals_for_next_session?: string[]
  tutor_notes?: string
  
  // Technical issues
  connection_issues?: boolean
  issues_description?: string
}

// ============================================
// AI USAGE & BATCH TRACKING TYPES
// ============================================

export interface AIUsageLog {
  id: string
  workspace_id: string | null
  user_id: string | null
  operation_type: string
  model: string
  tokens_input: number | null
  tokens_output: number | null
  tokens_total: number | null
  cost_usd: number | null
  duration_ms: number | null
  success: boolean
  error_message: string | null
  job_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface QuestionBatch {
  id: string
  workspace_id: string
  created_by: string | null
  openai_batch_id: string | null
  job_id: string | null
  total_requested: number
  topics_requested: string[] | null
  difficulty_distribution: Record<string, number> | null
  generation_options: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
  total_generated: number
  total_failed: number
  questions_generated: string[] | null
  total_tokens: number | null
  total_cost_usd: number | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
}

// ============================================
// STUDENT ANALYTICS TYPES
// ============================================

export interface StudentPerformance {
  student_user_id: string
  workspace_id: string
  total_attempts: number
  correct_attempts: number
  accuracy_pct: number | null
  avg_time_seconds: number | null
  unique_questions: number
  days_active: number
  last_attempt_at: string | null
  first_attempt_at: string | null
}

export interface TopicPerformance {
  workspace_id: string
  topic_id: string | null
  topic_name: string | null
  total_attempts: number
  correct_attempts: number
  accuracy_pct: number | null
  students_attempted: number
  questions_in_topic: number
  avg_time_seconds: number | null
}

// ============================================
// HELPER FUNCTION FOR AI COST ESTIMATION
// ============================================

export function estimateAICost(
  model: string,
  tokensInput: number,
  tokensOutput: number
): number {
  // Costs per 1M tokens (as of Dec 2024)
  const rates: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'text-embedding-3-small': { input: 0.02, output: 0 },
    'text-embedding-3-large': { input: 0.13, output: 0 },
  }
  
  const rate = rates[model] || rates['gpt-4o-mini']
  return (tokensInput * rate.input / 1_000_000) + (tokensOutput * rate.output / 1_000_000)
}
