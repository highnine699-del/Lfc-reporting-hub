import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------------------
// Separator helper — matches any combination of spaces, colons, equals signs,
// hyphens and Nigerian Naira hash prefix (#).
// e.g. ": ", "= ", ":=#", " - ", ":\n"
// ---------------------------------------------------------------------------
const SEP = '[\\s:=\\-#]+'

/**
 * Build a regex that looks for a label (possibly on its own line) followed by
 * an optional separator and a number.
 *
 * Examples handled:
 *   "Tithe: 28,700"
 *   "Tithe:=#28,700"
 *   "Tithe\n28,700"
 *   "Tithe - #28,700"
 */
function pat(label: string, isAmount = false): RegExp {
  const numPart = isAmount ? '([\\d,]+(?:\\.\\d{1,2})?)' : '(\\d+)'
  return new RegExp(`${label}[\\s\\S]{0,10}?${SEP}${numPart}`, 'i')
}

// ---------------------------------------------------------------------------
// Field patterns — each field has an array of regexes tried in order.
// ---------------------------------------------------------------------------
const fieldPatterns: Record<string, RegExp[]> = {
  // ── Attendance ────────────────────────────────────────────────────────────
  adults_male_attendance: [
    pat('adult[s]?\\s+male'),
    pat('adult\\s+(?:bro|men|gents)'),
    /(?:^|\n)\s*male\s*[:=\-#\s]+(\d+)/im,
    /(?:^|\n)\s*men\s*[:=\-#\s]+(\d+)/im,
  ],
  adults_female_attendance: [
    pat('adult[s]?\\s+female'),
    pat('adult\\s+(?:sis(?:ter)?s?|women|ladies)'),
    /(?:^|\n)\s*female\s*[:=\-#\s]+(\d+)/im,
    /(?:^|\n)\s*women\s*[:=\-#\s]+(\d+)/im,
  ],
  children_male_attendance: [
    pat('children[s]?\\s+male'),
    pat('child(?:ren)?\\s+(?:bro|boys|males?)'),
    pat('boys'),
    /(?:^|\n)\s*boys\s*[:=\-#\s]+(\d+)/im,
  ],
  children_female_attendance: [
    pat('children[s]?\\s+female'),
    pat('child(?:ren)?\\s+(?:sis|girls|females?)'),
    pat('girls'),
    /(?:^|\n)\s*girls\s*[:=\-#\s]+(\d+)/im,
  ],
  children_attendance: [
    pat('children\\s+(?:combined|total|attendance)'),
    /(?:^|\n)\s*children\s*[:=\-#\s]+(\d+)/im,
  ],
  first_timers: [
    pat('first.?timer[s]?'),
    // Common abbreviations: f/t, FT, 1stT
    /\bf[\/\\]t\s*[:=\-#\s]+(\d+)/i,
    /\bft\s*[:=\-#\s]+(\d+)/i,
    /1st\s*timer[s]?\s*[:=\-#\s]+(\d+)/i,
    pat('visitors?'),
  ],
  new_converts: [
    pat('new.?convert[s]?'),
    // Abbreviations: n/c, NC
    /\bn[\/\\]c\s*[:=\-#\s]+(\d+)/i,
    /\bnc\s*[:=\-#\s]+(\d+)/i,
    pat('salvations?'),
    pat('souls?\\s+won'),
  ],

  // ── Spiritual ─────────────────────────────────────────────────────────────
  testimonies: [
    pat('testimon(?:y|ies)'),
    // Abbreviation: test.
    /\btest\.\s*[:=\-#\s]+(\d+)/i,
  ],
  altar_calls: [
    pat('altar.?call[s]?'),
    /\ba[\/\\]c\s*[:=\-#\s]+(\d+)/i,
  ],
  wofbi_attendance: [
    pat('wofbi'),
    pat('word\\s+of\\s+faith\\s+bible\\s+inst(?:itute)?'),
  ],
  water_baptisms: [
    pat('water.?baptis(?:m|ms)'),
    pat('w[./]?b(?:apt)?'),
    /\bwb\s*[:=\-#\s]+(\d+)/i,
  ],
  holy_ghost_baptisms: [
    pat('holy.?ghost(?:\\s+baptis(?:m|ms))?'),
    pat('hgb'),
    pat('h[./]?g(?:\\s+bap)?'),
    /\bhgb\s*[:=\-#\s]+(\d+)/i,
    /\bh[\/\\]g\s*[:=\-#\s]+(\d+)/i,
  ],

  // ── Finance — Income ──────────────────────────────────────────────────────
  tithes: [
    pat('tithe[s]?', true),
    /\btthe\s*[:=\-#\s]+([\d,]+)/i, // common OCR misspelling
  ],
  offerings: [
    pat('offering[s]?', true),
    /\boff(?:g|ring)?\s*[:=\-#\s]+([\d,]+)/i,
  ],
  thanksgiving: [
    pat('thanks.?giving(?:\\s+offering)?', true),
    pat('special\\s+offering', true),
    /\btg\s*[:=\-#\s]+([\d,]+)/i,
    /\bt[\/\\]g\s*[:=\-#\s]+([\d,]+)/i,
  ],
  kcc: [
    pat('kcc', true),
    pat('kingdom\\s+covenant\\s+contribution[s]?', true),
  ],
  shiloh_sacrifice: [
    pat('shiloh\\s+sacrifice', true),
    pat('shiloh', true),
    /\bss\s*[:=\-#\s]+([\d,]+)/i,
    /\bs[\/\\]s\s*[:=\-#\s]+([\d,]+)/i,
  ],
  project_funds: [
    pat('project(?:\\s+fund[s]?)?', true),
    pat('building(?:\\s+fund[s]?)?', true),
    pat('dev(?:elopment)?(?:\\s+fund[s]?)?', true),
    /\bpf\s*[:=\-#\s]+([\d,]+)/i,
  ],
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

    // Normalise common Nigerian Naira symbol variants before matching
    const normalisedText = text
      .replace(/₦/g, '#')       // swap Naira sign to hash (our patterns use #)
      .replace(/\r\n/g, '\n')   // normalise line endings
      .replace(/\t/g, ' ')      // tabs → spaces

    const extractedData: Record<string, number> = {}

    for (const [field, patterns] of Object.entries(fieldPatterns)) {
      for (const pattern of patterns) {
        const match = normalisedText.match(pattern)
        if (match?.[1]) {
          const value = parseFloat(match[1].replace(/,/g, ''))
          if (!isNaN(value)) {
            extractedData[field] = value
            break
          }
        }
      }
    }

    // Grand total
    const grandTotalMatch = normalisedText.match(
      /grand.?total\s*[:=\-#\s]+([\d,]+(?:\.\d{1,2})?)/i
    )
    if (grandTotalMatch?.[1]) {
      extractedData['total'] = parseFloat(grandTotalMatch[1].replace(/,/g, ''))
    }

    // Attendance total — only use if not already extracted a more specific field
    const attendanceTotalMatch = normalisedText.match(
      /(?:total\s+attendance|attendance\s+total|total)\s*[:=\-#\s]+(\d+)/i
    )
    if (attendanceTotalMatch?.[1]) {
      extractedData['total_attendance'] = parseFloat(attendanceTotalMatch[1])
    }

    const fieldCount = Object.keys(extractedData).length
    const confidence =
      fieldCount >= 5 ? 'high' :
        fieldCount >= 2 ? 'medium' : 'low'

    return new Response(
      JSON.stringify({ success: true, data: extractedData, confidence }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error parsing WhatsApp text:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
