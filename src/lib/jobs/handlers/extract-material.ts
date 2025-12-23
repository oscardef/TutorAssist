import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import { completeJob, failJob } from '../queue'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ExtractMaterialPayload {
  materialId: string
  fileUrl: string
  fileType: string
}

interface ExtractedContent {
  topics: string[]
  concepts: string[]
  keyTerms: string[]
  equations: string[]
  summary: string
}

export async function handleExtractMaterial(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as ExtractMaterialPayload
  const { materialId, fileUrl, fileType } = payload
  
  try {
    const supabase = await createAdminClient()
    
    // Update material status
    await supabase
      .from('source_materials')
      .update({ status: 'processing' })
      .eq('id', materialId)
    
    // For now, we'll use text extraction
    // In production, you'd use OCR for PDFs/images
    let extractedText = ''
    
    if (fileType === 'application/pdf') {
      // For MVP, we'll note that PDF extraction would need pdf-parse
      // In a real scenario, you'd extract text from the PDF
      extractedText = `[PDF content from ${fileUrl}]`
    } else if (fileType.startsWith('image/')) {
      // Use GPT-4 Vision for image extraction
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all mathematical content, equations, problems, and text from this image. Format equations in LaTeX.',
              },
              {
                type: 'image_url',
                image_url: { url: fileUrl },
              },
            ],
          },
        ],
        max_tokens: 4000,
      })
      
      extractedText = response.choices[0].message.content || ''
    } else {
      // Fetch and process text file
      const response = await fetch(fileUrl)
      extractedText = await response.text()
    }
    
    // Use GPT to analyze and structure the content
    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a math curriculum analyzer. Extract and categorize mathematical content from the provided text.
          
Output JSON with this structure:
{
  "topics": ["list of main topics covered"],
  "concepts": ["list of specific concepts taught"],
  "keyTerms": ["important mathematical terms"],
  "equations": ["key equations in LaTeX format"],
  "summary": "brief summary of the content"
}`,
        },
        {
          role: 'user',
          content: extractedText,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    })
    
    const analysis: ExtractedContent = JSON.parse(
      analysisResponse.choices[0].message.content || '{}'
    )
    
    // Update the material with extracted content
    await supabase
      .from('source_materials')
      .update({
        status: 'ready',
        extracted_text: extractedText,
        topics_json: analysis.topics,
      })
      .eq('id', materialId)
    
    await completeJob(job.id, {
      success: true,
      analysis,
      extractedLength: extractedText.length,
    })
  } catch (error) {
    console.error('Extract material failed:', error)
    
    // Update material status to failed
    const supabase = await createAdminClient()
    await supabase
      .from('source_materials')
      .update({ status: 'failed' })
      .eq('id', materialId)
    
    await failJob(
      job.id,
      error instanceof Error ? error.message : 'Unknown error',
      true
    )
  }
}
