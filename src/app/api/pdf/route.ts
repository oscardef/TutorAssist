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
  const { title, questionIds, includeAnswers, includeHints } = options
  
  const supabase = await createServerClient()
  
  // Fetch questions - try without workspace filter first since questions may be shared
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*, topics(name)')
    .in('id', questionIds)
  
  if (error) {
    console.error('PDF: Error fetching questions:', error)
    throw new Error(`Failed to fetch questions: ${error.message}`)
  }
  
  if (!questions || questions.length === 0) {
    console.error('PDF: No questions found for IDs:', questionIds)
    throw new Error('No questions found for the given IDs')
  }
  
  console.log(`PDF: Found ${questions.length} questions for generation`)
  
  // Create PDF with standard fonts (ASCII-safe text handling)
  const pdfDoc = await PDFDocument.create()
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const PAGE_WIDTH = 612
  const PAGE_HEIGHT = 792
  const MARGIN_LEFT = 50
  const MARGIN_RIGHT = 50
  const MARGIN_TOP = 60
  const MARGIN_BOTTOM = 60
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
  const LINE_HEIGHT = 16
  const QUESTION_SPACING = 35
  
  // Modern color palette
  const primaryColor = rgb(0.11, 0.42, 0.63)      // Deep blue
  const secondaryColor = rgb(0.20, 0.55, 0.75)   // Medium blue  
  const textColor = rgb(0.15, 0.15, 0.15)         // Near black
  const mutedColor = rgb(0.45, 0.45, 0.45)        // Gray for secondary text
  const lightBorder = rgb(0.82, 0.85, 0.88)       // Light gray borders
  const accentBg = rgb(0.95, 0.97, 0.99)          // Very light blue background
  const successColor = rgb(0.13, 0.55, 0.33)      // Green for correct answers
  
  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let yPosition = PAGE_HEIGHT - MARGIN_TOP
  let pageNumber = 1
  
  const addNewPage = () => {
    // Add footer to current page
    drawFooter()
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    yPosition = PAGE_HEIGHT - MARGIN_TOP
    pageNumber++
  }
  
  const drawFooter = () => {
    // Subtle footer line
    currentPage.drawLine({
      start: { x: MARGIN_LEFT, y: 45 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: 45 },
      thickness: 0.5,
      color: lightBorder,
    })
    
    // Page number centered
    const pageText = `${pageNumber}`
    const pageWidth = regularFont.widthOfTextAtSize(pageText, 9)
    currentPage.drawText(pageText, {
      x: PAGE_WIDTH / 2 - pageWidth / 2,
      y: 28,
      size: 9,
      font: regularFont,
      color: mutedColor,
    })
  }
  
  const ensureSpace = (needed: number) => {
    if (yPosition - needed < MARGIN_BOTTOM) {
      addNewPage()
    }
  }
  
  const drawWrappedText = (
    text: string,
    x: number,
    font: typeof regularFont,
    size: number,
    maxWidth: number,
    color = textColor
  ): number => {
    const safeText = sanitizeForPdf(text)
    const words = safeText.split(' ')
    let line = ''
    let linesDrawn = 0
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word
      const testWidth = font.widthOfTextAtSize(testLine, size)
      
      if (testWidth > maxWidth && line) {
        ensureSpace(LINE_HEIGHT)
        currentPage.drawText(line, { x, y: yPosition, size, font, color })
        yPosition -= LINE_HEIGHT
        linesDrawn++
        line = word
      } else {
        line = testLine
      }
    }
    
    if (line) {
      ensureSpace(LINE_HEIGHT)
      currentPage.drawText(line, { x, y: yPosition, size, font, color })
      yPosition -= LINE_HEIGHT
      linesDrawn++
    }
    
    return linesDrawn
  }
  
  // ========== HEADER SECTION ==========
  
  // Top accent bar
  currentPage.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: primaryColor,
  })
  
  // Title
  currentPage.drawText(sanitizeForPdf(title), {
    x: MARGIN_LEFT,
    y: yPosition - 5,
    size: 26,
    font: boldFont,
    color: primaryColor,
  })
  yPosition -= 38
  
  // Subtitle with date and question count
  const dateStr = new Date().toLocaleDateString('en-GB', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const subtitleText = `${questions.length} Questions  |  ${dateStr}`
  currentPage.drawText(subtitleText, {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 10,
    font: regularFont,
    color: mutedColor,
  })
  yPosition -= 30
  
  // Name and Date fields with modern styling
  const fieldY = yPosition
  
  currentPage.drawText('Name:', {
    x: MARGIN_LEFT,
    y: fieldY,
    size: 10,
    font: boldFont,
    color: textColor,
  })
  
  // Underline for name
  currentPage.drawLine({
    start: { x: MARGIN_LEFT + 40, y: fieldY - 3 },
    end: { x: MARGIN_LEFT + 220, y: fieldY - 3 },
    thickness: 1,
    color: lightBorder,
  })
  
  currentPage.drawText('Date:', {
    x: MARGIN_LEFT + 280,
    y: fieldY,
    size: 10,
    font: boldFont,
    color: textColor,
  })
  
  // Underline for date
  currentPage.drawLine({
    start: { x: MARGIN_LEFT + 315, y: fieldY - 3 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: fieldY - 3 },
    thickness: 1,
    color: lightBorder,
  })
  
  yPosition -= 25
  
  // Note about math notation (if questions contain LaTeX)
  const hasLatex = questions.some(q => q.prompt_latex && q.prompt_latex.includes('\\'))
  if (hasLatex) {
    currentPage.drawText('Note: Math expressions shown in simplified text notation', {
      x: MARGIN_LEFT,
      y: yPosition,
      size: 8,
      font: regularFont,
      color: mutedColor,
    })
    yPosition -= 18
  }
  
  // Section divider
  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
    thickness: 1.5,
    color: lightBorder,
  })
  yPosition -= 25
  
  // ========== QUESTIONS SECTION ==========
  
  questions.forEach((question, index) => {
    ensureSpace(100)
    
    const questionStartY = yPosition + 12
    
    // Question number badge
    const qNumText = `${index + 1}`
    const qNumWidth = boldFont.widthOfTextAtSize(qNumText, 13)
    
    // Badge background
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: yPosition - 5,
      width: 28,
      height: 22,
      color: primaryColor,
    })
    
    // Badge number
    currentPage.drawText(qNumText, {
      x: MARGIN_LEFT + 14 - qNumWidth / 2,
      y: yPosition,
      size: 13,
      font: boldFont,
      color: rgb(1, 1, 1),
    })
    
    // Topic tag (if available)
    const topicName = (question.topics as { name: string } | null)?.name
    if (topicName) {
      const topicText = sanitizeForPdf(topicName)
      const topicWidth = regularFont.widthOfTextAtSize(topicText, 8)
      
      // Topic tag background
      currentPage.drawRectangle({
        x: MARGIN_LEFT + 34,
        y: yPosition + 3,
        width: topicWidth + 10,
        height: 14,
        color: accentBg,
        borderColor: lightBorder,
        borderWidth: 0.5,
      })
      
      currentPage.drawText(topicText, {
        x: MARGIN_LEFT + 39,
        y: yPosition + 6,
        size: 8,
        font: regularFont,
        color: secondaryColor,
      })
    }
    
    // Difficulty dots (right aligned)
    const difficulty = question.difficulty || 3
    const dotStartX = PAGE_WIDTH - MARGIN_RIGHT - 65
    
    currentPage.drawText('Difficulty:', {
      x: dotStartX - 50,
      y: yPosition + 3,
      size: 7,
      font: regularFont,
      color: mutedColor,
    })
    
    for (let i = 1; i <= 5; i++) {
      currentPage.drawCircle({
        x: dotStartX + (i * 12),
        y: yPosition + 5,
        size: 3.5,
        color: i <= difficulty ? secondaryColor : rgb(0.88, 0.88, 0.88),
      })
    }
    
    yPosition -= 24
    
    // Question text
    const questionText = cleanLatexForPdf(question.prompt_latex || question.prompt_text || '')
    drawWrappedText(questionText, MARGIN_LEFT + 36, regularFont, 11, CONTENT_WIDTH - 36)
    
    // Hints (if enabled)
    if (includeHints && question.hints_json) {
      const hints = question.hints_json as string[]
      if (hints.length > 0) {
        yPosition -= 8
        hints.forEach((hint, i) => {
          ensureSpace(LINE_HEIGHT + 8)
          
          // Hint box background
          currentPage.drawRectangle({
            x: MARGIN_LEFT + 36,
            y: yPosition - 2,
            width: CONTENT_WIDTH - 36,
            height: LINE_HEIGHT + 4,
            color: rgb(1, 0.98, 0.94), // Warm hint background
          })
          
          currentPage.drawText(`Hint ${i + 1}:`, {
            x: MARGIN_LEFT + 42,
            y: yPosition,
            size: 9,
            font: boldFont,
            color: rgb(0.7, 0.5, 0.2),
          })
          
          yPosition -= LINE_HEIGHT
          drawWrappedText(sanitizeForPdf(hint), MARGIN_LEFT + 42, regularFont, 9, CONTENT_WIDTH - 48, mutedColor)
        })
      }
    }
    
    // Answer lines with subtle styling
    yPosition -= 10
    ensureSpace(55)
    
    currentPage.drawText('Answer:', {
      x: MARGIN_LEFT + 36,
      y: yPosition,
      size: 9,
      font: boldFont,
      color: mutedColor,
    })
    yPosition -= 12
    
    for (let i = 0; i < 3; i++) {
      currentPage.drawLine({
        start: { x: MARGIN_LEFT + 36, y: yPosition },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
        thickness: 0.5,
        color: lightBorder,
        dashArray: [3, 3],
      })
      yPosition -= 18
    }
    
    // Left border accent for the question
    currentPage.drawLine({
      start: { x: MARGIN_LEFT + 32, y: questionStartY },
      end: { x: MARGIN_LEFT + 32, y: yPosition + 20 },
      thickness: 2,
      color: accentBg,
    })
    
    yPosition -= QUESTION_SPACING - 30
  })
  
  // Footer on last questions page
  drawFooter()
  
  // ========== ANSWER KEY SECTION ==========
  
  if (includeAnswers) {
    addNewPage()
    
    // Answer key header
    currentPage.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 8,
      width: PAGE_WIDTH,
      height: 8,
      color: successColor,
    })
    
    currentPage.drawText('Answer Key', {
      x: MARGIN_LEFT,
      y: yPosition - 5,
      size: 22,
      font: boldFont,
      color: successColor,
    })
    yPosition -= 35
    
    currentPage.drawLine({
      start: { x: MARGIN_LEFT, y: yPosition + 5 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition + 5 },
      thickness: 1.5,
      color: lightBorder,
    })
    yPosition -= 20
    
    questions.forEach((question, index) => {
      ensureSpace(35)
      
      // Question number
      currentPage.drawText(`${index + 1}.`, {
        x: MARGIN_LEFT,
        y: yPosition,
        size: 11,
        font: boldFont,
        color: primaryColor,
      })
      
      // Answer text
      let answerText = ''
      const correctAnswer = question.correct_answer_json as Record<string, unknown> | null
      if (correctAnswer) {
        if (correctAnswer.value !== undefined) {
          answerText = String(correctAnswer.value)
        } else if (correctAnswer.latex) {
          answerText = cleanLatexForPdf(String(correctAnswer.latex))
        } else if (correctAnswer.text) {
          answerText = String(correctAnswer.text)
        }
      }
      
      const safeAnswer = sanitizeForPdf(answerText) || 'See solution'
      drawWrappedText(safeAnswer, MARGIN_LEFT + 28, regularFont, 10, CONTENT_WIDTH - 28, textColor)
      yPosition -= 8
    })
    
    // Final footer
    drawFooter()
  }
  
  return pdfDoc.save()
}

// Clean LaTeX to readable ASCII text
function cleanLatexForPdf(latex: string): string {
  return latex
    .replace(/\\\[/g, '').replace(/\\\]/g, '')
    .replace(/\\\(/g, '').replace(/\\\)/g, '')
    .replace(/\$\$/g, '').replace(/\$/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1-root($2)')
    .replace(/\\times/g, ' x ')
    .replace(/\\cdot/g, ' * ')
    .replace(/\\div/g, ' / ')
    .replace(/\\pm/g, ' +/- ')
    .replace(/\\mp/g, ' -/+ ')
    .replace(/\\leq/g, ' <= ')
    .replace(/\\geq/g, ' >= ')
    .replace(/\\neq/g, ' != ')
    .replace(/\\approx/g, ' ~ ')
    .replace(/\\equiv/g, ' === ')
    .replace(/\\pi/g, 'pi')
    .replace(/\\theta/g, 'theta')
    .replace(/\\alpha/g, 'alpha')
    .replace(/\\beta/g, 'beta')
    .replace(/\\gamma/g, 'gamma')
    .replace(/\\delta/g, 'delta')
    .replace(/\\lambda/g, 'lambda')
    .replace(/\\sigma/g, 'sigma')
    .replace(/\\omega/g, 'omega')
    .replace(/\\infty/g, 'infinity')
    .replace(/\\degree/g, ' deg')
    .replace(/\\circ/g, ' deg')
    .replace(/\\sum/g, 'sum')
    .replace(/\\prod/g, 'product')
    .replace(/\\int/g, 'integral')
    .replace(/\\partial/g, 'd')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\left/g, '').replace(/\\right/g, '')
    .replace(/\\big/g, '').replace(/\\Big/g, '')
    .replace(/\^{([^}]+)}/g, '^($1)')
    .replace(/_{([^}]+)}/g, '_($1)')
    .replace(/\^(\d)/g, '^$1')
    .replace(/_(\d)/g, '_$1')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Sanitize text for PDF - ensure ASCII-safe output
function sanitizeForPdf(text: string): string {
  if (!text) return ''
  
  return text
    // Common math Unicode to ASCII
    .replace(/\u221A/g, 'sqrt')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2213/g, '-/+')
    .replace(/\u00B7/g, '*')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2260/g, '!=')
    .replace(/\u2248/g, '~')
    .replace(/\u2261/g, '===')
    .replace(/\u03C0/g, 'pi')
    .replace(/\u03B8/g, 'theta')
    .replace(/\u03B1/g, 'alpha')
    .replace(/\u03B2/g, 'beta')
    .replace(/\u03B3/g, 'gamma')
    .replace(/\u03B4/g, 'delta')
    .replace(/\u03BB/g, 'lambda')
    .replace(/\u03C3/g, 'sigma')
    .replace(/\u03C9/g, 'omega')
    .replace(/\u221E/g, 'infinity')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u2211/g, 'sum')
    .replace(/\u220F/g, 'product')
    .replace(/\u222B/g, 'integral')
    .replace(/\u2202/g, 'd')
    // Typography
    .replace(/\u2022/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2194/g, '<->')
    .replace(/\u21D2/g, '=>')
    .replace(/\u21D0/g, '<=')
    .replace(/\u21D4/g, '<=>')
    // Remove any remaining non-printable or non-ASCII
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    .trim()
}
