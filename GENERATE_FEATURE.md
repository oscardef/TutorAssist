# AI Generation Studio - Feature Documentation

## Overview

The **Generate** page is the core selling point of TutorAssist - a comprehensive AI-powered studio for creating educational content. It provides maximum flexibility and customization for tutors to generate high-quality materials.

## Key Features

### 1. **Question Generation**
Generate practice questions across multiple topics with extensive customization:

#### Required Fields:
- **Topics**: Select one or more topics to generate questions for

#### Optional Fields (AI determines if not specified):
- **Question Count**: Number of questions to generate (default: 10)
- **Difficulty**: Easy, Medium, Hard, or Adaptive
- **Question Types**: Multiple choice, Short answer, True/False, Fill-in-the-blank, Essay, Calculation
- **Include Worked Solutions**: Step-by-step solutions
- **Include Hints**: Progressive hints for each question
- **Real-World Context**: Questions with practical applications
- **Exam Style**: Format questions like official exams
- **Custom Instructions**: Free-text instructions for AI
- **Batch API**: Use cheaper batch processing (50% cost reduction, 24hr delivery)

### 2. **Topics/Syllabus Generation**
AI-generate complete curriculum topic sets based on educational standards:

#### Required Fields:
- **Name**: Title for the topic set/syllabus
- **Target Grade Level**: The grade level to create topics for

#### Optional Fields (AI determines intelligently):
- **Description**: Scope and goals of the syllabus
- **Number of Topics**: ⭐ **NEW - OPTIONAL!** Leave blank and AI will determine the optimal count based on:
  - International curriculum standards (IB, GCSE, etc.)
  - Grade level expectations
  - Typical semester/year duration
  - Pedagogical best practices
- **Depth**: Overview, Standard, or Detailed
- **Include Subtopics**: 3-5 subtopics per main topic
- **Include Learning Objectives**: 2-3 objectives per topic
- **Map from Existing Program**: Adapt topics from another curriculum
- **Custom Prompt**: Additional AI instructions

#### AI Intelligence for Topic Count:
When topic count is left blank, the AI:
- Analyzes the target program and grade level
- References international curriculum standards
- Determines appropriate scope (8-15 for semester, 15-25 for full year)
- Creates pedagogically-sound topic progressions

### 3. **Assignment Generation**
Create assignments for one or multiple students with selected questions:

#### Required Fields:
- **Students**: Select one or more students
- **Topics**: Select topics to draw questions from
- **Title**: Assignment name

#### Optional Fields:
- **Question Count**: Number of questions (default: 10)
- **Difficulty**: Easy, Medium, Hard, ⭐ **Mixed (variety)**, or Adaptive
- **Due Date**: When assignment is due
- **Instructions**: Custom instructions for students
- **Time Limit**: Minutes allowed to complete
- **Shuffle Questions**: Randomize question order per student
- **Show Results Immediately**: Display results after submission

#### Mixed Difficulty Feature:
When "Mixed (variety)" is selected, the AI:
- Ensures balanced distribution across difficulty levels
- Aims for roughly 1/3 easy, 1/3 medium, 1/3 hard
- Automatically fills gaps if not enough questions in each category
- Provides comprehensive assessment of student abilities

## Recent Enhancements (Latest Update)

### ✅ Optional Topic Count
- Topics/Syllabus generation no longer requires specifying topic count
- AI uses curriculum knowledge to determine optimal number
- Placeholder text: "Let AI decide based on curriculum"
- Help text: "AI will determine optimal count if left blank"

### ✅ Mixed Difficulty for Assignments
- New "Mixed (variety)" option in assignment difficulty dropdown
- Automatically selects questions across all difficulty levels
- Ensures balanced assessment with variety

### ✅ Improved Validation
- Removed strict validation for optional fields
- Better error messages when required fields are missing
- Success messages reflect actual values (e.g., actual topic count created)

### ✅ Enhanced API Intelligence
- `/api/syllabus/generate` now handles undefined topic count
- Dynamic prompts based on whether fields are specified
- AI determines appropriate values using educational standards knowledge

## API Endpoints

### POST `/api/questions/bulk-generate`
Generate questions across multiple topics
- Supports both legacy `requests[]` and new `topicIds[]` format
- Optional: questionTypes, customInstructions, batch processing
- Returns: `questionsGenerated` count or `jobId` for batch jobs

### POST `/api/syllabus/generate`
Generate topic sets/curriculum
- **NEW**: `topicCount` is optional (AI determines if undefined)
- Required: `name`, `targetGradeLevelId`
- Optional: `description`, `topicCount`, `depth`, `includeSubtopics`, `includeLearningObjectives`, `sourceProgramId`, `customPrompt`
- Returns: `topicsCreated` count with actual number generated

### POST `/api/assignments/generate`
Create assignments for students
- Supports multi-student assignment creation
- **NEW**: `difficulty` includes 'mixed' option
- Required: `studentIds`, `topicIds`, `title`
- Optional: `questionCount`, `difficulty`, `dueDate`, `instructions`, `options` (timeLimit, shuffle, showResults)
- Returns: `assignmentsCreated` count

## Database Schema

### Student Program/Grade Tracking (Migration 009)
```sql
ALTER TABLE student_profiles 
ADD COLUMN study_program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,
ADD COLUMN grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL;
```

**Note**: You need to run this migration in your Supabase dashboard before student program/grade features work!

## Usage Tips

### For Maximum Flexibility:
1. **Leave fields blank** when you want AI to make intelligent decisions
2. **Use custom instructions** to provide context-specific requirements
3. **Select "mixed" difficulty** for comprehensive student assessment
4. **Enable batch API** for large question sets to save 50% on costs

### For Curriculum Planning:
1. Start with **Syllabus Generation** (leave topic count blank for AI to decide)
2. Review generated topics and adjust if needed
3. Use **Question Generation** for each topic
4. Create **Assignments** to assess student progress

### For Student Assessment:
1. Use **adaptive difficulty** for personalized challenges
2. Use **mixed difficulty** for comprehensive evaluation
3. Enable **shuffle questions** to prevent answer sharing
4. Set **time limits** for exam simulation

## Best Practices

1. **Start broad, refine narrow**: Let AI determine counts/structure, then adjust
2. **Use custom instructions**: Be specific about requirements
3. **Leverage batch API**: For large generations (50+ questions)
4. **Test with mixed difficulty**: Before settling on fixed difficulty levels
5. **Map from existing programs**: When adapting from known curricula

## Future Enhancements (Potential)

- [ ] Make question count optional (AI determines appropriate amount per topic)
- [ ] AI-suggested due dates based on student progress
- [ ] Automatic difficulty adjustment based on past performance
- [ ] Integration with web scraping for real-time curriculum data
- [ ] Export to PDF/Word formats
- [ ] Collaborative syllabus creation with other tutors

---

**Last Updated**: Latest feature update (Optional topic count + Mixed difficulty)
**Version**: 1.0
**Status**: Production Ready ✅
