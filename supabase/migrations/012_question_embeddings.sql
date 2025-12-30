-- ============================================
-- QUESTION EMBEDDINGS & SIMILARITY MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Enable pgvector extension (Supabase has this available)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create question_embeddings table
CREATE TABLE IF NOT EXISTS question_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Embedding vector (1536 dimensions for text-embedding-3-small)
    embedding vector(1536),
    
    -- Metadata
    embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    text_hash TEXT NOT NULL, -- Hash of input text to detect changes
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(question_id)
);

-- Step 3: Create indexes for efficient similarity search
CREATE INDEX IF NOT EXISTS idx_question_embeddings_workspace ON question_embeddings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_question_embeddings_question ON question_embeddings(question_id);

-- IVFFlat index for fast approximate nearest neighbor search
-- Using cosine distance (most common for text embeddings)
CREATE INDEX IF NOT EXISTS idx_question_embeddings_vector ON question_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Step 4: Add group_id to questions for manual grouping
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES questions(id) ON DELETE SET NULL;

-- Step 5: Create index for group lookups
CREATE INDEX IF NOT EXISTS idx_questions_group ON questions(group_id);

-- Step 6: Create helper function to find similar questions
CREATE OR REPLACE FUNCTION find_similar_questions(
    target_question_id UUID,
    target_workspace_id UUID,
    match_threshold FLOAT DEFAULT 0.8,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    question_id UUID,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    target_embedding vector(1536);
BEGIN
    -- Get the embedding for the target question
    SELECT embedding INTO target_embedding
    FROM question_embeddings
    WHERE question_id = target_question_id;
    
    IF target_embedding IS NULL THEN
        RETURN;
    END IF;
    
    -- Find similar questions using cosine similarity
    RETURN QUERY
    SELECT 
        qe.question_id,
        1 - (qe.embedding <=> target_embedding) AS similarity
    FROM question_embeddings qe
    WHERE qe.workspace_id = target_workspace_id
      AND qe.question_id != target_question_id
      AND 1 - (qe.embedding <=> target_embedding) >= match_threshold
    ORDER BY qe.embedding <=> target_embedding
    LIMIT match_count;
END;
$$;

-- Step 7: Add comment for documentation
COMMENT ON TABLE question_embeddings IS 
'Stores vector embeddings for questions to enable similarity search. Uses OpenAI text-embedding-3-small model.';

COMMENT ON FUNCTION find_similar_questions IS
'Finds questions similar to a target question using cosine similarity on embeddings. Returns question_id and similarity score (0-1).';

-- Done! You should see "Success. No rows returned"
