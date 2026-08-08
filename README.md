<div align="center">

# LFC Reporting Hub

### Reporting infrastructure built for station-level workflows.

**Collect data. Reconcile records. Generate reports. Preserve history.**

<p>
  <img src="https://img.shields.io/badge/STATUS-ACTIVE-16A34A?style=flat-square" alt="Status: Active">
  <img src="https://img.shields.io/badge/REACT-TYPESCRIPT-3178C6?style=flat-square&logo=react&logoColor=white" alt="React + TypeScript">
  <img src="https://img.shields.io/badge/PWA-OFFLINE_FIRST-6D28D9?style=flat-square" alt="Offline-first PWA">
  <img src="https://img.shields.io/badge/SUPABASE-POSTGRESQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase">
</p>

<p>
  <a href="#overview">Overview</a> ·
  <a href="#capabilities">Capabilities</a> ·
  <a href="#technology">Technology</a> ·
  <a href="#security">Security</a> ·
  <a href="#getting-started">Getting Started</a>
</p>

</div>

---

## Overview

**LFC Reporting Hub** is a Progressive Web App (PWA) designed to help pastors at Living Faith Church (Winners Chapel) stations manage reporting requirements efficiently.

The platform brings multiple reporting workflows into one system: structured manual entry, WhatsApp text parsing, voice input, bank statement OCR, reconciliation, Excel report generation, version history, delegate pairing, offline persistence, and scheduled monthly compilation.

> **One reporting workflow, from data capture to generated report.**

---

## Capabilities

<table>
<tr>
<td width="50%" valign="top">

### Data Capture

**Manual Entry**  
Structured forms built around canonical reporting fields.

**WhatsApp Parsing**  
Flexible parsing of reporting information supplied through WhatsApp text.

**Voice Input**  
Speech recognition with a preview-and-confirm workflow before data is saved.

**Bank Statement OCR**  
Process uploaded bank statements with Tesseract.js.

</td>
<td width="50%" valign="top">

### Reporting Operations

**Excel Generation**  
Generate reports from configured templates using ExcelJS.

**Bank Reconciliation**  
Process statement data and surface discrepancy flags.

**Version History**  
Keep report versions and an audit trail instead of hard-deleting data.

**Delegate Support**  
Use temporary pairing codes to connect backup delegate accounts.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Reliability

**Offline-First PWA**  
Designed around offline-capable application workflows.

**IndexedDB Persistence**  
Queue and persist application data locally.

**TanStack Query Persistence**  
Support continued work across connectivity interruptions.

</td>
<td width="50%" valign="top">

### Automation

**Monthly Auto-Compile**  
Scheduled compilation through a database-side function.

**Edge Functions**  
Server-side processing for report generation, WhatsApp parsing, and bank-statement OCR.

</td>
</tr>
</table>

---

## Why It Matters

Recurring reporting often means collecting information from different sources, checking it, reconciling financial records, and turning the result into a standardized report.

LFC Reporting Hub is structured around that workflow.

### Capture

Bring reporting data into the system through the input method available at the station.

### Validate

Review parsed information before it becomes part of the report.

### Reconcile

Process bank statements and identify potential discrepancies.

### Generate

Transform structured data into Excel reports using configured templates.

### Preserve

Maintain versions and history instead of treating each report as a disposable file.

---

## Technology

<table>
<tr>
<th>Layer</th>
<th>Technology</th>
</tr>
<tr>
<td><strong>Frontend</strong></td>
<td>React · TypeScript · Vite</td>
</tr>
<tr>
<td><strong>UI</strong></td>
<td>Tailwind CSS</td>
</tr>
<tr>
<td><strong>PWA</strong></td>
<td>vite-plugin-pwa · Workbox</td>
</tr>
<tr>
<td><strong>State</strong></td>
<td>TanStack Query</td>
</tr>
<tr>
<td><strong>Backend</strong></td>
<td>Supabase · PostgreSQL · Auth · Storage · Edge Functions</td>
</tr>
<tr>
<td><strong>OCR</strong></td>
<td>Tesseract.js</td>
</tr>
<tr>
<td><strong>Excel</strong></td>
<td>ExcelJS</td>
</tr>
<tr>
<td><strong>Speech</strong></td>
<td>Web Speech API</td>
</tr>
<tr>
<td><strong>Offline Persistence</strong></td>
<td>IndexedDB</td>
</tr>
<tr>
<td><strong>Scheduling</strong></td>
<td>pg_cron</td>
</tr>
</table>

---

## Application Architecture

The application is organized around a small set of core reporting concepts:

| Domain | Purpose |
|---|---|
| `users` | User profiles and subscription status |
| `stations` | Church station information |
| `delegate_pairing_codes` | Temporary delegate-linking codes |
| `templates` | Report template definitions |
| `template_versions` | Template version history |
| `template_field_mappings` | Excel cell → data field mappings |
| `data_fields` | Canonical field registry |
| `expenditure_categories` | User-defined expenditure categories |
| `reports` | Logical report records |
| `report_versions` | Versioned report data and audit trail |
| `bank_statements` | Uploaded statements and OCR results |
| `discrepancy_flags` | Bank reconciliation discrepancies |

### Processing Layer

The application currently separates several specialized workflows into Edge Functions:

- `generate-report` 
- `parse-whatsapp-text` 
- `ocr-bank-statement` 

This keeps report generation and data-processing operations separate from the client application.

---

## Security

Security is part of the application's data model rather than an afterthought.

| Control | Implementation |
|---|---|
| **Database isolation** | Row-Level Security (RLS) |
| **Station access** | Users can access only their authorized station data |
| **Data history** | Reports are versioned rather than hard-deleted |
| **Conflict handling** | Server timestamps |
| **Parsed input** | Confirm-before-save workflow |
| **Authentication** | Email magic link + optional Google OAuth |

---

## Offline-First Design

The PWA architecture is designed to support reporting workflows when connectivity is unreliable.

The application uses:

- `vite-plugin-pwa` 
- Workbox
- IndexedDB
- TanStack Query persistence
- Queued offline data

This allows the application to retain a local working state and synchronize queued work when connectivity becomes available.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Paystack account *(optional, for payments)*

### Install

```bash
npm install
```

### Environment

Create a `.env` file based on `.env.example`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

### Database

Create a Supabase project and run:

```text
supabase/schema.sql
```

Then create these storage buckets:

```text
templates
generated-reports
bank-statements
```

### Edge Functions

Install the Supabase CLI:

```bash
npm install -g supabase
```

Link the project:

```bash
supabase link
```

Deploy the processing functions:

```bash
supabase functions deploy generate-report
supabase functions deploy parse-whatsapp-text
supabase functions deploy ocr-bank-statement
```

### Development

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## Development Commands

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |

---

## Roadmap

### Current Capabilities

- [x] Manual reporting
- [x] WhatsApp text parsing
- [x] Voice input
- [x] Bank statement OCR
- [x] Bank reconciliation workflow
- [x] Excel report generation
- [x] Report version history
- [x] Delegate pairing
- [x] PWA foundation
- [x] Offline-first persistence
- [x] Scheduled monthly compilation

### Planned Enhancements

- [ ] Multi-station aggregation dashboards
- [ ] Trend charts and analytics
- [ ] Receipt attachments for expenditures
- [ ] Automatic submission up the church hierarchy
- [ ] Finalized Paystack pricing integration

---

## Project Status

The repository contains the application's reporting workflows, data model, PWA infrastructure, reconciliation tooling, security model, and Supabase deployment configuration.

The roadmap separates documented current capabilities from planned enhancements.

---

## Important Notice

> **LFC Reporting Hub is an independent software project and is not an official Living Faith Church / Winners Chapel initiative.**

This project should not be interpreted as an official church product, endorsement, or communication channel.

---

## Support

For issues, questions, or development feedback, refer to the project's build documentation or contact the development team.

---

<div align="center">

## LFC Reporting Hub

**Structured reporting. Better traceability. Less repetitive work.**

<br>

<sub>Independent software project · Built for reporting workflows</sub>

</div>