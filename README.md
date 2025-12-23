# TutorAssist

A modern math tutoring platform for practice and progress tracking, built with Next.js, Supabase, and AI-powered question generation.

## Features

### For Tutors
- 📚 **Question Bank** - Create and manage math questions with LaTeX support
- 🤖 **AI Generation** - Automatically generate practice questions using GPT-4o-mini
- 📊 **Student Progress** - Track individual student performance and identify weak areas
- 📋 **Assignments** - Create and assign practice sets with due dates
- 📅 **Session Scheduling** - Schedule tutoring sessions with Google Calendar integration
- 📄 **PDF Export** - Generate printable worksheets with or without answer keys
- 📁 **Materials** - Upload and manage source materials (PDFs, images)

### For Students
- ✏️ **Practice Mode** - Work through questions with MathLive input
- 💡 **Hints System** - Get progressive hints when stuck
- 🔄 **Spaced Repetition** - Smart review scheduling based on performance
- 📈 **Progress Tracking** - Visual progress charts and statistics
- 🔥 **Streaks** - Build momentum with correct answer streaks

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Row Level Security)
- **Auth**: Supabase Auth (email/password)
- **AI**: OpenAI API (GPT-4o-mini, Batch API)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Math Input**: MathLive
- **Math Rendering**: KaTeX
- **PDF Generation**: pdf-lib
- **Calendar**: Google Calendar API

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
      - This will drop and recreate the functions using CASCADE
      - This is safe even if functions don't exist yet
   
   c. **Third**, run `supabase/rls.sql` to set up Row Level Security policies
   
   d. **Optional**, run `supabase/seed.sql` for demo data
   
   ⚠️ **Important**: Run functions.sql before rls.sql, as the policies depend on the helper functions.

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

### Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── student/           # Student dashboard
│   └── tutor/             # Tutor dashboard
├── components/            # React components
├── lib/                   # Utilities and services
│   ├── supabase/         # Supabase client setup
│   ├── jobs/             # Background job handlers
│   └── google/           # Google API integration
└── __tests__/            # Test files

supabase/
├── schema.sql            # Database schema (run 1st)
├── functions.sql         # Helper functions (run 2nd)
├── rls.sql              # Row Level Security policies (run 3rd)
└── seed.sql             # Demo data (optional)
```

## Database Setup Troubleshooting

If you encounter errors during database setup:

1. **"function does not exist" errors**: Run `supabase/functions.sql`
2. **"table already exists" errors**: Safe to ignore, tables are already created
3. **"cannot drop function" errors**: The functions.sql file uses CASCADE to handle this
4. **After fixing functions**: Re-run `supabase/rls.sql` to recreate the policies

**Correct order**: schema.sql → functions.sql → rls.sql → seed.sql (optional)

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## Deployment

Deploy to Vercel:

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

## License

MIT License

---

Created by Oscar de Francesca

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
