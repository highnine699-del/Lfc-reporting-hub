import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Field mapping patterns based on the specification
const fieldPatterns = {
  // Attendance
  'adults_male_attendance': [/male\s*[:=\s]*(\d+)/i, /adult.*male\s*[:=\s]*(\d+)/i],
  'adults_female_attendance': [/female\s*[:=\s]*(\d+)/i, /adult.*female\s*[:=\s]*(\d+)/i],
  'children_male_attendance': [/children.*male\s*[:=\s]*(\d+)/i, /boys\s*[:=\s]*(\d+)/i],
  'children_female_attendance': [/children.*female\s*[:=\s]*(\d+)/i, /girls\s*[:=\s]*(\d+)/i],
  'children_attendance': [/children\s*[:=\s]*(\d+)/i],
  'first_timers': [/first.?timer\s*[:=\s]*(\d+)/i, /f\/t\s*[:=\s]*(\d+)/i],
  'new_converts': [/new.?convert\s*[:=\s]*(\d+)/i],
  
  // Spiritual
  'testimonies': [/testimon(?:y|ies)\s*[:=\s]*(\d+)/i],
  'altar_calls': [/altar.?call\s*[:=\s]*(\d+)/i],
  'wofbi_attendance': [/wofbi\s*[:=\s]*(\d+)/i],
  'water_baptisms': [/water.?baptis(?:m|ms)\s*[:=\s]*(\d+)/i],
  'holy_ghost_baptisms': [/holy.?ghost\s*[:=\s]*(\d+)/i],
  
  // Finance
  'tithes': [/tithe\s*[:=\s]*#?([\d,]+)/i],
  'offerings': [/offering\s*[:=\s]*#?([\d,]+)/i],
  'thanksgiving': [/thanksgiving(?:\s+offering)?\s*[:=\s]*#?([\d,]+)/i],
  'kcc': [/kcc\s*[:=\s]*#?([\d,]+)/i],
  'shiloh_sacrifice': [/shiloh\s*sacrifice\s*[:=\s]*#?([\d,]+)/i],
  'project_funds': [/project\s*[:=\s]*#?([\d,]+)/i],
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const extractedData: Record<string, any> = {}

    // Extract values using patterns
    for (const [field, patterns] of Object.entries(fieldPatterns)) {
      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) {
          const value = match[1].replace(/,/g, '')
          extractedData[field] = parseFloat(value)
          break // Use first match found
        }
      }
    }

    // Try to extract totals and calculate individual components if needed
    const totalMatch = text.match(/grand.?total\s*[:=\s]*#?([\d,]+)/i)
    if (totalMatch) {
      extractedData['total'] = parseFloat(totalMatch[1].replace(/,/g, ''))
    }

    // Try to extract attendance totals
    const attendanceTotalMatch = text.match(/total\s*[:=\s]*(\d+)/i)
    if (attendanceTotalMatch) {
      extractedData['total_attendance'] = parseFloat(attendanceTotalMatch[1])
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        confidence: Object.keys(extractedData).length > 0 ? 'high' : 'low'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error parsing WhatsApp text:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
