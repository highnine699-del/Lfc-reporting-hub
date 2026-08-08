import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Tesseract from 'https://esm.sh/tesseract.js@5.0.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_path, station_id } = await req.json()

    if (!file_path || !station_id) {
      return new Response(
        JSON.stringify({ error: 'file_path and station_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Download the file from Supabase Storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('bank-statements')
      .download(file_path)

    if (fileError) throw fileError

    // Convert to buffer for Tesseract
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Perform OCR
    const { data: { text } } = await Tesseract.recognize(
      buffer,
      'eng',
      {
        logger: (m: any) => console.log(m),
      }
    )

    // Extract potential total values from the OCR text
    // Look for patterns like "total", "balance", "amount" followed by numbers
    const totalPatterns = [
      /total\s*:?\s*#?([\d,]+\.?\d*)/gi,
      /balance\s*:?\s*#?([\d,]+\.?\d*)/gi,
      /amount\s*:?\s*#?([\d,]+\.?\d*)/gi,
      /sum\s*:?\s*#?([\d,]+\.?\d*)/gi,
      /#?([\d,]+\.?\d*)\s*(?=total|balance|amount)/gi,
    ]

    const candidates: number[] = []
    const matches = new Set<string>()

    for (const pattern of totalPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const value = match[1].replace(/,/g, '')
        const numValue = parseFloat(value)
        if (!isNaN(numValue) && numValue > 0) {
          matches.add(match[0])
          candidates.push(numValue)
        }
      }
    }

    // Remove duplicates and sort
    const uniqueCandidates = [...new Set(candidates)].sort((a, b) => b - a)

    // Store the OCR result
    const { error: insertError } = await supabase
      .from('bank_statements')
      .insert({
        station_id,
        file_storage_path: file_path,
        ocr_raw_text: text,
        parsed_total: uniqueCandidates.length > 0 ? uniqueCandidates[0] : null,
      })

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ 
        success: true, 
        ocr_text: text,
        total_candidates: uniqueCandidates,
        confidence: uniqueCandidates.length > 0 ? 'medium' : 'low',
        matches: Array.from(matches),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing bank statement:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
