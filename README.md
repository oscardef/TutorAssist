# Mathium (formerly TutorAssist)

A modern math tutoring platform for practice and progress tracking, built with Next.js, a self-hosted PostgreSQL backend, and AI-powered question generation.

## Features

### For Tutors
- 📚 **Question Bank** - Create and manage math questions with LaTeX support and similarity search
- 🤖 **AI Generation** - Automatically generate practice questions using GPT-4o-mini
- 📊 **Student Progress** - Track individual student performance and identify weak areas
- 📋 **Assignments** - Create and assign practice sets with due dates
- 📅 **Session Scheduling** - Schedule tutoring sessions with Google Calendar integration
- 🚩 **Flag Review** - Review student-flagged questions and accept alternate answers
- 📄 **PDF Export** - Generate printable worksheets with or without answer keys
- 📁 **Materials** - Upload and manage source materials (PDFs, images)

### For Students
- ✏️ **Practice Mode** - Work through questions with MathLive input
- 💡 **Hints System** - Get progressive hints when stuck
- 🔄 **Spaced Repetition** - Smart review scheduling based on performance
- 📈 **Progress Tracking** - Visual progress charts and statistics
- 🔥 **Streaks** - Build momentum with correct answer streaks
- 🚩 **Flag Questions** - Report unclear questions or claim alternate correct answers

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL 17 + pgvector, self-hosted
- **Data API**: PostgREST with row-level security; the app mints a JWT per request from the session
- **Auth**: Better Auth (email/password, magic links, Google) with bcrypt; identity tables in a separate `identity` schema
- **Background jobs**: Postgres-backed queue processed by a worker container (`src/worker.ts`)
- **AI**: OpenAI API (GPT-4o-mini, text-embedding-3-small); Anthropic as a second provider (planned)
- **Storage**: local disk behind an adapter (any S3-compatible bucket also supported)
- **Math Input**: MathLive
- **Math Rendering**: KaTeX
- **PDF Generation**: pdf-lib
- **Calendar**: Google Calendar API
- **Search**: Fuse.js (fuzzy search) + pgvector (similarity search)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App                              │
├─────────────────────────────────────────────────────────────────┤
│  Tutor UI        │  Student UI        │  API Routes             │
│  /tutor/*        │  /student/*        │  /api/*                 │
├─────────────────────────────────────────────────────────────────┤
│                    Shared Components                             │
│  LatexRenderer, AnswerInput, SearchableSelect, etc.             │
├─────────────────────────────────────────────────────────────────┤
│                    Services & Hooks                              │
│  useSearch, auth, storage, jobs                                 │
├─────────────────────────────────────────────────────────────────┤
│  Better Auth (identity schema)  │  PostgREST (data API, RLS)    │
│                    PostgreSQL 17 + pgvector                      │
├─────────────────────────────────────────────────────────────────┤
│  Worker (jobs)  │  Local file storage  │  OpenAI  │  Google Cal │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

#### Workspaces
Each tutor has a workspace containing their students, questions, topics, and assignments. Row Level Security ensures data isolation.

#### Programs & Grade Levels
Topics are organized by study program (e.g., "IB", "NSW HSC") and grade level (e.g., "Year 11", "SL"). This allows tutors to manage multiple curricula.

#### Question Types
Questions support multiple answer types for different mathematical contexts:

| Type | Description | Example |
|------|-------------|---------|
| `numeric` | Plain numbers | 42, -3.5 |
| `expression` | LaTeX math expressions | `x^2 + 1` |
| `multiple_choice` | Select from options | A, B, C, D |
| `true_false` | Boolean | true/false |
| `fraction` | Fraction values | 3/4 |
| `coordinates` | Point coordinates | (2, 3) |
| `matrix` | Matrix values | [[1,2],[3,4]] |
| `set` | Set of values | {1, 2, 3} |
| `range` | Numeric range | [0, 10) |
| `complex` | Complex numbers | 3 + 4i |
| `vector` | Vector values | [1, 2, 3] |
| `equation` | Full equations | y = mx + b |
| `inequality` | Inequalities | x > 5 |
| `interval` | Interval notation | (-∞, 5] |
| `unit` | Values with units | 5 m/s |

#### Job Queue
Long-running tasks (AI generation, PDF creation, embeddings) use a job queue pattern:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  API Route   │ --> │   Jobs DB    │ --> │  Job Worker  │
│  (enqueue)   │     │   (queue)    │     │  (process)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

Job types: `GENERATE_QUESTIONS`, `GENERATE_PDF`, `GENERATE_EMBEDDINGS`, `REGEN_VARIANT`

## Getting Started

### Prerequisites

- Node.js 22+
- Docker (for the local Postgres and PostgREST containers)
- OpenAI API key
- (Optional) Google Cloud project for Calendar API

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/oscardef/TutorAssist.git
   cd TutorAssist
   npm install
   ```

2. **Start Postgres and PostgREST**
   ```bash
   docker run -d --name mathium-dev-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=mathium \
     -p 127.0.0.1:5433:5432 pgvector/pgvector:pg17
   docker exec mathium-dev-db psql -U postgres -d mathium -c "CREATE SCHEMA extensions; \
     CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION \"uuid-ossp\" SCHEMA extensions; \
     CREATE EXTENSION vector SCHEMA extensions; ALTER DATABASE mathium SET search_path TO public, extensions;"
   # load the application schema (supabase/schema.sql, functions.sql, rls.sql, migrations/ in order), then:
   cp .env.example .env.local
   npm run db:migrate
   docker exec mathium-dev-db psql -U postgres -d mathium -c "ALTER ROLE authenticator PASSWORD 'devauth'"
   docker run -d --name mathium-dev-postgrest -p 127.0.0.1:3001:3000 \
     -e PGRST_DB_URI=postgresql://authenticator:devauth@host.docker.internal:5433/mathium \
     -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_EXTRA_SEARCH_PATH=public,extensions \
     -e PGRST_JWT_SECRET=dev-jwt-secret-at-least-32-characters-long-123456 postgrest/postgrest:v16.5
   ```

3. **Run**
   ```bash
   npm run dev          # web on http://localhost:3000
   npm run worker       # background jobs (separate terminal)
   ```

### Environment Variables

See `.env.example`. The important ones: `DATABASE_URL` (direct connection for auth, migrations, worker),
`POSTGREST_URL` and `PGRST_JWT_SECRET` (data API), `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, `OPENAI_API_KEY`,
`STORAGE_BACKEND` (`local` or `s3`), SMTP settings for email.

### Google OAuth Setup (for Calendar Integration)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project and enable Google Calendar API
3. Configure OAuth consent screen with scopes: `calendar`, `calendar.events`
4. Create OAuth credentials (Web application)
5. Add redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Add credentials to `.env.local`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── assignments/   # Assignment CRUD + AI generation
│   │   ├── questions/     # Question CRUD + similarity search
│   │   ├── flags/         # Flag review system
│   │   ├── sessions/      # Session management + calendar sync
│   │   └── ...
│   ├── student/           # Student dashboard pages
│   │   ├── dashboard/     # Student home
│   │   ├── practice/      # Practice mode
│   │   ├── assignments/   # Assignment view
│   │   └── progress/      # Progress tracking
│   └── tutor/             # Tutor dashboard pages
│       ├── dashboard/     # Tutor home with action items
│       ├── students/      # Student management
│       ├── questions/     # Question bank with similarity
│       ├── topics/        # Topic hierarchy management
│       ├── generate/      # AI question generation
│       ├── assignments/   # Assignment creation
│       ├── sessions/      # Session scheduling
│       ├── flags/         # Flag review
│       └── materials/     # Material uploads
├── components/            # React components
│   ├── answer-input.tsx   # MathLive math input
│   ├── answer-display.tsx # Answer rendering
│   ├── latex-renderer.tsx # KaTeX rendering
│   ├── searchable-select.tsx # Multi-select with search
│   └── ...
└── lib/                   # Utilities and services
    ├── supabase/         # PostgREST data client (name kept for history)
    ├── identity/         # Better Auth server + browser client
    ├── db/               # Drizzle connection + identity schema
    ├── jobs/             # Background job handlers
    │   └── handlers/     # Job type implementations
    ├── hooks/            # Custom React hooks
    │   └── use-search.ts # Fuzzy search hook
    ├── google/           # Google API integration
    └── prompts/          # AI prompt templates

supabase/                 # Original application schema (still the baseline)
├── schema.sql, functions.sql, rls.sql, seed.sql, migrations/
db/migrations/            # Post-Supabase migrations applied by `npm run db:migrate`
deploy/                   # Dockerfile companion: Compose stack, env template, backup script, notes
```

## API Reference

### Questions API

```
GET  /api/questions          # List questions (with filters)
POST /api/questions          # Create question
GET  /api/questions?id=x     # Get single question
PUT  /api/questions          # Update question
DELETE /api/questions?id=x   # Delete question

GET  /api/questions/similar?questionId=x  # Find similar questions
POST /api/questions/similar               # Generate embeddings
```

### Assignments API

```
GET  /api/assignments        # List assignments
POST /api/assignments        # Create assignment
GET  /api/assignments/[id]   # Get assignment details
PUT  /api/assignments/[id]   # Update assignment

POST /api/assignments/generate  # AI-generate assignment
POST /api/assignments/refine    # Refine with AI feedback
```

### Students API

```
GET  /api/students           # List students
POST /api/students           # Create student profile
GET  /api/students/[id]      # Get student details
PUT  /api/students/[id]      # Update student
DELETE /api/students/[id]    # Delete student
```

### Flags API

```
GET   /api/flags             # List flags
POST  /api/flags             # Create flag (student)
PATCH /api/flags             # Review flag (tutor)
```

## Development Workflow

### Adding a New Question Type

1. Add type to `src/lib/types.ts` in `AnswerType` union
2. Update `answer-input.tsx` to handle input
3. Update `answer-display.tsx` to render answer
4. Update AI prompts in `src/lib/prompts/` to generate correctly
5. Run migration if schema changes needed

### Adding a New Job Type

1. Add type to `JobType` in `src/lib/types.ts`
2. Create handler in `src/lib/jobs/handlers/`
3. Register handler in `src/lib/jobs/index.ts`
4. Create API endpoint to enqueue jobs

### Running Tests

```bash
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run test:watch       # Watch mode
```

## Deployment

Self-hosted with Docker Compose; see `deploy/README.md`. One image runs the web server and the worker,
beside Postgres and PostgREST.

### Database Migrations

Add a file to `db/migrations/` (`NNNN_name.sql`, idempotent) and run `npm run db:migrate`
(or `docker compose run --rm web node node_modules/.bin/tsx scripts/db-migrate.ts` on the server).

## Troubleshooting

### Common Issues

**"DATABASE_URL is not set" / "POSTGREST_URL is not set"**
- Copy `.env.example` to `.env.local` and start the local containers

**Sign-in fails for a migrated account**
- Hashes from Supabase are bcrypt and verify as-is; use "Forgot password" on the signup page if needed

**Calendar events not showing**
- Verify Google OAuth redirect URI matches exactly
- Check OAuth consent screen has calendar scopes

**Question similarity not working**
- Enable pgvector and trigger embedding generation via API

## License

MIT License

---

Created by Oscar de Francesca. Product domain: mathium.app. Repository name unchanged for now.
