export type FormTemplateStatus = "draft" | "published" | "archived"
export type FormSubmissionStatus = "draft" | "finalized" | "void"

export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "checkbox"
  | "radio"
  | "select"
  | "signature"
  | "static_label"
  | "repeater"

export type FormConditionOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "exists"
  | "not_exists"

export interface FormFieldConditionalRule {
  fieldKey: string
  operator: FormConditionOperator
  value?: string | number | boolean | null
}

export interface FormFieldOption {
  label: string
  value: string
}

export interface FormFieldGeometry {
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
}

export interface FormFieldValidationRule {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  message?: string
}

export interface FormFieldStyle {
  fontSize?: number
  fontWeight?: "normal" | "bold"
  textAlign?: "left" | "center" | "right"
  color?: string
  backgroundColor?: string
}

export interface FormRepeaterConfig {
  columns: Array<{ key: string; label: string; type: "text" | "number" | "date" | "time" }>
  maxRows?: number
}

export interface FormTemplateField {
  id: string
  business_id: string
  template_id: string
  field_key: string
  name: string
  label: string
  type: FormFieldType
  page_number: number
  position_x: number
  position_y: number
  width: number
  height: number
  sort_order: number
  required: boolean
  placeholder: string | null
  default_value: unknown
  help_text: string | null
  validation_rules: FormFieldValidationRule | null
  options: FormFieldOption[] | null
  readonly: boolean
  hidden: boolean
  conditional_visibility: FormFieldConditionalRule[] | null
  style: FormFieldStyle | null
  autofill_key: string | null
  config: FormRepeaterConfig | Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface UploadedPdfFile {
  id: string
  business_id: string
  uploaded_by: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string
  page_count: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FormTemplate {
  id: string
  business_id: string
  pdf_file_id: string
  name: string
  description: string | null
  category: string | null
  status: FormTemplateStatus
  version: number
  schema_version: number
  created_by: string
  updated_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  business_id: string
  template_id: string
  template_version: number
  status: FormSubmissionStatus
  title: string | null
  customer_id: string | null
  appointment_job_id: string | null
  work_order_ref: string | null
  submitted_by: string
  finalized_by: string | null
  finalized_at: string | null
  export_file_path: string | null
  export_file_size: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FormSubmissionValue {
  id: string
  business_id: string
  submission_id: string
  template_field_id: string | null
  field_key: string
  value: unknown
  created_at: string
  updated_at: string
}

export interface FormTemplateVersion {
  id: string
  business_id: string
  template_id: string
  version_number: number
  snapshot: Record<string, unknown>
  created_by: string
  created_at: string
}

export interface FormTemplateAuditLog {
  id: string
  business_id: string
  template_id: string
  user_id: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}

export interface FormTemplateWithRelations extends FormTemplate {
  pdf_file: UploadedPdfFile | null
  fields: FormTemplateField[]
}

export type FormSubmissionValueMap = Record<string, unknown>

export interface FormAutofillContext {
  customerName?: string | null
  customerAddress?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  technicianName?: string | null
  appointmentDate?: string | null
  appointmentTime?: string | null
  businessName?: string | null
  businessAddress?: string | null
}

export const FORM_AUTOFILL_KEYS = [
  "customer.name",
  "customer.address",
  "customer.phone",
  "customer.email",
  "technician.name",
  "appointment.date",
  "appointment.time",
  "business.name",
  "business.address",
] as const

export type FormAutofillKey = (typeof FORM_AUTOFILL_KEYS)[number]
