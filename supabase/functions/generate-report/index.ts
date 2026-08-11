import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ExcelJS from 'https://esm.sh/exceljs@4.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { service_entry_ids, template_version_id, period_label } = await req.json()

    if (!service_entry_ids?.length || !template_version_id) {
      return new Response(
        JSON.stringify({ error: 'service_entry_ids and template_version_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch template_columns for this version
    const { data: columns, error: colErr } = await supabase
      .from('template_columns')
      .select('field_key, col_index, sheet_name, data_row_start, aggregation_type, is_static, static_source, header_text')
      .eq('template_version_id', template_version_id)
      .order('col_index')

    if (colErr) throw colErr
    if (!columns?.length) {
      return new Response(
        JSON.stringify({ error: 'No columns found for this template version' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Fetch the template file path
    const { data: version, error: verErr } = await supabase
      .from('template_versions')
      .select('file_storage_path')
      .eq('id', template_version_id)
      .single()

    if (verErr) throw verErr
    if (!version?.file_storage_path) {
      return new Response(
        JSON.stringify({ error: 'No Excel file attached to this template version' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Fetch service entries
    const { data: entries, error: entErr } = await supabase
      .from('service_entries')
      .select('id, station_id, service_date, data')
      .in('id', service_entry_ids)
      .is('deleted_at', null)

    if (entErr) throw entErr

    // 4. Fetch station data for static columns
    const stationIds = [...new Set((entries ?? []).map((e: any) => e.station_id))]
    const { data: stations } = await supabase
      .from('stations')
      .select('id, name, state_name, category, facility_details, wofbi_class')
      .in('id', stationIds)

    const { data: pastors } = await supabase
      .from('users')
      .select('id, full_name, phone_number, yoe, dor, station_id')
      .in('station_id', stationIds)
      .eq('role', 'pastor')

    const stationMap = new Map((stations ?? []).map((s: any) => [s.id, s]))
    const pastorMap = new Map((pastors ?? []).map((p: any) => [p.station_id, p]))

    // 5. Group entries by station and aggregate
    const entriesByStation = new Map<string, any[]>()
    for (const e of entries ?? []) {
      if (!entriesByStation.has(e.station_id)) entriesByStation.set(e.station_id, [])
      entriesByStation.get(e.station_id)!.push(e)
    }

    function aggregate(values: number[], type: string): number {
      if (!values.length) return 0
      switch (type) {
        case 'sum': return values.reduce((a, b) => a + b, 0)
        case 'avg': return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        case 'max': return Math.max(...values)
        case 'latest': return values[values.length - 1]
        default: return values.reduce((a, b) => a + b, 0)
      }
    }

    function resolveStatic(source: string | null, station: any, pastor: any): string | number {
      if (!source) return ''
      const parts = source.split('.')
      if (parts[0] === 'station') {
        if (parts[1] === 'facility_details' && parts[2]) return station?.facility_details?.[parts[2]] ?? ''
        return station?.[parts[1]] ?? ''
      }
      if (parts[0] === 'user') return pastor?.[parts[1]] ?? ''
      return ''
    }

    // Build one compiled row per station
    const compiledRows: Array<{ station: any; pastor: any; data: Record<string, string | number> }> = []
    for (const [stationId, stationEntries] of entriesByStation.entries()) {
      const station = stationMap.get(stationId)
      const pastor = pastorMap.get(stationId) ?? null
      const row: Record<string, string | number> = {}

      for (const col of columns) {
        if (col.is_static) {
          row[col.field_key] = resolveStatic(col.static_source, station, pastor)
          continue
        }
        const sorted = [...stationEntries].sort((a, b) => a.service_date.localeCompare(b.service_date))
        const vals: number[] = sorted
          .map((e: any) => { const v = e.data[col.field_key]; return typeof v === 'number' ? v : parseFloat(v) })
          .filter((v: number) => !isNaN(v))
        row[col.field_key] = aggregate(vals, col.aggregation_type)
      }

      compiledRows.push({ station, pastor, data: row })
    }

    // 6. Download template file
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('templates')
      .download(version.file_storage_path)

    if (dlErr) throw dlErr

    // 7. Load workbook and fill in data
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await fileData.arrayBuffer())

    // Group columns by sheet
    const colsBySheet = new Map<string, typeof columns>()
    for (const col of columns) {
      if (!colsBySheet.has(col.sheet_name)) colsBySheet.set(col.sheet_name, [])
      colsBySheet.get(col.sheet_name)!.push(col)
    }

    for (const [sheetName, sheetCols] of colsBySheet.entries()) {
      const ws = workbook.getWorksheet(sheetName)
      if (!ws) continue

      const dataRowStart = sheetCols[0].data_row_start
      const sheetNameLower = sheetName.toLowerCase()

      const sheetRows = compiledRows.filter(({ station }) => {
        const cat = station?.category?.toLowerCase() ?? ''
        if (sheetNameLower.includes('mainline') && cat === 'mainline') return true
        if ((sheetNameLower.includes('cotm') || sheetNameLower.includes('5,000')) && cat === 'cotm') return true
        if ((sheetNameLower.includes('cpm') || sheetNameLower.includes('10,000')) && cat === 'cpm') return true
        const hasKeyword = ['mainline', 'cotm', 'cpm', '5,000', '10,000'].some(k => sheetNameLower.includes(k))
        return !hasKeyword
      })

      sheetRows.forEach(({ data }, rowIdx) => {
        const rowNum = dataRowStart + rowIdx
        for (const col of sheetCols) {
          const val = data[col.field_key]
          if (val !== undefined && val !== '') {
            ws.getCell(rowNum, col.col_index + 1).value = val
          }
        }
        const snCell = ws.getCell(rowNum, 1)
        if (!snCell.value) snCell.value = rowIdx + 1
      })

      // Write period label into header cells with "month:" pattern
      if (period_label) {
        ws.eachRow((row: any, rn: number) => {
          if (rn >= dataRowStart) return
          row.eachCell((cell: any) => {
            const v = cell.value?.toString() ?? ''
            if (/month\s*:/i.test(v)) {
              cell.value = v.replace(/month\s*:.*$/i, `MONTH: ${period_label.toUpperCase()}`)
            }
          })
        })
      }
    }

    // 8. Return the workbook as a base64 buffer
    const buffer = await workbook.xlsx.writeBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer as ArrayBuffer)))

    return new Response(
      JSON.stringify({ success: true, file_base64: base64, filename: `LFC_Report_${period_label ?? 'export'}.xlsx` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('generate-report error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
