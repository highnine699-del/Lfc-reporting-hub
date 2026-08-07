# LFC Reporting Hub

A Progressive Web App (PWA) designed to help pastors at Living Faith Church (Winners Chapel) stations manage their reporting requirements efficiently.

## Features

- **Multiple Input Methods**: Manual form entry, WhatsApp text parsing, voice input, and bank statement OCR
- **Automatic Report Generation**: Excel reports generated using official church templates
- **Version History**: Complete audit trail of all report changes
- **Delegate System**: Pairing codes for backup delegate accounts
- **Offline Support**: PWA with offline-first architecture
- **Auto-Compile**: Scheduled monthly report compilation
- **Bank Reconciliation**: OCR-based bank statement processing

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **PWA**: vite-plugin-pwa (Workbox)
- **State Management**: TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **OCR**: Tesseract.js
- **Excel Generation**: exceljs
- **Speech Recognition**: Web Speech API

## Setup Instructions

### Prerequisites

- Node.js 18+
- Supabase account
- Paystack account (for payments, optional)

### Environment Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

### Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `supabase/schema.sql` in the Supabase SQL editor
3. Create storage buckets:
   - `templates` (for Excel template files)
   - `generated-reports` (for generated Excel reports)
   - `bank-statements` (for uploaded bank statements)

### Edge Functions Deployment

Deploy the Edge Functions to Supabase:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link

# Deploy functions
supabase functions deploy generate-report
supabase functions deploy parse-whatsapp-text
supabase functions deploy ocr-bank-statement
```

### Local Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Application Architecture

### Database Schema

- **users**: User profiles with subscription status
- **stations**: Church station information
- **delegate_pairing_codes**: Temporary codes for delegate linking
- **templates**: Report template definitions
- **template_versions**: Version history of templates
- **template_field_mappings**: Excel cell to data field mappings
- **data_fields**: Canonical field registry
- **expenditure_categories**: User-defined expenditure categories
- **reports**: Logical report records
- **report_versions**: Versioned report data with audit trail
- **bank_statements**: Uploaded bank statements with OCR results
- **discrepancy_flags**: Bank reconciliation discrepancies

### Key Features Implementation

1. **Authentication**: Email magic link (primary) + Google OAuth (optional)
2. **Input Methods**:
   - Manual: Structured form with all canonical fields
   - WhatsApp: Flexible parser for various text formats
   - Voice: Web Speech API with preview confirmation
   - Bank: Tesseract.js OCR with reconciliation
3. **Report Generation**: Excel generation via Supabase Edge Function using exceljs
4. **Offline Support**: IndexedDB queue with TanStack Query persistence
5. **Auto-Compile**: pg_cron scheduled function for monthly aggregation

## Security

- Row-Level Security (RLS) enabled on all tables
- Users can only access their own station's data
- No hard deletes - all data is versioned
- Server timestamps for conflict resolution
- Confirm-before-save pattern for all parsed data

## Future Enhancements

- Multi-station aggregation dashboards
- Trend charts and analytics
- Receipt attachment for expenditures
- Automatic submission up the church hierarchy
- Finalized Paystack pricing integration

## License

This is an independent tool and not an official church initiative.

## Support

For issues or questions, please refer to the build document or contact the development team.
"# Lfc-reporting-hub" 
