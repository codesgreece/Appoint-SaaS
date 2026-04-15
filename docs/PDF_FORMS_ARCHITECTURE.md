# PDF Dynamic Forms Architecture

## Phase 1 - Existing Stack Fit

- Frontend: React + TypeScript + route-level pages under `src/pages`.
- Data access: Supabase client APIs in `src/services`.
- Multi-tenant model: `business_id` + strict RLS via `get_user_business_id()`.
- Storage model: private buckets with first folder segment = tenant business id.

## Phase 2 - Schema and Design Choices

### Why `form_template_fields` table instead of one JSON blob

- Chosen: dedicated `form_template_fields` table (one row per field).
- Pros:
  - Better indexing, filtering, and diagnostics at scale.
  - Safer partial updates and less write contention.
  - Easier audit/version snapshots and future analytics.
- Tradeoff:
  - Slightly more joins than a single JSON column.

### Core entities

- `uploaded_pdf_files`: stores source PDF metadata and storage path.
- `form_templates`: reusable template metadata, category, publish status, version.
- `form_template_fields`: normalized overlay field definitions and positioning.
- `form_submissions`: submission header and relation to customer/job/work order.
- `form_submission_values`: submission values separate from template schema.
- `form_template_versions`: immutable snapshots for template versioning.
- `form_template_audit_logs`: audit stream for template lifecycle actions.

## Backend Layer (App-side API module)

- `src/services/formTemplates.ts`:
  - PDF upload + signed URL generation.
  - Template CRUD, duplication, publishing, categories.
  - Field replacement/upsert workflow.
  - Version snapshots and audit logs.
  - Submission draft/finalize flows.
  - Export-file persistence to storage.
  - Autofill context resolution.

## Frontend Reusable Modules

- `PdfDocumentViewer`: renders multipage PDF previews (pdfjs) and supports overlay click points.
- `FormTemplateBuilder`: visual field placement + drag/resize + settings panel.
- `FormRenderer`: reusable fill renderer on top of PDF with conditional visibility support.
- `SignaturePad`: canvas signature capture with data URL storage.

## PDF Export

- `src/lib/pdfFormExport.ts`:
  - Loads original PDF bytes.
  - Renders submission values to normalized field coordinates.
  - Embeds signatures into final PDF.
  - Exports downloadable PDF and stores export path in submissions.

## Routes Added

- `/forms` - templates list + upload/create.
- `/forms/templates/:templateId/builder` - visual builder/editor.
- `/forms/templates/:templateId/fill` - create/fill submission from template.
- `/forms/submissions/:submissionId` - reopen draft/history submission.

## Extensibility Path

- Add new field types by extending:
  - `FormFieldType` union and migration enum.
  - builder toolbox.
  - renderer switch branch.
  - PDF exporter branch.
- Keep backward compatibility via `schema_version` and snapshots.
