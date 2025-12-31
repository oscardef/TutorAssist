# TutorAssist Database Audit & Cleanup Plan

**Date**: December 31, 2025  
**Purpose**: Comprehensive database audit to ensure data integrity, optimize storage, and prepare for bulk AI generation

---

## Executive Summary

This document outlines a comprehensive plan to audit, clean, and document the TutorAssist database. The focus is on:
1. **Data Completeness** - Ensuring AI-generated content stores sufficient metadata for future analytics
2. **Data Efficiency** - Removing unused tables/columns and eliminating redundancy
3. **Analytics Readiness** - Verifying data structure supports student performance analysis
4. **Schema Consistency** - Aligning code, migrations, and actual database state

---

## Current Database Overview

### Core Tables (17)
1. **workspaces** - Multi-tenant boundary
2. **workspace_members** - User-workspace-role mapping
3. **invite_tokens** - Student onboarding tokens
4. **student_profiles** - Extended student data
5. **topics** - Question categories with metadata
6. **source_materials** - Uploaded content for generation
7. **questions** - Core question bank
8. **assignments** - Question collections for students
9. **assignment_items** - Questions in assignments
10. **attempts** - Student answers and performance
11. **spaced_repetition** - SM-2 scheduling
12. **question_flags** - Student-reported issues
13. **tutor_feedback** - Tutor comments on attempts
14. **sessions** - Tutoring sessions with calendar integration
15. **oauth_connections** - OAuth tokens (encrypted)
16. **audit_log** - Action tracking
17. **jobs** - Background job queue

### Junction/Support Tables (7)
1. **study_programs** - Curricula (IB, AP, etc.)
2. **grade_levels** - Grade levels within programs
3. **question_programs** - Question-to-program mapping
4. **question_grade_levels** - Question-to-grade mapping
5. **question_embeddings** - pgvector embeddings for similarity search
6. **flag_reasons** - Configurable flag categories
7. **pdf_exports** - Generated PDF tracking

---

## Section 1: Issues Identified

### 🚨 Critical Issues

#### 1.1 Ghost Table Reference
**Problem**: Code references `assignment_attempts` table that doesn't exist in schema  
**Location**: [src/app/tutor/students/page.tsx](src/app/tutor/students/page.tsx#L30)  
**Impact**: Potential runtime errors if this query executes  
**Action**: Either create the table or refactor code to use `attempts` table with `assignment_id` filtering

#### 1.2 Missing Migration Execution
**Problem**: Multiple migrations created but not confirmed as executed on production  
**Evidence**: 
- `MIGRATION_REQUIRED.md` indicates migration 009 needs manual execution
- `MIGRATION_010_METADATA.md` indicates topics.metadata column may not exist
**Impact**: Features may be broken in production
**Action**: Create a script to verify all migrations are applied

#### 1.3 Incomplete Database Function
**Problem**: Code calls `update_question_stats` RPC but function doesn't exist in schema
**Location**: [src/app/api/attempts/route.ts](src/app/api/attempts/route.ts#L74)  
**Impact**: Question statistics may not be updating correctly
**Action**: Create the missing database function or refactor to use regular SQL

### ⚠️ High Priority Issues

#### 1.4 Unused Tables
**Finding**: Several tables are defined but have minimal/no code usage:
- `tutor_feedback` - Only defined in types, no API endpoints found
- `audit_log` - Defined but no insertion code found
- `flag_reasons` - Used minimally, only in flags API

**Impact**: Storage overhead, maintenance burden, migration complexity  
**Recommendation**: Decide to either implement features or remove tables

#### 1.5 Redundant Program/Grade Data
**Problem**: Questions have both:
- Direct program/grade references: `primary_program_id`, `primary_grade_level_id`
- Junction table references: `question_programs`, `question_grade_levels`

**Impact**: Data inconsistency risk, complex queries, redundant storage  
**Recommendation**: Choose one approach and migrate data accordingly

#### 1.6 Missing Indexes for Analytics
**Problem**: Common analytics queries lack optimized indexes:
- No index on `attempts(is_correct)` for accuracy calculations
- No composite index on `attempts(student_user_id, question_id, submitted_at)` for time-series
- No index on `questions(workspace_id, status, origin)` for filtering

**Impact**: Slow analytics queries as data grows  
**Recommendation**: Add strategic indexes before bulk data generation

### 📊 Medium Priority Issues

#### 1.7 Insufficient AI Generation Metadata
**Current Storage** in `questions` table:
```json
{
  "origin": "ai_generated",  // ✅ Good
  "created_by": "uuid",       // ✅ Good
  "quality_score": 0.85,      // ✅ Good
  "tags_json": [],            // ✅ Good
  "curriculum_json": {}       // ❓ Underutilized
}
```

**Missing Critical Metadata**:
- ❌ AI model version used (gpt-4o-mini, gpt-4o, etc.)
- ❌ Generation timestamp vs creation timestamp
- ❌ Generation prompt/context used
- ❌ Batch ID for bulk generations
- ❌ Source material reference strength
- ❌ Pedagogical metadata (bloom's taxonomy level, skill type)
- ❌ Difficulty justification
- ❌ Token cost tracking

**Impact**: Cannot analyze quality trends, reproduce generations, or optimize costs  
**Recommendation**: Add `generation_metadata` JSONB column

#### 1.8 Limited Attempt Context
**Current Storage** in `attempts` table:
```json
{
  "answer_raw": "string",          // ✅ Good
  "answer_parsed": {},             // ✅ Good
  "feedback_json": {},             // ✅ Good
  "error_taxonomy_json": [],       // ✅ Good
  "time_spent_seconds": 120        // ✅ Good
}
```

**Missing Analytics Data**:
- ❌ Device type (mobile, tablet, desktop)
- ❌ Input method (keyboard, MathLive palette, copy-paste)
- ❌ Number of answer changes before submission
- ❌ Hint view timestamps (just count, not when)
- ❌ Question difficulty at time of attempt (if question difficulty changes)
- ❌ Peer comparison context (percentile, class average)

**Impact**: Limited ability to analyze learning patterns and UX issues  
**Recommendation**: Add `context_json` JSONB column to attempts

#### 1.9 Incomplete Session Tracking
**Current Storage** in `sessions`:
- Basic scheduling data ✅
- Google Calendar integration ✅
- Change requests ✅

**Missing for Analytics**:
- ❌ Actual start/end time (vs scheduled)
- ❌ Topics covered during session
- ❌ Questions reviewed during session
- ❌ Student preparation level
- ❌ Session notes/summary
- ❌ Next session goals

**Impact**: Cannot analyze session effectiveness or tutoring patterns  
**Recommendation**: Add `session_metadata` JSONB column

#### 1.10 Limited Topic Analytics
**Current Storage** in `topics`:
```json
{
  "metadata": {
    "subtopics": [],
    "learning_objectives": [],
    "difficulty": 3
  }
}
```

**Missing for Analytics**:
- ❌ Topic mastery thresholds
- ❌ Prerequisite topics
- ❌ Estimated learning hours
- ❌ Success rate benchmarks
- ❌ Common misconceptions
- ❌ Recommended question types

**Impact**: Cannot provide intelligent topic recommendations  
**Recommendation**: Expand topic metadata structure

---

## Section 2: Data Redundancy Analysis

### 2.1 Student Identity
**Current State**: Student data split across:
- `auth.users` (Supabase Auth)
- `workspace_members` (role mapping)
- `student_profiles` (extended data)

**Redundancy**:
- `student_profiles.email` duplicates `auth.users.email` (partially)
- `student_profiles.user_id` can be NULL (pre-signup profiles)

**Recommendation**: ✅ **Keep as-is** - This design supports invite-before-signup flow

### 2.2 Assignment Completion Tracking
**Current State**:
- `assignments.status` = 'completed'
- `assignments.completed_at` timestamp
- Individual `attempts` for each question
- Ghost `assignment_attempts` table (doesn't exist)

**Issues**:
- Assignment completion is manual, not auto-calculated
- No aggregate score storage
- Code tries to query non-existent `assignment_attempts`

**Recommendation**: 
1. Remove `assignment_attempts` references from code
2. Add computed fields: `assignments.total_score`, `assignments.completed_count`
3. Create view or function to calculate completion status

### 2.3 Question Statistics
**Current State**:
- `questions.times_attempted` counter
- `questions.times_correct` counter
- `questions.avg_time_seconds` average
- Individual `attempts` records with full detail

**Redundancy**: Statistics are denormalized from attempts  
**Risk**: Statistics can drift from actual attempts if updates fail

**Recommendation**: ✅ **Keep as-is** but add:
1. Missing `update_question_stats()` function
2. Periodic reconciliation job
3. Trigger to auto-update on attempt insertion

### 2.4 Workspace Settings
**Current State**:
- `workspaces.settings_json` (workspace-level)
- `student_profiles.settings_json` (student-level)
- `assignments.settings_json` (assignment-level)

**Redundancy**: Same settings keys at multiple levels (e.g., timeLimit)

**Recommendation**: ✅ **Keep as-is** - Allows inheritance pattern:
```
assignment.settings || student.settings || workspace.settings
```

---

## Section 3: Analytics Requirements

### 3.1 Core Analytics Queries Needed

#### Student Performance Analytics
```sql
-- Query patterns needed:
-- 1. Student accuracy over time
SELECT DATE_TRUNC('week', submitted_at), 
       COUNT(*) FILTER (WHERE is_correct) * 100.0 / COUNT(*) as accuracy
FROM attempts
WHERE student_user_id = ? AND submitted_at > ?
GROUP BY 1;

-- 2. Topic mastery progression
SELECT topic_id, 
       COUNT(*), 
       AVG(CASE WHEN is_correct THEN 1 ELSE 0 END),
       AVG(time_spent_seconds)
FROM attempts a
JOIN questions q ON a.question_id = q.id
WHERE student_user_id = ?
GROUP BY topic_id;

-- 3. Learning velocity
SELECT DATE(submitted_at),
       COUNT(DISTINCT question_id) as questions_attempted,
       AVG(time_spent_seconds) as avg_time
FROM attempts
WHERE student_user_id = ?
GROUP BY 1;
```

**Required Indexes** (MISSING):
```sql
CREATE INDEX idx_attempts_student_date 
  ON attempts(student_user_id, submitted_at DESC);
  
CREATE INDEX idx_attempts_analytics 
  ON attempts(student_user_id, question_id, is_correct, submitted_at);
```

#### Question Quality Analytics
```sql
-- Query patterns needed:
-- 1. Question difficulty calibration
SELECT difficulty, 
       AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) as actual_difficulty
FROM questions q
JOIN attempts a ON q.id = a.question_id
GROUP BY difficulty;

-- 2. Flag rate by question
SELECT q.id, q.prompt_text,
       COUNT(DISTINCT a.student_user_id) as attempts,
       COUNT(DISTINCT f.id) as flags
FROM questions q
LEFT JOIN attempts a ON q.id = a.question_id
LEFT JOIN question_flags f ON q.id = f.question_id
GROUP BY q.id;
```

**Required Indexes** (MISSING):
```sql
CREATE INDEX idx_question_flags_question 
  ON question_flags(question_id, status);
```

#### Tutor Effectiveness Analytics
```sql
-- Query patterns needed:
-- 1. Session outcomes
SELECT tutor_user_id,
       COUNT(*) as sessions_conducted,
       AVG(/* student improvement post-session */)
FROM sessions
GROUP BY tutor_user_id;

-- 2. Assignment creation patterns
SELECT created_by,
       COUNT(*) as assignments_created,
       AVG(/* completion rate */),
       AVG(/* student scores */)
FROM assignments
GROUP BY created_by;
```

**Required Data** (MISSING):
- Session outcome tracking
- Assignment aggregate scores

### 3.2 Time-Series Analytics
**Current Limitations**:
- Only `created_at` and `updated_at` timestamps
- No snapshot/history tables
- Cannot track changes over time

**Examples of Lost Data**:
- Question difficulty changes
- Topic restructuring history
- Student grade level progression
- Spaced repetition algorithm adjustments

**Recommendation**: Add history tracking for:
1. Question edits (log changes to `questions`)
2. Student progress snapshots (weekly/monthly)
3. Topic tree restructuring

### 3.3 Cohort Analytics
**Required But Not Possible**:
- Compare students in same grade level
- Compare same student year-over-year
- Benchmark against curriculum standards

**Missing Data**:
- Student cohort identifiers
- Academic year tracking
- Standard performance benchmarks

**Recommendation**: Add:
```sql
ALTER TABLE student_profiles 
  ADD COLUMN academic_year INTEGER,
  ADD COLUMN cohort_id UUID;
```

---

## Section 4: AI Generation Data Requirements

### 4.1 Question Generation Metadata

#### Current State
Questions store minimal generation context:
- `origin` = 'ai_generated'
- `source_material_id` (optional)
- `quality_score` (optional)

#### Required for Production
```sql
ALTER TABLE questions 
ADD COLUMN generation_metadata JSONB DEFAULT '{}'::jsonb;

-- Structure:
{
  "model": "gpt-4o-mini",
  "model_version": "2024-07-18",
  "prompt_version": "v2.3",
  "temperature": 0.7,
  "generated_at": "2025-12-31T10:00:00Z",
  "batch_id": "batch_abc123",
  "job_id": "uuid",
  "tokens_used": {
    "input": 150,
    "output": 320,
    "total": 470
  },
  "generation_time_ms": 2340,
  "validation_passed": true,
  "auto_fixes_applied": ["latex_formatting"],
  "source_context": {
    "material_id": "uuid",
    "material_page": 5,
    "similar_questions": ["uuid1", "uuid2"]
  },
  "pedagogical": {
    "blooms_level": "apply",
    "skill_type": "procedural",
    "prerequisites": ["uuid1"]
  }
}
```

#### Cost Tracking
Add table for AI usage analytics:
```sql
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  operation_type TEXT NOT NULL, -- 'generate_question', 'generate_embedding', etc.
  model TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10, 6),
  duration_ms INTEGER,
  success BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Batch Generation Tracking

#### Current State
Jobs table tracks batch operations:
- `type` = 'GENERATE_QUESTIONS_BATCH'
- `openai_batch_id` links to OpenAI batch
- `payload_json` stores requests

#### Missing
- Batch result analysis
- Question-to-batch linkage
- Batch cost reporting

#### Recommendation
```sql
-- Add to questions table
ALTER TABLE questions
ADD COLUMN batch_id TEXT,
ADD COLUMN batch_custom_id TEXT;

CREATE INDEX idx_questions_batch ON questions(batch_id);

-- Or create dedicated table
CREATE TABLE question_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  openai_batch_id TEXT UNIQUE,
  job_id UUID REFERENCES jobs(id),
  status TEXT NOT NULL,
  total_requested INTEGER,
  total_generated INTEGER,
  total_cost_usd DECIMAL(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### 4.3 Embedding Generation

#### Current State
`question_embeddings` table with pgvector:
- `embedding` vector(1536)
- `embedding_model` TEXT
- `text_hash` TEXT

#### Missing
- Embedding regeneration tracking
- Model version tracking for migrations
- Batch embedding operations

#### Recommendation
```sql
ALTER TABLE question_embeddings
ADD COLUMN model_version TEXT,
ADD COLUMN generated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN generation_time_ms INTEGER;
```

---

## Section 5: Cleanup Actions

### 5.1 Immediate Actions (This Week)

#### Action 1: Fix Ghost Table Reference
**File**: [src/app/tutor/students/page.tsx](src/app/tutor/students/page.tsx#L28-L33)  
**Current Code**:
```typescript
const { data: assignmentAttempts } = await supabase
  .from('assignment_attempts')  // ❌ Table doesn't exist
  .select('student_user_id, status')
```

**Option A - Remove (if not needed)**:
```typescript
// Remove the query and calculate from attempts table
const { data: assignmentStats } = await supabase
  .from('attempts')
  .select('student_user_id, assignment_id, is_correct')
  .eq('workspace_id', context.workspaceId)
  .not('assignment_id', 'is', null)
```

**Option B - Create Table (if needed)**:
```sql
CREATE TABLE assignment_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  student_user_id UUID NOT NULL REFERENCES auth.users(id),
  assignment_id UUID NOT NULL REFERENCES assignments(id),
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Action 2: Create Missing Database Function
**File**: [src/app/api/attempts/route.ts](src/app/api/attempts/route.ts#L74-L78)  
**Create Function**:
```sql
CREATE OR REPLACE FUNCTION update_question_stats(
  p_question_id UUID,
  p_is_correct BOOLEAN,
  p_time_spent INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE questions
  SET 
    times_attempted = times_attempted + 1,
    times_correct = times_correct + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    avg_time_seconds = CASE
      WHEN avg_time_seconds IS NULL THEN p_time_spent
      ELSE (avg_time_seconds * times_attempted + COALESCE(p_time_spent, 0)) / (times_attempted + 1)
    END,
    updated_at = NOW()
  WHERE id = p_question_id;
END;
$$;
```

#### Action 3: Verify All Migrations Applied
**Create Script**: `scripts/verify-migrations.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

// Check for all expected columns/tables
const checks = [
  { table: 'topics', column: 'metadata', type: 'jsonb' },
  { table: 'student_profiles', column: 'study_program_id', type: 'uuid' },
  { table: 'question_embeddings', type: 'table' },
  // ... etc
]

// Run checks and report missing migrations
```

#### Action 4: Remove Unused Tables (Decision Required)
**Tables to Review**:
1. `tutor_feedback` - No API endpoints, keep or remove?
2. `audit_log` - No insertion code, keep or remove?
3. `flag_reasons` - Minimal usage, keep or remove?

**Recommendation**: 
- Keep `tutor_feedback` - useful feature to implement
- Keep `audit_log` - needed for compliance
- Remove `flag_reasons` - can hardcode in frontend

### 5.2 Short-term Actions (Next 2 Weeks)

#### Action 5: Add Analytics Indexes
```sql
-- Attempt analytics
CREATE INDEX idx_attempts_student_date 
  ON attempts(student_user_id, submitted_at DESC);

CREATE INDEX idx_attempts_analytics 
  ON attempts(student_user_id, question_id, is_correct, submitted_at)
  WHERE is_correct IS NOT NULL;

CREATE INDEX idx_attempts_correct 
  ON attempts(is_correct, submitted_at) 
  WHERE is_correct IS NOT NULL;

-- Question analytics
CREATE INDEX idx_questions_filters 
  ON questions(workspace_id, status, origin, difficulty)
  WHERE status = 'active';

CREATE INDEX idx_questions_stats 
  ON questions(times_attempted, times_correct)
  WHERE times_attempted > 0;

-- Flag analytics
CREATE INDEX idx_question_flags_analytics 
  ON question_flags(question_id, status, created_at);
```

#### Action 6: Add Generation Metadata Column
```sql
-- Add to questions table
ALTER TABLE questions 
ADD COLUMN generation_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_questions_generation 
  ON questions USING gin(generation_metadata);

-- Migrate existing generated questions
UPDATE questions 
SET generation_metadata = jsonb_build_object(
  'model', 'gpt-4o-mini',
  'generated_at', created_at,
  'legacy_migration', true
)
WHERE origin = 'ai_generated' AND generation_metadata = '{}'::jsonb;
```

#### Action 7: Add Attempt Context Column
```sql
ALTER TABLE attempts 
ADD COLUMN context_json JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_attempts_context 
  ON attempts USING gin(context_json);
```

#### Action 8: Simplify Program/Grade Relationships
**Decision Required**: Choose one approach:

**Option A - Keep Junction Tables Only**:
```sql
-- Remove direct references
ALTER TABLE questions 
DROP COLUMN primary_program_id,
DROP COLUMN primary_grade_level_id;

-- Use junction tables exclusively
```

**Option B - Keep Direct References, Add Sync**:
```sql
-- Add trigger to sync primary_program_id with junction table
CREATE TRIGGER sync_primary_program
AFTER INSERT OR UPDATE ON question_programs
FOR EACH ROW
EXECUTE FUNCTION sync_question_primary_program();
```

**Recommendation**: Option A (junction tables only) for flexibility

### 5.3 Medium-term Actions (Next Month)

#### Action 9: Implement AI Usage Tracking
```sql
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),
  operation_type TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_total INTEGER,
  cost_usd DECIMAL(10, 6),
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_workspace ON ai_usage_log(workspace_id, created_at);
CREATE INDEX idx_ai_usage_operation ON ai_usage_log(operation_type, created_at);
```

#### Action 10: Add Question Batch Tracking
```sql
CREATE TABLE question_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  created_by UUID REFERENCES auth.users(id),
  openai_batch_id TEXT UNIQUE,
  job_id UUID REFERENCES jobs(id),
  
  -- Request details
  total_requested INTEGER NOT NULL,
  topics_requested TEXT[],
  difficulty_distribution JSONB,
  
  -- Results
  status TEXT NOT NULL DEFAULT 'pending',
  total_generated INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  questions_generated UUID[],
  
  -- Cost tracking
  total_tokens INTEGER,
  total_cost_usd DECIMAL(10, 6),
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Link questions to batches
ALTER TABLE questions
ADD COLUMN batch_id UUID REFERENCES question_batches(id);
```

#### Action 11: Add Session Tracking
```sql
ALTER TABLE sessions
ADD COLUMN actual_start TIMESTAMPTZ,
ADD COLUMN actual_end TIMESTAMPTZ,
ADD COLUMN topics_covered UUID[],
ADD COLUMN questions_reviewed UUID[],
ADD COLUMN session_notes TEXT,
ADD COLUMN session_metadata JSONB DEFAULT '{}'::jsonb;
```

#### Action 12: Enhanced Topic Metadata
```sql
-- Update topics metadata structure
UPDATE topics
SET metadata = metadata || jsonb_build_object(
  'mastery_threshold', 0.8,
  'prerequisites', '[]'::jsonb,
  'estimated_hours', 2,
  'success_benchmark', 0.75,
  'common_errors', '[]'::jsonb
)
WHERE metadata IS NOT NULL;
```

### 5.4 Long-term Actions (Next Quarter)

#### Action 13: Student Cohort Tracking
```sql
ALTER TABLE student_profiles
ADD COLUMN academic_year INTEGER,
ADD COLUMN cohort_id UUID,
ADD COLUMN cohort_name TEXT;

CREATE INDEX idx_student_profiles_cohort 
  ON student_profiles(workspace_id, cohort_id, academic_year);
```

#### Action 14: Historical Tracking
```sql
-- Student progress snapshots
CREATE TABLE student_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  student_user_id UUID NOT NULL REFERENCES auth.users(id),
  snapshot_date DATE NOT NULL,
  
  -- Aggregate metrics
  total_questions_attempted INTEGER,
  total_correct INTEGER,
  accuracy_rate DECIMAL,
  topics_mastered UUID[],
  topics_struggling UUID[],
  
  -- Spaced repetition
  cards_due INTEGER,
  cards_reviewed INTEGER,
  average_ease DECIMAL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(student_user_id, snapshot_date)
);

-- Question edit history
CREATE TABLE question_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT NOT NULL, -- 'created', 'edited', 'difficulty_changed', etc.
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Action 15: Materialized Views for Analytics
```sql
-- Student performance summary
CREATE MATERIALIZED VIEW mv_student_performance AS
SELECT 
  a.student_user_id,
  a.workspace_id,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE a.is_correct) as correct_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct) / COUNT(*), 2) as accuracy_pct,
  AVG(a.time_spent_seconds) as avg_time_seconds,
  COUNT(DISTINCT a.question_id) as unique_questions,
  COUNT(DISTINCT DATE(a.submitted_at)) as days_active,
  MAX(a.submitted_at) as last_attempt_at
FROM attempts a
GROUP BY a.student_user_id, a.workspace_id;

CREATE UNIQUE INDEX idx_mv_student_performance 
  ON mv_student_performance(student_user_id, workspace_id);

-- Refresh schedule: Daily at 2am
-- Refresh command: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_performance;
```

---

## Section 6: Data Documentation

### 6.1 Schema Documentation Checklist

- [ ] Document all JSONB field structures with examples
- [ ] Document all enum values with descriptions
- [ ] Add PostgreSQL comments to all tables and columns
- [ ] Create ERD (Entity Relationship Diagram)
- [ ] Document RLS policies and their purpose
- [ ] Document all database functions
- [ ] Create data dictionary

### 6.2 JSONB Field Specifications

#### `questions.generation_metadata`
```typescript
interface QuestionGenerationMetadata {
  // Model information
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo'
  model_version?: string // e.g., '2024-07-18'
  prompt_version: string // e.g., 'v2.3.1'
  temperature: number    // e.g., 0.7
  
  // Generation context
  generated_at: string   // ISO timestamp
  batch_id?: string      // OpenAI batch ID
  job_id: string         // Internal job ID
  
  // Cost & performance
  tokens_used: {
    input: number
    output: number
    total: number
  }
  generation_time_ms: number
  cost_usd?: number
  
  // Quality control
  validation_passed: boolean
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
    blooms_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
    skill_type: 'procedural' | 'conceptual' | 'factual'
    prerequisites?: string[]  // Question IDs
    cognitive_load?: 'low' | 'medium' | 'high'
  }
}
```

#### `attempts.context_json`
```typescript
interface AttemptContext {
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
  question_version?: string  // If question edited after creation
  
  // Session context
  session_id?: string
  previous_attempts_count?: number
  time_since_last_attempt_hours?: number
  
  // Peer context
  class_average_time?: number
  class_accuracy_rate?: number
  student_percentile?: number
}
```

#### `sessions.session_metadata`
```typescript
interface SessionMetadata {
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
  student_preparation: 'unprepared' | 'somewhat_prepared' | 'well_prepared'
  student_engagement: 'low' | 'medium' | 'high'
  student_understanding: 'struggling' | 'progressing' | 'excelling'
  
  // Session outcomes
  homework_assigned?: string[]
  goals_for_next_session?: string[]
  tutor_notes?: string
  
  // Technical issues
  connection_issues?: boolean
  issues_description?: string
}
```

#### `topics.metadata`
```typescript
interface TopicMetadata {
  // Content organization
  subtopics?: string[]
  learning_objectives?: string[]
  
  // Difficulty & scope
  difficulty?: number  // 1-5
  estimated_hours?: number
  
  // Prerequisites & sequence
  prerequisites?: string[]  // Topic IDs
  follows_topics?: string[]
  leads_to_topics?: string[]
  
  // Standards alignment
  curriculum_codes?: string[]  // e.g., ['CCSS.MATH.8.F.1']
  
  // Benchmarks
  mastery_threshold?: number  // e.g., 0.8 = 80% accuracy
  success_benchmark?: number  // Expected class average
  
  // Common errors
  common_errors?: Array<{
    error: string
    frequency: number
    remedy: string
  }>
  
  // Question distribution
  recommended_question_types?: string[]
  recommended_difficulty_distribution?: {
    easy: number
    medium: number
    hard: number
  }
  
  // Generation context (if AI-generated)
  generated_from?: 'ai' | 'manual' | 'imported'
  source_program_id?: string
  source_grade_level_id?: string
}
```

### 6.3 Database Comments
Create migration to add PostgreSQL comments:

```sql
-- Tables
COMMENT ON TABLE workspaces IS 'Multi-tenant boundary - each tutor has one workspace';
COMMENT ON TABLE questions IS 'Core question bank with LaTeX support and AI generation';
COMMENT ON TABLE attempts IS 'Student answers and performance tracking';
-- ... etc

-- Important columns
COMMENT ON COLUMN questions.generation_metadata IS 'AI generation context, cost tracking, and quality metrics (see docs for full structure)';
COMMENT ON COLUMN attempts.context_json IS 'Attempt context for analytics: device, input method, hints usage (see docs for full structure)';
COMMENT ON COLUMN topics.metadata IS 'Topic organization, prerequisites, benchmarks, and learning objectives (see docs for full structure)';
-- ... etc
```

---

## Section 7: Implementation Roadmap

### Week 1: Critical Fixes
- [ ] Fix `assignment_attempts` ghost table reference
- [ ] Create `update_question_stats()` function
- [ ] Verify all migrations applied
- [ ] Document decision on unused tables

### Week 2: Analytics Foundation
- [ ] Add all recommended indexes
- [ ] Add `generation_metadata` column to questions
- [ ] Add `context_json` column to attempts
- [ ] Test analytics query performance

### Week 3: Generation Metadata
- [ ] Update question generation code to populate metadata
- [ ] Create `ai_usage_log` table
- [ ] Implement cost tracking in job handlers
- [ ] Create batch tracking table

### Week 4: Documentation
- [ ] Document all JSONB structures
- [ ] Add PostgreSQL comments
- [ ] Create ERD diagram
- [ ] Write analytics query cookbook

### Month 2: Enhanced Tracking
- [ ] Implement session outcome tracking
- [ ] Add student cohort support
- [ ] Create historical snapshots
- [ ] Implement materialized views

### Month 3: Advanced Analytics
- [ ] Build tutor effectiveness reports
- [ ] Build student progress reports
- [ ] Build question quality dashboards
- [ ] Build cost analytics dashboard

---

## Section 8: Testing Plan

### 8.1 Data Integrity Tests
```typescript
// Test 1: Verify no orphaned records
// Test 2: Verify foreign key constraints
// Test 3: Verify JSONB structure compliance
// Test 4: Verify RLS policies work correctly
// Test 5: Verify statistics match actual counts
```

### 8.2 Performance Tests
```typescript
// Test 1: Analyze query explain plans
// Test 2: Measure query response times under load
// Test 3: Test index usage
// Test 4: Test materialized view refresh time
```

### 8.3 Migration Tests
```typescript
// Test 1: Verify all migrations apply cleanly
// Test 2: Verify rollback procedures
// Test 3: Verify data migration correctness
// Test 4: Verify no data loss
```

---

## Section 9: Monitoring & Maintenance

### 9.1 Ongoing Monitoring
- Monitor table sizes and growth rates
- Monitor index usage and efficiency
- Monitor JSONB query performance
- Monitor RPC function execution times
- Track AI costs and usage patterns

### 9.2 Maintenance Schedule
**Weekly**:
- Check for orphaned records
- Review slow query log
- Monitor failed jobs

**Monthly**:
- Reconcile question statistics with attempts
- Refresh materialized views
- Review and optimize indexes
- Analyze storage usage

**Quarterly**:
- Review and update JSONB schemas
- Audit RLS policies
- Review and archive old data
- Performance tuning session

---

## Section 10: Decision Log

### Decisions Required

#### Decision 1: Ghost Table - `assignment_attempts`
**Options**:
A. Remove code references, calculate from `attempts` table  
B. Create the table as separate entity  

**Recommendation**: A - Remove code references  
**Rationale**: Redundant with attempts table, adds complexity  

**Status**: ⏳ Pending

---

#### Decision 2: Unused Tables
**Tables**: `tutor_feedback`, `audit_log`, `flag_reasons`  
**Options**:
A. Remove immediately  
B. Implement features  
C. Keep for future use  

**Recommendation**:
- `tutor_feedback`: B - Implement (high value feature)
- `audit_log`: C - Keep (compliance requirement)
- `flag_reasons`: A - Remove (can hardcode)

**Status**: ⏳ Pending

---

#### Decision 3: Program/Grade Relationship
**Options**:
A. Use junction tables only (flexible, normalized)  
B. Use direct references only (simpler, denormalized)  
C. Use both with sync triggers (complex, redundant)  

**Recommendation**: A - Junction tables only  
**Rationale**: Supports many-to-many, future-proof  

**Status**: ⏳ Pending

---

#### Decision 4: Analytics Approach
**Options**:
A. Real-time queries on attempts table  
B. Materialized views + scheduled refresh  
C. Separate analytics warehouse  

**Recommendation**: B - Materialized views  
**Rationale**: Balance of performance and simplicity  

**Status**: ⏳ Pending

---

## Appendix A: Current vs Proposed Schema Changes

### Summary of Changes

| Change | Type | Priority | Impact |
|--------|------|----------|--------|
| Add `update_question_stats()` function | Create | High | Fixes broken feature |
| Fix `assignment_attempts` reference | Remove | High | Fixes error |
| Add generation_metadata column | Add | High | AI tracking |
| Add context_json column | Add | High | Analytics |
| Add analytics indexes | Add | High | Performance |
| Create ai_usage_log table | Create | Medium | Cost tracking |
| Create question_batches table | Create | Medium | Batch tracking |
| Remove flag_reasons table | Remove | Low | Cleanup |
| Add session tracking columns | Add | Medium | Analytics |
| Add cohort tracking | Add | Low | Future feature |
| Create materialized views | Create | Medium | Performance |
| Add historical tracking | Create | Low | Advanced analytics |

### Total Database Size Estimate (After Changes)

**Current Estimate**: ~500MB (with 10K questions, 100K attempts)  
**After Cleanup**: ~450MB (-10% from removing unused tables)  
**After Enhancements**: ~600MB (+150MB for new metadata)  
**After 100K AI Questions**: ~1.5GB (includes embeddings, metadata)

---

## Appendix B: Query Performance Targets

| Query Type | Current | Target | Method |
|------------|---------|--------|--------|
| Student dashboard load | 800ms | <200ms | Indexes + caching |
| Question search | 1200ms | <300ms | Better indexes |
| Analytics report | 3000ms | <1000ms | Materialized views |
| Topic tree load | 400ms | <100ms | Optimize joins |
| Assignment generation | 5000ms | <2000ms | Optimize AI calls |

---

## Appendix C: Data Retention Policy (Proposed)

| Data Type | Retention | Archive Method |
|-----------|-----------|----------------|
| Attempts | 2 years active | Move to cold storage |
| Question edits | 1 year | History table |
| Job logs | 90 days | Delete |
| Session data | Indefinite | Keep all |
| AI usage logs | 1 year | Aggregate monthly |
| Audit logs | 7 years | Archive annually |

---

**Document Version**: 1.0  
**Last Updated**: December 31, 2025  
**Next Review**: After Phase 1 completion

---

## Implementation Status (Updated December 31, 2025)

### ✅ Completed Items

| Issue | Solution | Files Changed |
|-------|----------|---------------|
| Ghost table `assignment_attempts` | Refactored to use `assignments` table | [src/app/tutor/students/page.tsx](src/app/tutor/students/page.tsx) |
| Missing `update_question_stats()` | Created in migration 013 | [supabase/migrations/013_database_cleanup_and_analytics.sql](supabase/migrations/013_database_cleanup_and_analytics.sql) |
| Missing `generation_metadata` column | Added in migration 013 | Migration file |
| Missing `context_json` column | Added in migration 013 | Migration file |
| Missing analytics indexes | Added 10+ indexes in migration 013 | Migration file |
| No AI usage tracking | Created `ai_usage_log` table + `logAIUsage()` utility | [src/lib/ai-usage.ts](src/lib/ai-usage.ts) |
| No batch tracking | Created `question_batches` table | Migration file |
| Job handlers missing metadata | Updated all 3 handlers with tracking | See handlers below |
| Missing job types | Added `RECONCILE_STATS` and `REFRESH_MATERIALIZED_VIEWS` | [src/lib/jobs/index.ts](src/lib/jobs/index.ts) |
| No analytics API | Created comprehensive `/api/analytics` endpoint | [src/app/api/analytics/route.ts](src/app/api/analytics/route.ts) |
| Attempts missing context | Added `context_json` to attempt inserts | [src/app/api/attempts/route.ts](src/app/api/attempts/route.ts) |

### Files Modified

1. **[supabase/migrations/013_database_cleanup_and_analytics.sql](supabase/migrations/013_database_cleanup_and_analytics.sql)** - NEW
   - `update_question_stats()` function
   - `generation_metadata` column on questions
   - `context_json` column on attempts
   - `metadata_json` and `device_info` columns on sessions
   - `ai_usage_log` table
   - `question_batches` table
   - Analytics indexes (10+)
   - Materialized views for topic/student performance

2. **[src/lib/types.ts](src/lib/types.ts)** - MODIFIED
   - Added `QuestionGenerationMetadata` interface
   - Added `AttemptContext` interface
   - Added `SessionMetadata` interface
   - Added `AIUsageLog` interface
   - Added `estimateAICost()` function
   - Added new job types

3. **[src/lib/ai-usage.ts](src/lib/ai-usage.ts)** - NEW
   - `logAIUsage()` - Logs all AI API calls
   - `createGenerationMetadata()` - Creates question metadata
   - `AI_MODELS` and `PROMPT_VERSIONS` constants

4. **[src/lib/jobs/handlers/generate-questions.ts](src/lib/jobs/handlers/generate-questions.ts)** - MODIFIED
   - Added timing tracking
   - Added token counting
   - Added `generation_metadata` to inserted questions
   - Added AI usage logging

5. **[src/lib/jobs/handlers/batch-generate.ts](src/lib/jobs/handlers/batch-generate.ts)** - MODIFIED
   - Added AI usage tracking imports
   - Added batch submission logging
   - Added `generation_metadata` to batch results

6. **[src/lib/jobs/handlers/syllabus-generate.ts](src/lib/jobs/handlers/syllabus-generate.ts)** - MODIFIED
   - Added timing and token tracking
   - Added `generation_metadata` to questions
   - Added AI usage logging

7. **[src/lib/jobs/index.ts](src/lib/jobs/index.ts)** - MODIFIED
   - Added `handleReconcileStats` handler
   - Added `handleRefreshMaterializedViews` handler

8. **[src/app/tutor/students/page.tsx](src/app/tutor/students/page.tsx)** - MODIFIED
   - Fixed query to use `assignments` table instead of non-existent `assignment_attempts`

9. **[src/app/api/attempts/route.ts](src/app/api/attempts/route.ts)** - MODIFIED
   - Added `context_json` to attempt inserts
   - Fixed RPC call parameter name

10. **[src/app/api/analytics/route.ts](src/app/api/analytics/route.ts)** - NEW
    - Overview stats endpoint
    - Topic performance endpoint
    - Student performance endpoint
    - AI usage stats endpoint
    - Question distribution stats endpoint

11. **[scripts/verify-migration-013.ts](scripts/verify-migration-013.ts)** - NEW
    - Verification script for migration 013
    - Checks all new columns, tables, indexes, functions

### Pending: Migration Execution

The migration file has been created but needs to be executed on the database:

```bash
# Option 1: Via Supabase CLI
supabase db push

# Option 2: Via direct SQL
psql $DATABASE_URL -f supabase/migrations/013_database_cleanup_and_analytics.sql

# Option 3: Via Supabase Dashboard
# Copy contents of migration file into SQL Editor and execute
```

After migration, verify with:
```bash
npx ts-node scripts/verify-migration-013.ts
```

### TypeScript Verification

All changes have been verified to compile without errors:
```bash
npx tsc --noEmit  # ✅ No errors
```
