import { supabase } from "@/lib/supabase"
import type {
  FormAutofillContext,
  FormSubmission,
  FormSubmissionStatus,
  FormSubmissionValueMap,
  FormTemplate,
  FormTemplateField,
  FormTemplateStatus,
  FormTemplateWithRelations,
  FormTemplateVersion,
  UploadedPdfFile,
} from "@/types"

const FORM_DOCUMENT_BUCKET = "form_documents"

export async function uploadTemplatePdfFile(params: {
  businessId: string
  userId: string
  file: File
  pageCount?: number
}): Promise<UploadedPdfFile> {
  const extension = params.file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "bin"
  const path = `${params.businessId}/uploaded-pdfs/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from(FORM_DOCUMENT_BUCKET).upload(path, params.file, {
    contentType: "application/pdf",
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from("uploaded_pdf_files")
    .insert({
      business_id: params.businessId,
      uploaded_by: params.userId,
      file_name: params.file.name,
      file_path: path,
      file_size: params.file.size,
      mime_type: "application/pdf",
      page_count: params.pageCount ?? null,
    })
    .select("*")
    .single()
  if (error) throw error
  return data as UploadedPdfFile
}

export async function listUploadedPdfFiles(businessId: string): Promise<UploadedPdfFile[]> {
  const { data, error } = await supabase
    .from("uploaded_pdf_files")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as UploadedPdfFile[]
}

export async function createSignedDocumentUrl(filePath: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage.from(FORM_DOCUMENT_BUCKET).createSignedUrl(filePath, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function createFormTemplate(payload: {
  businessId: string
  userId: string
  pdfFileId: string
  name: string
  description?: string | null
  category?: string | null
  status?: FormTemplateStatus
}): Promise<FormTemplate> {
  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      business_id: payload.businessId,
      pdf_file_id: payload.pdfFileId,
      name: payload.name,
      description: payload.description ?? null,
      category: payload.category ?? null,
      status: payload.status ?? "draft",
      created_by: payload.userId,
      updated_by: payload.userId,
      published_at: payload.status === "published" ? new Date().toISOString() : null,
    })
    .select("*")
    .single()
  if (error) throw error

  await createTemplateAuditLog(payload.businessId, (data as FormTemplate).id, payload.userId, "template_created", {
    name: payload.name,
    category: payload.category ?? null,
    status: payload.status ?? "draft",
  })
  return data as FormTemplate
}

export async function listFormTemplates(params: {
  businessId: string
  status?: FormTemplateStatus | "all"
  category?: string
  search?: string
}): Promise<Array<FormTemplate & { pdf_file: UploadedPdfFile | null }>> {
  let query = supabase
    .from("form_templates")
    .select("*, pdf_file:uploaded_pdf_files(*)")
    .eq("business_id", params.businessId)
    .order("updated_at", { ascending: false })
  if (params.status && params.status !== "all") query = query.eq("status", params.status)
  if (params.category && params.category.trim()) query = query.eq("category", params.category.trim())
  if (params.search && params.search.trim()) query = query.ilike("name", `%${params.search.trim()}%`)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Array<FormTemplate & { pdf_file: UploadedPdfFile | null }>
}

export async function listFormTemplateCategories(businessId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("form_templates")
    .select("category")
    .eq("business_id", businessId)
    .not("category", "is", null)
  if (error) throw error
  const unique = Array.from(
    new Set(
      ((data ?? []) as Array<{ category: string | null }>)
        .map((r) => r.category?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  )
  return unique.sort((a, b) => a.localeCompare(b))
}

export async function fetchFormTemplateById(templateId: string): Promise<FormTemplateWithRelations | null> {
  const { data, error } = await supabase
    .from("form_templates")
    .select("*, pdf_file:uploaded_pdf_files(*), fields:form_template_fields(*)")
    .eq("id", templateId)
    .maybeSingle()
  if (error || !data) return null

  const typed = data as FormTemplateWithRelations
  typed.fields = [...(typed.fields ?? [])].sort((a, b) => {
    if (a.page_number !== b.page_number) return a.page_number - b.page_number
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at.localeCompare(b.created_at)
  })
  return typed
}

export async function updateFormTemplateMeta(params: {
  templateId: string
  userId: string
  name?: string
  description?: string | null
  category?: string | null
  status?: FormTemplateStatus
}): Promise<FormTemplate> {
  const patch: Record<string, unknown> = { updated_by: params.userId }
  if (params.name !== undefined) patch.name = params.name
  if (params.description !== undefined) patch.description = params.description
  if (params.category !== undefined) patch.category = params.category
  if (params.status !== undefined) {
    patch.status = params.status
    patch.published_at = params.status === "published" ? new Date().toISOString() : null
  }

  const { data, error } = await supabase.from("form_templates").update(patch).eq("id", params.templateId).select("*").single()
  if (error) throw error
  return data as FormTemplate
}

export async function duplicateFormTemplate(params: {
  sourceTemplateId: string
  businessId: string
  userId: string
  name?: string
}): Promise<FormTemplate> {
  const source = await fetchFormTemplateById(params.sourceTemplateId)
  if (!source) throw new Error("Source template not found.")

  const duplicated = await createFormTemplate({
    businessId: params.businessId,
    userId: params.userId,
    pdfFileId: source.pdf_file_id,
    name: params.name?.trim() || `${source.name} (Copy)`,
    description: source.description,
    category: source.category,
    status: "draft",
  })

  await replaceTemplateFields({
    templateId: duplicated.id,
    businessId: params.businessId,
    fields: source.fields.map((f) => ({
      field_key: `${f.field_key}_copy_${Math.random().toString(16).slice(2, 6)}`,
      name: f.name,
      label: f.label,
      type: f.type,
      page_number: f.page_number,
      position_x: f.position_x,
      position_y: f.position_y,
      width: f.width,
      height: f.height,
      sort_order: f.sort_order,
      required: f.required,
      placeholder: f.placeholder,
      default_value: f.default_value,
      help_text: f.help_text,
      validation_rules: f.validation_rules,
      options: f.options,
      readonly: f.readonly,
      hidden: f.hidden,
      conditional_visibility: f.conditional_visibility,
      style: f.style,
      autofill_key: f.autofill_key,
      config: f.config,
    })),
  })

  await createTemplateAuditLog(params.businessId, duplicated.id, params.userId, "template_duplicated", {
    from_template_id: source.id,
  })
  return duplicated
}

export interface UpsertTemplateFieldInput {
  id?: string
  field_key: string
  name: string
  label: string
  type: FormTemplateField["type"]
  page_number: number
  position_x: number
  position_y: number
  width: number
  height: number
  sort_order: number
  required: boolean
  placeholder?: string | null
  default_value?: unknown
  help_text?: string | null
  validation_rules?: FormTemplateField["validation_rules"]
  options?: FormTemplateField["options"]
  readonly: boolean
  hidden: boolean
  conditional_visibility?: FormTemplateField["conditional_visibility"]
  style?: FormTemplateField["style"]
  autofill_key?: string | null
  config?: FormTemplateField["config"]
}

export async function replaceTemplateFields(params: {
  templateId: string
  businessId: string
  fields: UpsertTemplateFieldInput[]
}): Promise<FormTemplateField[]> {
  const normalized = params.fields.map((f, index) => ({
    id: f.id,
    business_id: params.businessId,
    template_id: params.templateId,
    field_key: f.field_key,
    name: f.name,
    label: f.label,
    type: f.type,
    page_number: f.page_number,
    position_x: f.position_x,
    position_y: f.position_y,
    width: f.width,
    height: f.height,
    sort_order: f.sort_order ?? index,
    required: Boolean(f.required),
    placeholder: f.placeholder ?? null,
    default_value: f.default_value ?? null,
    help_text: f.help_text ?? null,
    validation_rules: f.validation_rules ?? null,
    options: f.options ?? null,
    readonly: Boolean(f.readonly),
    hidden: Boolean(f.hidden),
    conditional_visibility: f.conditional_visibility ?? null,
    style: f.style ?? null,
    autofill_key: f.autofill_key ?? null,
    config: f.config ?? null,
  }))

  const keepIds = normalized.map((f) => f.id).filter((v): v is string => Boolean(v))
  let deleteQuery = supabase.from("form_template_fields").delete().eq("template_id", params.templateId)
  if (keepIds.length > 0) deleteQuery = deleteQuery.not("id", "in", `(${keepIds.map((id) => `'${id}'`).join(",")})`)
  const { error: deleteError } = await deleteQuery
  if (deleteError) throw deleteError

  if (normalized.length === 0) return []
  const { data, error } = await supabase.from("form_template_fields").upsert(normalized).select("*")
  if (error) throw error
  return (data ?? []) as FormTemplateField[]
}

export async function createTemplateVersionSnapshot(params: {
  templateId: string
  businessId: string
  userId: string
}): Promise<FormTemplateVersion> {
  const template = await fetchFormTemplateById(params.templateId)
  if (!template) throw new Error("Template not found.")

  const nextVersion = Math.max(template.version + 1, 1)
  const snapshot = {
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      status: template.status,
      schema_version: template.schema_version,
      pdf_file_id: template.pdf_file_id,
    },
    fields: template.fields,
    captured_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("form_template_versions")
    .insert({
      business_id: params.businessId,
      template_id: params.templateId,
      version_number: nextVersion,
      snapshot,
      created_by: params.userId,
    })
    .select("*")
    .single()
  if (error) throw error

  const { error: updateError } = await supabase
    .from("form_templates")
    .update({ version: nextVersion, updated_by: params.userId })
    .eq("id", params.templateId)
  if (updateError) throw updateError

  await createTemplateAuditLog(params.businessId, params.templateId, params.userId, "template_version_created", {
    version_number: nextVersion,
  })
  return data as FormTemplateVersion
}

export async function listTemplateVersions(templateId: string): Promise<FormTemplateVersion[]> {
  const { data, error } = await supabase
    .from("form_template_versions")
    .select("*")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
  if (error) throw error
  return (data ?? []) as FormTemplateVersion[]
}

export async function listTemplateAuditLogs(templateId: string, limit = 50) {
  const { data, error } = await supabase
    .from("form_template_audit_logs")
    .select("*")
    .eq("template_id", templateId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function createFormSubmission(params: {
  businessId: string
  templateId: string
  userId: string
  title?: string | null
  customerId?: string | null
  appointmentJobId?: string | null
  workOrderRef?: string | null
  metadata?: Record<string, unknown>
  values?: FormSubmissionValueMap
}): Promise<FormSubmission> {
  const template = await fetchFormTemplateById(params.templateId)
  if (!template) throw new Error("Template not found.")

  const { data, error } = await supabase
    .from("form_submissions")
    .insert({
      business_id: params.businessId,
      template_id: params.templateId,
      template_version: template.version,
      status: "draft",
      title: params.title ?? null,
      customer_id: params.customerId ?? null,
      appointment_job_id: params.appointmentJobId ?? null,
      work_order_ref: params.workOrderRef ?? null,
      submitted_by: params.userId,
      metadata: params.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw error

  const created = data as FormSubmission
  if (params.values) await upsertSubmissionValues(created.id, params.businessId, params.values, template.fields)
  return created
}

export async function fetchSubmissionById(submissionId: string): Promise<{
  submission: FormSubmission
  template: FormTemplateWithRelations
  values: FormSubmissionValueMap
} | null> {
  const { data: submission, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle()
  if (error || !submission) return null

  const template = await fetchFormTemplateById((submission as FormSubmission).template_id)
  if (!template) return null

  const values = await fetchSubmissionValueMap(submissionId)
  return {
    submission: submission as FormSubmission,
    template,
    values,
  }
}

export async function listFormSubmissionsByTemplate(templateId: string): Promise<FormSubmission[]> {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("template_id", templateId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as FormSubmission[]
}

export async function listFormSubmissionsForBusiness(params: {
  businessId: string
  status?: FormSubmissionStatus | "all"
  templateId?: string
}): Promise<Array<FormSubmission & { template: Pick<FormTemplate, "id" | "name" | "status"> | null }>> {
  let query = supabase
    .from("form_submissions")
    .select("*, template:form_templates(id, name, status)")
    .eq("business_id", params.businessId)
    .order("created_at", { ascending: false })
  if (params.status && params.status !== "all") query = query.eq("status", params.status)
  if (params.templateId) query = query.eq("template_id", params.templateId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Array<FormSubmission & { template: Pick<FormTemplate, "id" | "name" | "status"> | null }>
}

export async function saveFormSubmissionDraft(params: {
  submissionId: string
  businessId: string
  values: FormSubmissionValueMap
  templateFields: FormTemplateField[]
  metadata?: Record<string, unknown>
}): Promise<void> {
  await upsertSubmissionValues(params.submissionId, params.businessId, params.values, params.templateFields)
  if (params.metadata) {
    const { error } = await supabase
      .from("form_submissions")
      .update({ metadata: params.metadata, status: "draft" })
      .eq("id", params.submissionId)
    if (error) throw error
  }
}

export async function finalizeFormSubmission(params: {
  submissionId: string
  userId: string
  businessId: string
  values: FormSubmissionValueMap
  templateFields: FormTemplateField[]
  metadata?: Record<string, unknown>
}): Promise<FormSubmission> {
  await upsertSubmissionValues(params.submissionId, params.businessId, params.values, params.templateFields)
  const { data, error } = await supabase
    .from("form_submissions")
    .update({
      status: "finalized",
      finalized_by: params.userId,
      finalized_at: new Date().toISOString(),
      metadata: params.metadata ?? {},
    })
    .eq("id", params.submissionId)
    .select("*")
    .single()
  if (error) throw error
  return data as FormSubmission
}

export async function saveSubmissionExportFile(params: {
  businessId: string
  submissionId: string
  fileBytes: Uint8Array
}): Promise<{ path: string; size: number }> {
  const path = `${params.businessId}/submission-exports/${params.submissionId}-${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage.from(FORM_DOCUMENT_BUCKET).upload(path, params.fileBytes, {
    contentType: "application/pdf",
    upsert: false,
  })
  if (uploadError) throw uploadError

  const size = params.fileBytes.byteLength
  const { error: updateError } = await supabase
    .from("form_submissions")
    .update({ export_file_path: path, export_file_size: size })
    .eq("id", params.submissionId)
  if (updateError) throw updateError
  return { path, size }
}

export async function fetchSubmissionExportUrl(exportFilePath: string): Promise<string> {
  return createSignedDocumentUrl(exportFilePath, 60 * 30)
}

async function fetchSubmissionValueMap(submissionId: string): Promise<FormSubmissionValueMap> {
  const { data, error } = await supabase
    .from("form_submission_values")
    .select("field_key, value")
    .eq("submission_id", submissionId)
  if (error) throw error

  return ((data ?? []) as Array<{ field_key: string; value: unknown }>).reduce<FormSubmissionValueMap>((acc, row) => {
    acc[row.field_key] = row.value
    return acc
  }, {})
}

async function upsertSubmissionValues(
  submissionId: string,
  businessId: string,
  values: FormSubmissionValueMap,
  templateFields: FormTemplateField[],
): Promise<void> {
  const entries = Object.entries(values)
  const mappedFieldByKey = new Map(templateFields.map((f) => [f.field_key, f]))
  const payload = entries.map(([fieldKey, value]) => ({
    submission_id: submissionId,
    business_id: businessId,
    field_key: fieldKey,
    template_field_id: mappedFieldByKey.get(fieldKey)?.id ?? null,
    value: value ?? null,
  }))

  const { error: deleteError } = await supabase.from("form_submission_values").delete().eq("submission_id", submissionId)
  if (deleteError) throw deleteError
  if (payload.length === 0) return

  const { error } = await supabase.from("form_submission_values").insert(payload)
  if (error) throw error
}

async function createTemplateAuditLog(
  businessId: string,
  templateId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("form_template_audit_logs").insert({
    business_id: businessId,
    template_id: templateId,
    user_id: userId,
    action,
    details,
  })
  if (error) {
    console.warn("createTemplateAuditLog:", error)
  }
}

export async function resolveFormAutofillContext(params: {
  businessId: string
  customerId?: string | null
  appointmentJobId?: string | null
}): Promise<FormAutofillContext> {
  const [businessRes, customerRes, appointmentRes] = await Promise.all([
    supabase.from("businesses").select("name, address").eq("id", params.businessId).maybeSingle(),
    params.customerId
      ? supabase.from("customers").select("first_name, last_name, address, phone, email").eq("id", params.customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    params.appointmentJobId
      ? supabase
          .from("appointments_jobs")
          .select("scheduled_date, start_time, assigned_user:users(full_name)")
          .eq("id", params.appointmentJobId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (businessRes.error) throw businessRes.error
  if (customerRes.error) throw customerRes.error
  if (appointmentRes.error) throw appointmentRes.error

  const customer = customerRes.data as
    | { first_name: string; last_name: string; address: string | null; phone: string | null; email: string | null }
    | null
  const appointment = appointmentRes.data as
    | { scheduled_date: string | null; start_time: string | null; assigned_user?: { full_name?: string | null } | null }
    | null
  const business = businessRes.data as { name?: string | null; address?: string | null } | null

  return {
    customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : null,
    customerAddress: customer?.address ?? null,
    customerPhone: customer?.phone ?? null,
    customerEmail: customer?.email ?? null,
    technicianName: appointment?.assigned_user?.full_name ?? null,
    appointmentDate: appointment?.scheduled_date ?? null,
    appointmentTime: appointment?.start_time ?? null,
    businessName: business?.name ?? null,
    businessAddress: business?.address ?? null,
  }
}
