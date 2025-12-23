import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { enqueueJob, getJob } from '@/lib/jobs'
import { createServerClient } from '@/lib/supabase/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Generate PDF
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can generate PDFs' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const {
      title = 'Practice Questions',
      questionIds,
      includeAnswers = false,
      includeHints = false,
      studentId,
      assignmentId,
      immediate = false, // If true, generate immediately instead of via job
    } = body
    
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ error: 'Question IDs required' }, { status: 400 })
    }
    
    // For small PDFs, generate immediately
    if (immediate && questionIds.length <= 20) {
      const pdfData = await generatePdfImmediate({
        workspaceId: context.workspaceId,
        title,
        questionIds,
        includeAnswers,
        includeHints,
      })
      
      return new NextResponse(Buffer.from(pdfData), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
        },
      })
    }
    
    // For larger PDFs, use job queue
    const job = await enqueueJob({
      workspaceId: context.workspaceId,
      userId: user.id,
      type: 'GENERATE_PDF',
      payload: {
        workspaceId: context.workspaceId,
        title,
        questionIds,
        includeAnswers,
        includeHints,
        studentId,
        assignmentId,
      },
      priority: 2, // High priority for user-initiated
    })
    
    if (!job) {
      return NextResponse.json({ error: 'Failed to enqueue PDF job' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

// Get PDF job status or download
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  
  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
  }
  
  const job = await getJob(jobId)
  
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  
  return NextResponse.json({
    id: job.id,
    status: job.status,
    result: job.result_json,
    error: job.error_text,
  })
}

// Immediate PDF generation for small requests
async function generatePdfImmediate(options: {
  workspaceId: string
  title: string
  questionIds: string[]
  includeAnswers: boolean
  includeHints: boolean
}): Promise<Uint8Array> {
  const { workspaceId, title, questionIds, includeAnswers, includeHints } = options
  
  const supabase = await createServerClient()
  
  // Fetch questions
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*, topics(name)')
    .in('id', questionIds)
    .eq('workspace_id', workspaceId)
  
  if (error || !questions || questions.length === 0) {
    throw new Error('No questions found')
  }
  
  // Create PDF
  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const PAGE_WIDTH = 612
  const PAGE_HEIGHT = 792
  const MARGIN = 50
  const LINE_HEIGHT = 14
  
  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let yPosition = PAGE_HEIGHT - MARGIN
  
  const addNewPage = () => {
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    yPosition = PAGE_HEIGHT - MARGIN
  }
  
  const ensureSpace = (needed: number) => {
    if (yPosition - needed < MARGIN) {
      addNewPage()
    }
  }
  
  const drawText = (
    text: string,
    x: number,
    font: typeof helvetica,
    size: number,
    maxWidth: number
  ) => {
    const words = text.split(' ')
    let line = ''
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word
      const testWidth = font.widthOfTextAtSize(testLine, size)
      
      if (testWidth > maxWidth && line) {
        ensureSpace(LINE_HEIGHT)
        currentPage.drawText(line, { x, y: yPosition, size, font, color: rgb(0, 0, 0) })
        yPosition -= LINE_HEIGHT
        line = word
      } else {
        line = testLine
      }
    }
    
    if (line) {
      ensureSpace(LINE_HEIGHT)
      currentPage.drawText(line, { x, y: yPosition, size, font, color: rgb(0, 0, 0) })
      yPosition -= LINE_HEIGHT
    }
  }
  
  // Title
  currentPage.drawText(title, {
    x: MARGIN,
    y: yPosition,
    size: 24,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  yPosition -= 40
  
  // Date
  currentPage.drawText(new Date().toLocaleDateString('en-GB'), {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  })
  yPosition -= 20
  
  // Name field
  currentPage.drawText('Name: _______________________', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  })
  yPosition -= 40
  
  // Questions
  questions.forEach((question, index) => {
    ensureSpace(80)
    
    currentPage.drawText(`${index + 1}.`, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })
    
    const questionText = cleanLatex(question.question_latex || '')
    drawText(questionText, MARGIN + 25, helvetica, 11, PAGE_WIDTH - 2 * MARGIN - 25)
    
    if (includeHints && question.hints_json) {
      const hints = question.hints_json as string[]
      if (hints.length > 0) {
        yPosition -= 5
        hints.forEach((hint, i) => {
          drawText(`Hint ${i + 1}: ${hint}`, MARGIN + 35, helvetica, 9, PAGE_WIDTH - 2 * MARGIN - 35)
        })
      }
    }
    
    yPosition -= 30
  })
  
  // Answer key
  if (includeAnswers) {
    addNewPage()
    
    currentPage.drawText('Answer Key', {
      x: MARGIN,
      y: yPosition,
      size: 20,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })
    yPosition -= 40
    
    questions.forEach((question, index) => {
      ensureSpace(60)
      
      currentPage.drawText(`${index + 1}.`, {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
      
      const answerText = cleanLatex(question.answer_latex || '')
      drawText(answerText, MARGIN + 25, helvetica, 11, PAGE_WIDTH - 2 * MARGIN - 25)
      
      yPosition -= 15
    })
  }
  
  return pdfDoc.save()
}

function cleanLatex(latex: string): string {
  return latex
    .replace(/\\\[/g, '').replace(/\\\]/g, '')
    .replace(/\\\(/g, '').replace(/\\\)/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\times/g, '×').replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±').replace(/\\cdot/g, '·')
    .replace(/\\leq/g, '≤').replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠').replace(/\\pi/g, 'π')
    .replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '')
    .trim()
}
