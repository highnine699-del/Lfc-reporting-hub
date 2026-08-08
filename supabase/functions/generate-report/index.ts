import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ExcelJS from 'https://esm.sh/exceljs@4.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { report_version_id } = await req.json()

    if (!report_version_id) {
      return new Response(
        JSON.stringify({ error: 'report_version_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch report version with template field mappings
    const { data: reportVersion, error: versionError } = await supabase
      .from('report_versions')
      .select(`
        *,
        reports (
          station_id,
          templates (
            id,
            name,
            current_version_id,
            template_versions (
              id,
              file_storage_path,
              template_field_mappings (
                cell_reference,
                data_field_key
              )
            )
          )
        )
      `)
      .eq('id', report_version_id)
      .single()

    if (versionError) throw versionError

    const template = reportVersion.reports?.templates;
    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Report has no template associated with it' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const templateVersion = template.template_versions?.[0];
    if (!templateVersion) {
      return new Response(
        JSON.stringify({ error: 'Template has no versions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!templateVersion.file_storage_path) {
      return new Response(
        JSON.stringify({ error: 'Template version has no file storage path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const fieldMappings = templateVersion.template_field_mappings || [];

    // Download the template file from Supabase Storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('templates')
      .download(templateVersion.file_storage_path)

    if (fileError) {
      console.error('Error downloading template file:', fileError);
      return new Response(
        JSON.stringify({ error: 'Failed to download template file', details: fileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load the Excel workbook
    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = await fileData.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)

    // Fill in the data according to field mappings
    fieldMappings.forEach((mapping: any) => {
      const value = reportVersion.data[mapping.data_field_key]
      if (value !== undefined && value !== null) {
        const worksheet = workbook.getWorksheet(mapping.sheet_name)
        if (worksheet) {
          const cell = worksheet.getCell(mapping.cell_reference)
          cell.value = value
        }
      }
    })

    // Generate the output file
    const buffer = await workbook.xlsx.writeBuffer()

    // Upload the generated file to Supabase Storage
    const fileName = `report_${reportVersion.id}.xlsx`
    const { error: uploadError } = await supabase
      .storage
      .from('generated-reports')
      .upload(fileName, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading generated file:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload generated file', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the report version with the generated file path
    const { error: updateError } = await supabase
      .from('report_versions')
      .update({ generated_file_path: fileName })
      .eq('id', report_version_id)

    if (updateError) {
      console.error('Error updating report version:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update report version', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get a signed URL for the generated file (expires in 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('generated-reports')
      .createSignedUrl(fileName, 60 * 60) // 1 hour expiry

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to create download URL', details: signedUrlError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileUrl: signedUrlData.signedUrl,
        fileName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating report:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
