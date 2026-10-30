-- 0001: Identity schema (Better Auth), PostgREST roles, auth.* shims.
-- Idempotent. Run on a database restored from the Supabase dump, or on a fresh
-- database after db/schema.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Identity schema managed by Better Auth
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified boolean NOT NULL DEFAULT false,
    image text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expires_at timestamptz NOT NULL,
    token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text,
    user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON identity.sessions(user_id);

CREATE TABLE IF NOT EXISTS identity.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scope text,
    password text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON identity.accounts(user_id);

CREATE TABLE IF NOT EXISTS identity.verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON identity.verifications(identifier);

-- ---------------------------------------------------------------------------
-- 2. Copy users out of Supabase's auth schema (if present). Keeps ids and
--    bcrypt password hashes, so existing logins keep working.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('auth.users') IS NOT NULL THEN
        INSERT INTO identity.users (id, name, email, email_verified, created_at, updated_at)
        SELECT u.id,
               COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), NULLIF(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
               lower(u.email),
               u.email_confirmed_at IS NOT NULL,
               COALESCE(u.created_at, now()),
               COALESCE(u.updated_at, now())
        FROM auth.users u
        WHERE u.email IS NOT NULL AND u.deleted_at IS NULL
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO identity.accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
        SELECT gen_random_uuid(), u.id::text, 'credential', u.id, u.encrypted_password, COALESCE(u.created_at, now()), now()
        FROM auth.users u
        WHERE u.encrypted_password IS NOT NULL AND u.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM identity.accounts a WHERE a.user_id = u.id AND a.provider_id = 'credential');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Re-point application foreign keys from auth.users to identity.users,
--    preserving each constraint's ON DELETE behaviour.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    IF to_regclass('auth.users') IS NULL THEN RETURN; END IF;
    FOR r IN
        SELECT c.conname, c.conrelid::regclass AS tbl,
               (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)) AS cols,
               CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END AS ondelete
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass AND n.nspname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES identity.users(id) ON DELETE %s', r.tbl, r.conname, r.cols, r.ondelete);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. auth.* shims used by the RLS policies. PostgREST publishes the verified
--    JWT claims in the `request.jwt.claims` setting.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT NULLIF(auth.jwt() ->> 'role', '')
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT NULLIF(auth.jwt() ->> 'email', '')
$$;

-- The old `public.users` view read auth.users; point it at identity.users.
DROP VIEW IF EXISTS public.users;
CREATE VIEW public.users AS
    SELECT id, email, name AS full_name, created_at, updated_at FROM identity.users;

-- ---------------------------------------------------------------------------
-- 5. PostgREST roles and grants. `authenticator` is the login role; PostgREST
--    switches to the role named in the JWT. service_role bypasses RLS.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT; END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- The identity schema is never exposed through PostgREST, but SECURITY DEFINER
-- helpers and the public.users view need to read it as their owner. Nothing
-- else gets access.
REVOKE ALL ON SCHEMA identity FROM PUBLIC;

COMMIT;
