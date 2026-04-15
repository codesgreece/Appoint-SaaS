import type {
  FormAutofillContext,
  FormFieldConditionalRule,
  FormSubmissionValueMap,
  FormTemplateField,
} from "@/types"

export function evaluateConditionalVisibility(
  conditions: FormFieldConditionalRule[] | null | undefined,
  values: FormSubmissionValueMap,
): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every((rule) => {
    const candidate = values[rule.fieldKey]
    switch (rule.operator) {
      case "eq":
        return candidate === rule.value
      case "neq":
        return candidate !== rule.value
      case "contains":
        return String(candidate ?? "").includes(String(rule.value ?? ""))
      case "not_contains":
        return !String(candidate ?? "").includes(String(rule.value ?? ""))
      case "exists":
        return candidate !== undefined && candidate !== null && candidate !== ""
      case "not_exists":
        return candidate === undefined || candidate === null || candidate === ""
      default:
        return true
    }
  })
}

export function applyAutofillValues(
  fields: FormTemplateField[],
  currentValues: FormSubmissionValueMap,
  context: FormAutofillContext,
): FormSubmissionValueMap {
  const next = { ...currentValues }
  for (const field of fields) {
    if (!field.autofill_key) continue
    if (next[field.field_key] !== undefined && next[field.field_key] !== null && next[field.field_key] !== "") continue
    const value = autofillKeyToValue(field.autofill_key, context)
    if (value !== null && value !== undefined && value !== "") next[field.field_key] = value
  }
  return next
}

export function defaultValueForField(field: FormTemplateField): unknown {
  if (field.default_value !== undefined && field.default_value !== null) return field.default_value
  switch (field.type) {
    case "checkbox":
      return false
    case "repeater":
      return []
    default:
      return ""
  }
}

export function buildInitialValues(fields: FormTemplateField, initial?: FormSubmissionValueMap): FormSubmissionValueMap
export function buildInitialValues(fields: FormTemplateField[], initial?: FormSubmissionValueMap): FormSubmissionValueMap
export function buildInitialValues(fields: FormTemplateField[] | FormTemplateField, initial?: FormSubmissionValueMap): FormSubmissionValueMap {
  const list = Array.isArray(fields) ? fields : [fields]
  const seeded: FormSubmissionValueMap = { ...(initial ?? {}) }
  for (const field of list) {
    if (seeded[field.field_key] === undefined) seeded[field.field_key] = defaultValueForField(field)
  }
  return seeded
}

function autofillKeyToValue(key: string, context: FormAutofillContext): string | null {
  switch (key) {
    case "customer.name":
      return context.customerName ?? null
    case "customer.address":
      return context.customerAddress ?? null
    case "customer.phone":
      return context.customerPhone ?? null
    case "customer.email":
      return context.customerEmail ?? null
    case "technician.name":
      return context.technicianName ?? null
    case "appointment.date":
      return context.appointmentDate ?? null
    case "appointment.time":
      return context.appointmentTime ?? null
    case "business.name":
      return context.businessName ?? null
    case "business.address":
      return context.businessAddress ?? null
    default:
      return null
  }
}
