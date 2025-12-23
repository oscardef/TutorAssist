import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import { completeJob, failJob } from '../queue'

interface GeneratePdfPayload {
  workspaceId: string
  title: string
  questionIds: string[]
  includeAnswers: boolean
  includeHints: boolean
  studentId?: string
  assignmentId?: string
}

export async function handleGeneratePdf(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as GeneratePdfPayload
  const {
    workspaceId,
    title,
    questionIds,
    includeAnswers,
    includeHints,
    studentId,
    assignmentId,
  } = payload
  
  try {
    const supabase = await createAdminClient()
    
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
    
    const PAGE_WIDTH = 612 // Letter size
    const PAGE_HEIGHT = 792
    const MARGIN = 50
    const LINE_HEIGHT = 14
    const QUESTION_SPACING = 30
    
    let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    let yPosition = PAGE_HEIGHT - MARGIN
    
    // Helper to add a new page
    const addNewPage = () => {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      yPosition = PAGE_HEIGHT - MARGIN
    }
    
    // Helper to check if we need a new page
    const ensureSpace = (needed: number) => {
      if (yPosition - needed < MARGIN) {
        addNewPage()
      }
    }
    
    // Helper to draw text with word wrap
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
          currentPage.drawText(line, {
            x,
            y: yPosition,
            size,
            font,
            color: rgb(0, 0, 0),
          })
          yPosition -= LINE_HEIGHT
          line = word
        } else {
          line = testLine
        }
      }
      
      if (line) {
        ensureSpace(LINE_HEIGHT)
        currentPage.drawText(line, {
          x,
          y: yPosition,
          size,
          font,
          color: rgb(0, 0, 0),
        })
        yPosition -= LINE_HEIGHT
      }
    }
    
    // Draw title
    currentPage.drawText(title, {
      x: MARGIN,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    })
    yPosition -= 40
    
    // Draw date in DD/MM/YYYY format
    const dateStr = new Date().toLocaleDateString('en-GB')
    currentPage.drawText(dateStr, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    })
    yPosition -= 30
    
    // Draw student name field if applicable
    if (studentId) {
      currentPage.drawText('Name: _______________________', {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: rgb(0, 0, 0),
      })
      yPosition -= 30
    }
    
    // Draw questions
    questions.forEach((question, index) => {
      ensureSpace(100) // Ensure minimum space for a question
      
      // Question number and topic
      const topicName = (question.topics as { name: string } | null)?.name || 'General'
      currentPage.drawText(`Question ${index + 1}`, {
        x: MARGIN,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      })
      
      currentPage.drawText(`[${topicName}]`, {
        x: MARGIN + 100,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      })
      
      // Difficulty badge
      const difficultyColors = {
        easy: rgb(0.2, 0.7, 0.3),
        medium: rgb(0.9, 0.7, 0.1),
        hard: rgb(0.9, 0.3, 0.3),
      }
      const difficulty = question.difficulty as 'easy' | 'medium' | 'hard' | null
      const diffColor = difficulty ? difficultyColors[difficulty] : rgb(0.5, 0.5, 0.5)
      
      currentPage.drawText(question.difficulty?.toUpperCase() || 'MEDIUM', {
        x: PAGE_WIDTH - MARGIN - 50,
        y: yPosition,
        size: 8,
        font: helveticaBold,
        color: diffColor,
      })
      
      yPosition -= 20
      
      // Question text (convert LaTeX to plain text for PDF)
      // In production, you'd use a LaTeX renderer
      const questionText = cleanLatex(question.question_latex || '')
      drawText(questionText, MARGIN, helvetica, 11, PAGE_WIDTH - 2 * MARGIN)
      
      // Hints if included
      if (includeHints && question.hints_json && Array.isArray(question.hints_json)) {
        yPosition -= 10
        currentPage.drawText('Hints:', {
          x: MARGIN + 20,
          y: yPosition,
          size: 9,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.7),
        })
        yPosition -= 12
        
        question.hints_json.forEach((hint: string, hintIndex: number) => {
          drawText(`${hintIndex + 1}. ${hint}`, MARGIN + 30, helvetica, 9, PAGE_WIDTH - 2 * MARGIN - 30)
        })
      }
      
      yPosition -= QUESTION_SPACING
    })
    
    // Add answer key pages if included
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
        ensureSpace(80)
        
        currentPage.drawText(`${index + 1}.`, {
          x: MARGIN,
          y: yPosition,
          size: 12,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        })
        
        const answerText = cleanLatex(question.answer_latex || 'No answer provided')
        drawText(answerText, MARGIN + 25, helvetica, 11, PAGE_WIDTH - 2 * MARGIN - 25)
        
        // Solution steps if available
        if (question.solution_steps_json && Array.isArray(question.solution_steps_json)) {
          yPosition -= 5
          currentPage.drawText('Solution:', {
            x: MARGIN + 25,
            y: yPosition,
            size: 9,
            font: helveticaBold,
            color: rgb(0.3, 0.5, 0.3),
          })
          yPosition -= 12
          
          question.solution_steps_json.forEach((step: string, stepIndex: number) => {
            drawText(`${stepIndex + 1}. ${step}`, MARGIN + 35, helvetica, 9, PAGE_WIDTH - 2 * MARGIN - 35)
          })
        }
        
        yPosition -= 20
      })
    }
    
    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()
    
    // Create record in database
    const { data: pdfExport, error: insertError } = await supabase
      .from('pdf_exports')
      .insert({
        workspace_id: workspaceId,
        assignment_id: assignmentId || null,
        title,
        question_ids: questionIds,
        include_answers: includeAnswers,
        status: 'completed',
      })
      .select()
      .single()
    
    if (insertError) {
      throw new Error(`Failed to create PDF record: ${insertError.message}`)
    }
    
    // In production, upload to R2 and store URL
    // For now, we'll store as base64 (not ideal for large PDFs)
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64')
    
    await completeJob(job.id, {
      success: true,
      pdfExportId: pdfExport?.id,
      questionCount: questions.length,
      pdfSize: pdfBytes.length,
      // In production: pdfUrl: uploadedUrl
      pdfBase64: pdfBase64.slice(0, 1000) + '...', // Truncate for job result
    })
  } catch (error) {
    console.error('Generate PDF failed:', error)
    await failJob(
      job.id,
      error instanceof Error ? error.message : 'Unknown error',
      true
    )
  }
}

// Helper to clean LaTeX for plain text display
function cleanLatex(latex: string): string {
  return latex
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\^(\d)/g, '^$1')
    .replace(/\^{([^}]+)}/g, '^($1)')
    .replace(/_(\d)/g, '₀₁₂₃₄₅₆₇₈₉'.split('')['$1'.charCodeAt(0) - 48] || '_$1')
    .replace(/_{([^}]+)}/g, '_($1)')
    .replace(/\\[a-zA-Z]+/g, '') // Remove remaining commands
    .replace(/[{}]/g, '')
    .trim()
}
