# TutorAssist

A modern math tutoring platform for practice and progress tracking, built with Next.js, Supabase, and AI-powered question generation.

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

- **Framework**: Next.js 15+ (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector + Row Level Security)
- **Auth**: Supabase Auth (email/password)
- **AI**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **Storage**: Cloudflare R2 (S3-compatible)
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
│                      Supabase                                    │
│  PostgreSQL + pgvector │ Row Level Security │ Auth              │
├─────────────────────────────────────────────────────────────────┤
│                    External Services                             │
│  OpenAI API  │  Google Calendar  │  Cloudflare R2               │
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

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)
- OpenAI API key
- (Optional) Cloudflare R2 account
- (Optional) Google Cloud project for Calendar API

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tutorassist.git
   cd tutorassist
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your credentials (see Environment Variables section below).

4. **Set up Supabase database**
   
   Go to your Supabase project → **SQL Editor** and run the following files **in order**:
   
   a. **First**, run `supabase/schema.sql` to create all tables
   
   b. **Second**, run `supabase/functions.sql` to create helper functions
   
   c. **Third**, run `supabase/rls.sql` to set up Row Level Security policies
   
   d. **Fourth**, run any migrations in `supabase/migrations/` in order
   
   e. **Optional**, run `supabase/seed.sql` for demo data
   
   ⚠️ **Important**: Run files in order. Functions must exist before RLS policies.

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

### Environment Variables

Create `.env.local` with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Google Calendar (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Cloudflare R2 (optional)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

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
    ├── supabase/         # Supabase client setup
    ├── jobs/             # Background job handlers
    │   └── handlers/     # Job type implementations
    ├── hooks/            # Custom React hooks
    │   └── use-search.ts # Fuzzy search hook
    ├── google/           # Google API integration
    └── prompts/          # AI prompt templates

supabase/
├── schema.sql            # Database schema
├── functions.sql         # Helper functions
├── rls.sql              # Row Level Security policies
├── seed.sql             # Demo data
└── migrations/          # Incremental migrations
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

### Vercel (Recommended)

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

### Database Migrations

When deploying schema changes:

1. Create migration in `supabase/migrations/`
2. Run migration in Supabase SQL Editor
3. Deploy application code

## Troubleshooting

### Common Issues

**"function does not exist" errors**
- Run `supabase/functions.sql`

**"Invalid API key" errors**
- Check `OPENAI_API_KEY` is set correctly

**Calendar events not showing**
- Verify Google OAuth redirect URI matches exactly
- Check OAuth consent screen has calendar scopes

**Question similarity not working**
- Run migration `012_question_embeddings.sql`
- Enable pgvector extension in Supabase
- Trigger embedding generation via API

## License

MIT License

---

Created by Oscar de Francesca
