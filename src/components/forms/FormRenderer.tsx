import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PdfDocumentViewer } from "@/components/forms/PdfDocumentViewer"
import { SignaturePad } from "@/components/forms/SignaturePad"
import { evaluateConditionalVisibility } from "@/lib/formEngine"
import type { FormSubmissionValueMap, FormTemplateField } from "@/types"

interface FormRendererProps {
  pdfUrl: string
  fields: FormTemplateField[]
  values: FormSubmissionValueMap
  onChange: (values: FormSubmissionValueMap) => void
  readonly?: boolean
  className?: string
}

export function FormRenderer({ pdfUrl, fields, values, onChange, readonly = false, className }: FormRendererProps) {
  const visibleFields = useMemo(
    () =>
      fields.filter((field) => {
        if (field.hidden) return false
        return evaluateConditionalVisibility(field.conditional_visibility, values)
      }),
    [fields, values],
  )

  const fieldByPage = useMemo(() => {
    const map = new Map<number, FormTemplateField[]>()
    for (const field of visibleFields) {
      const list = map.get(field.page_number) ?? []
      list.push(field)
      map.set(field.page_number, list)
    }
    return map
  }, [visibleFields])

  const setValue = (fieldKey: string, nextValue: unknown) => {
    onChange({ ...values, [fieldKey]: nextValue })
  }

  return (
    <div className={cn("space-y-4", className)}>
      <PdfDocumentViewer
        pdfUrl={pdfUrl}
        renderOverlay={({ pageNumber, pageWidth, pageHeight }) => (
          <div className="absolute inset-0">
            {(fieldByPage.get(pageNumber) ?? []).map((field) => {
              const left = field.position_x * pageWidth
              const top = field.position_y * pageHeight
              const width = field.width * pageWidth
              const height = field.height * pageHeight
              const value = values[field.field_key]

              return (
                <div
                  key={field.id}
                  className="absolute p-0.5 bg-background/40 rounded border border-primary/15"
                  style={{ left, top, width, height, minHeight: 20 }}
                >
                  {field.type === "checkbox" ? (
                    <label className="flex h-full items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        disabled={readonly || field.readonly}
                        checked={Boolean(value)}
                        onChange={(e) => setValue(field.field_key, e.target.checked)}
                      />
                      <span className="truncate">{field.label}</span>
                    </label>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      className="h-full min-h-0 text-[11px]"
                      disabled={readonly || field.readonly}
                      placeholder={field.placeholder ?? undefined}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setValue(field.field_key, e.target.value)}
                    />
                  ) : field.type === "number" ? (
                    <Input
                      type="number"
                      className="h-full text-[11px]"
                      disabled={readonly || field.readonly}
                      placeholder={field.placeholder ?? undefined}
                      value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
                      onChange={(e) => setValue(field.field_key, Number(e.target.value))}
                    />
                  ) : field.type === "date" ? (
                    <Input
                      type="date"
                      className="h-full text-[11px]"
                      disabled={readonly || field.readonly}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setValue(field.field_key, e.target.value)}
                    />
                  ) : field.type === "time" ? (
                    <Input
                      type="time"
                      className="h-full text-[11px]"
                      disabled={readonly || field.readonly}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setValue(field.field_key, e.target.value)}
                    />
                  ) : field.type === "radio" ? (
                    <div className="h-full overflow-auto rounded bg-background px-1 py-0.5 text-[11px]">
                      {(field.options ?? []).map((opt) => (
                        <label key={opt.value} className="mr-2 inline-flex items-center gap-1">
                          <input
                            type="radio"
                            disabled={readonly || field.readonly}
                            checked={value === opt.value}
                            onChange={() => setValue(field.field_key, opt.value)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  ) : field.type === "select" ? (
                    <select
                      className="h-full w-full rounded border bg-background px-2 text-[11px]"
                      disabled={readonly || field.readonly}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setValue(field.field_key, e.target.value)}
                    >
                      <option value="">{field.placeholder ?? "Select"}</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "signature" ? (
                    <SignaturePad
                      disabled={readonly || field.readonly}
                      value={typeof value === "string" ? value : ""}
                      onChange={(next) => setValue(field.field_key, next)}
                    />
                  ) : field.type === "static_label" ? (
                    <div className="h-full text-[11px] flex items-center px-1">{field.label}</div>
                  ) : field.type === "repeater" ? (
                    <Textarea
                      className="h-full min-h-0 text-[11px]"
                      disabled={readonly || field.readonly}
                      placeholder="One row per line"
                      value={typeof value === "string" ? value : Array.isArray(value) ? value.join("\n") : ""}
                      onChange={(e) => setValue(field.field_key, e.target.value)}
                    />
                  ) : (
                    <Input
                      className="h-full text-[11px]"
                      disabled={readonly || field.readonly}
                      placeholder={field.placeholder ?? undefined}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setValue(field.field_key, e.target.value)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      />
    </div>
  )
}
