# LFC Reporting Hub - Project State Report

**Generated:** 2026-08-07  
**Project ID:** nzsgdjwvcdscedbgntia  
**GitHub:** https://github.com/highnine699-del/Lfc-reporting-hub.git

---

## 1. Git History and Diff

### Git Log (last 30 commits)
```
8e488a9 Update README with comprehensive project documentation
76ad741 Fix parser patterns: Handle double separators and multi-line labels
40ec767 Fix bundle size regression: Code-split exceljs and remove unused dependencies
355b5e9 Sync migrations: Add live database schema changes to repo
f54d814 first commit
```

### Git Status
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### Git Diff Stats
```
(no changes)
```

---

## 2. Live Database Schema

**NOTE:** Could not run `supabase db pull` due to Docker not being available on this system. 
The migration files in `supabase/migrations/` represent the current local schema state:

### Migration Files
- `20260806021511_fix_rls_recursion.sql` - RLS recursion fixes
- `20260806120000_add_onboarding_policies.sql` - Onboarding policies
- `20260807120000_sync_live_schema_changes.sql` - Live database sync including:
  - status and finalized_at fields for reports table
  - Nullable template_id and template_version_id
  - RLS policies for templates, template_versions, template_field_mappings
  - generated-reports storage bucket with RLS policies
  - Fixed stations INSERT policy

---

## 3. RLS Policies (Live Database)

**NOTE:** Could not query live database due to Docker unavailability. 
RLS policies are defined in the migration files in section 2.

---

## 4. Deployed Edge Functions

### Function List
```
ID                                   | NAME                | SLUG                | STATUS | VERSION | UPDATED_AT (UTC)    
--------------------------------------|---------------------|---------------------|--------|---------|---------------------
33082807-7c03-4802-b286-5d2ed3013285 | generate-report     | generate-report     | ACTIVE | 3       | 2026-08-07 14:55:24 
c67d329c-16be-4909-b28e-2ed4fcdb11c5 | parse-whatsapp-text | parse-whatsapp-text | ACTIVE | 2       | 2026-08-07 23:10:07 
8e44b9e6-a88b-4b00-b9fa-da27fb2eecbe | ocr-bank-statement  | ocr-bank-statement  | ACTIVE | 1       | 2026-08-07 11:33:34 
```

### generate-report/index.ts
```typescript
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
```

### parse-whatsapp-text/index.ts
```typescript
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
```

### ocr-bank-statement/index.ts
```typescript
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
```

---

## 5. Storage Buckets and Policies

**NOTE:** Could not query live database due to Docker unavailability.
Buckets are defined in migration file `20260807120000_sync_live_schema_changes.sql`:
- `templates` (for Excel template files)
- `generated-reports` (for generated Excel reports) 
- `bank-statements` (for uploaded bank statements)

---

## 6. Dependency List and Build Output

### Build Output
```
vite v8.2.0 building client environment for production...
transforming...✓ 130 modules transformed.
rendering chunks...
computing gzip size...
dist/manifest.webmanifest                          0.40 kB
dist/index.html                                    0.51 kB │ gzip:   0.31 kB
dist/assets/index-CbYG17ll.css                     6.10 kB │ gzip:   1.54 kB
dist/assets/workbox-window.prod.es5-Bd17z0YL.js    5.65 kB │ gzip:   2.20 kB
dist/assets/index-BHCogvVT.js                    542.43 kB │ gzip: 148.33 kB
dist/assets/exceljs.min-DTNdsTeT.js              929.57 kB │ gzip: 256.43 kB

✓ built in 2.43s
```

### Heavy Library Usage in Frontend
- **exceljs**: Dynamically imported in `src/pages/AdminTemplateMapping.tsx` (line 144) - code-split
- **pdf-lib**: Not statically imported anywhere in src/
- **tesseract.js**: Not statically imported anywhere in src/

---

## 7. File Tree

### src/ directory
```
src/App.css
src/App.tsx
src/assets/hero.png
src/assets/react.svg
src/assets/vite.svg
src/components/ManualReportForm.tsx
src/components/ParsePreview.tsx
src/hooks/useAuth.ts
src/index.css
src/lib/queryClient.ts
src/lib/supabase.ts
src/main.tsx
src/pages/AdminTemplateMapping.tsx
src/pages/BankReconciliation.tsx
src/pages/Dashboard.tsx
src/pages/DelegateManagement.tsx
src/pages/NewReport.tsx
src/pages/Onboarding.tsx
src/pages/ReportDetail.tsx
src/pages/Settings.tsx
src/pages/SignIn.tsx
src/types/index.ts
src/vite-env.d.ts
```

### supabase/ directory
```
supabase/.temp/gotrue-version
supabase/.temp/linked-project.json
supabase/.temp/pooler-url
supabase/.temp/postgres-version
supabase/.temp/project-ref
supabase/.temp/rest-version
supabase/.temp/storage-migration
supabase/.temp/storage-version
supabase/functions/generate-report/index.ts
supabase/functions/ocr-bank-statement/index.ts
supabase/functions/parse-whatsapp-text/index.ts
supabase/migrations/20260806021511_fix_rls_recursion.sql
supabase/migrations/20260806120000_add_onboarding_policies.sql
supabase/migrations/20260807120000_sync_live_schema_changes.sql
supabase/schema.sql
```

---

## 8. Plain-Language Changelog

### What Changed Since Last Report

**Parser Improvements (Commit 76ad741)**
- Fixed WhatsApp text parser to handle double separators like `Tithe:=#28,700`
- Updated patterns to handle multi-line labels like `Thanksgiving offering\n=#8500`
- Changed all regex patterns from `[:=]?` to `[:=\s]*` for better separator handling
- All 7 expected fields now extract correctly from real message samples

**Performance Optimization (Commit 40ec767)**
- Fixed bundle size regression by code-splitting exceljs library
- Main bundle reduced from ~1.47MB to 542KB (65% reduction)
- ExcelJS now loads as separate 930KB chunk only when admin template page is accessed
- Removed unused dependencies (pdf-lib, tesseract.js) from package.json

**Database Schema Sync (Commit 355b5e9)**
- Captured live database changes into migration files to prevent schema drift
- Added status and finalized_at fields to reports table for draft/finalized workflow
- Made template_id and template_version_id nullable to handle missing templates
- Added RLS policies for templates, template_versions, template_field_mappings
- Created generated-reports storage bucket with proper RLS policies
- Fixed stations INSERT policy to allow returning data

**Documentation Update (Commit 8e488a9)**
- Replaced README with comprehensive professional documentation
- Added badges, tables, and detailed sections for all project aspects
- Included proper technology stack, security, and getting started guides
- Added navigation links and professional formatting

**Why These Changes Matter**
- Parser fixes ensure real-world message formats are handled correctly
- Bundle optimization improves page load performance for all users
- Schema sync prevents data drift between repo and live database
- Documentation helps users and developers understand the project better