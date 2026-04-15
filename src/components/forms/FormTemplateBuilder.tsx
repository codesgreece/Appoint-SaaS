import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PdfDocumentViewer } from "@/components/forms/PdfDocumentViewer"
import type { FormFieldType, FormTemplateField } from "@/types"
import { Check } from "lucide-react"

interface FormTemplateBuilderProps {
  pdfUrl: string
  fields: FormTemplateField[]
  onFieldsChange: (fields: FormTemplateField[]) => void
}

const FIELD_TYPES: Array<{ value: FormFieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio Group" },
  { value: "select", label: "Select" },
  { value: "signature", label: "Signature" },
  { value: "static_label", label: "Static Label" },
  { value: "repeater", label: "Repeater" },
]

type DragMode = "move" | "resize"

interface DragState {
  fieldId: string
  pageWidth: number
  pageHeight: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  originWidth: number
  originHeight: number
  mode: DragMode
}

function humanLabel(type: FormFieldType) {
  return FIELD_TYPES.find((t) => t.value === type)?.label ?? type
}

function createField(type: FormFieldType, pageNumber: number, x: number, y: number): FormTemplateField {
  const key = `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
  const defaults: Record<FormFieldType, { width: number; height: number }> = {
    text: { width: 0.25, height: 0.045 },
    textarea: { width: 0.35, height: 0.12 },
    number: { width: 0.2, height: 0.045 },
    date: { width: 0.2, height: 0.045 },
    time: { width: 0.16, height: 0.045 },
    checkbox: { width: 0.03, height: 0.035 },
    radio: { width: 0.2, height: 0.05 },
    select: { width: 0.25, height: 0.05 },
    signature: { width: 0.3, height: 0.1 },
    static_label: { width: 0.3, height: 0.04 },
    repeater: { width: 0.45, height: 0.18 },
  }
  const size = defaults[type]

  return {
    id: crypto.randomUUID(),
    business_id: "",
    template_id: "",
    field_key: key,
    name: key,
    label: humanLabel(type),
    type,
    page_number: pageNumber,
    position_x: Math.min(Math.max(x, 0), 0.95),
    position_y: Math.min(Math.max(y, 0), 0.95),
    width: size.width,
    height: size.height,
    sort_order: Date.now(),
    required: false,
    placeholder: "",
    default_value: type === "checkbox" ? false : "",
    help_text: "",
    validation_rules: null,
    options: type === "radio" || type === "select" ? [{ label: "Option 1", value: "option_1" }] : null,
    readonly: false,
    hidden: false,
    conditional_visibility: null,
    style: null,
    autofill_key: null,
    config: type === "repeater" ? { columns: [{ key: "item", label: "Item", type: "text" }], maxRows: 10 } : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function FormTemplateBuilder({ pdfUrl, fields, onFieldsChange }: FormTemplateBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id ?? null)
  const [pendingFieldType, setPendingFieldType] = useState<FormFieldType>("text")
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [isAddMode, setIsAddMode] = useState(false)
  const [continuousAddMode, setContinuousAddMode] = useState(false)
  const [suppressPageClickUntil, setSuppressPageClickUntil] = useState(0)

  const selectedField = useMemo(() => fields.find((f) => f.id === selectedFieldId) ?? null, [fields, selectedFieldId])

  const sortedFields = useMemo(
    () =>
      [...fields].sort((a, b) => {
        if (a.page_number !== b.page_number) return a.page_number - b.page_number
        return a.sort_order - b.sort_order
      }),
    [fields],
  )

  const updateField = (fieldId: string, patch: Partial<FormTemplateField>) => {
    onFieldsChange(fields.map((field) => (field.id === fieldId ? { ...field, ...patch, updated_at: new Date().toISOString() } : field)))
  }

  useEffect(() => {
    if (!dragState) return

    const onMouseMove = (e: MouseEvent) => {
      const targetField = fields.find((f) => f.id === dragState.fieldId)
      if (!targetField) return
      if (dragState.mode === "move") {
        const deltaX = (e.clientX - dragState.startClientX) / dragState.pageWidth
        const deltaY = (e.clientY - dragState.startClientY) / dragState.pageHeight
        updateField(targetField.id, {
          position_x: Math.max(0, Math.min(1 - targetField.width, dragState.originX + deltaX)),
          position_y: Math.max(0, Math.min(1 - targetField.height, dragState.originY + deltaY)),
        })
        return
      }

      const deltaX = (e.clientX - dragState.startClientX) / dragState.pageWidth
      const deltaY = (e.clientY - dragState.startClientY) / dragState.pageHeight
      updateField(targetField.id, {
        width: Math.max(0.012, Math.min(1 - targetField.position_x, dragState.originWidth + deltaX)),
        height: Math.max(0.012, Math.min(1 - targetField.position_y, dragState.originHeight + deltaY)),
      })
    }

    const onMouseUp = () => {
      setDragState(null)
      // Prevent accidental page click after drag/resize end.
      setSuppressPageClickUntil(Date.now() + 200)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [dragState, fields, onFieldsChange])

  const removeField = (fieldId: string) => {
    onFieldsChange(fields.filter((field) => field.id !== fieldId))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
  }

  const duplicateField = (field: FormTemplateField) => {
    const dup: FormTemplateField = {
      ...field,
      id: crypto.randomUUID(),
      field_key: `${field.field_key}_copy_${Math.random().toString(16).slice(2, 5)}`,
      name: `${field.name}_copy`,
      position_x: Math.min(field.position_x + 0.02, 0.92),
      position_y: Math.min(field.position_y + 0.02, 0.92),
      sort_order: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onFieldsChange([...fields, dup])
    setSelectedFieldId(dup.id)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Builder Toolbar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={isAddMode ? "default" : "outline"}
                onClick={() => setIsAddMode((prev) => !prev)}
              >
                {isAddMode ? "Add Mode ON" : "Add Field"}
              </Button>
              <label className="inline-flex items-center gap-2 text-xs rounded-full border px-3 py-1.5 bg-background">
                <input
                  type="checkbox"
                  checked={continuousAddMode}
                  onChange={(e) => setContinuousAddMode(e.target.checked)}
                />
                Continuous add
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-2.5">
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm min-w-[180px]"
              value={pendingFieldType}
              onChange={(e) => setPendingFieldType(e.target.value as FormFieldType)}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
              <p className="text-xs text-muted-foreground">
                {isAddMode
                  ? "Click on PDF to place field."
                  : "Select/drag fields normally. Enable Add Mode to create new fields."}
              </p>
            </div>
          </CardContent>
        </Card>

        <PdfDocumentViewer
          pdfUrl={pdfUrl}
          onPageClick={({ pageNumber, relativeX, relativeY }) => {
            if (!isAddMode) return
            if (Date.now() < suppressPageClickUntil) return
            const next = createField(pendingFieldType, pageNumber, relativeX, relativeY)
            onFieldsChange([...fields, next])
            setSelectedFieldId(next.id)
            if (!continuousAddMode) setIsAddMode(false)
          }}
          renderOverlay={({ pageNumber, pageWidth, pageHeight }) => (
            <div className="absolute inset-0">
              {fields
                .filter((f) => f.page_number === pageNumber)
                .map((field) => {
                  const left = field.position_x * pageWidth
                  const top = field.position_y * pageHeight
                  const width = field.width * pageWidth
                  const height = field.height * pageHeight
                  return (
                    <div
                      key={field.id}
                      className={cn(
                        "absolute border text-[11px] px-1 py-0.5 cursor-move",
                        field.type === "checkbox" ? "bg-primary/5" : "bg-primary/10",
                        selectedFieldId === field.id ? "border-primary ring-2 ring-primary/40" : "border-primary/40",
                      )}
                      style={{ left, top, width, height }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedFieldId(field.id)
                        setDragState({
                          fieldId: field.id,
                          pageWidth,
                          pageHeight,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          originX: field.position_x,
                          originY: field.position_y,
                          originWidth: field.width,
                          originHeight: field.height,
                          mode: "move",
                        })
                      }}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedFieldId(field.id)
                      }}
                    >
                      {field.type === "checkbox" ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="truncate font-medium">{field.label || field.name}</div>
                      )}
                      <button
                        type="button"
                        className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full bg-primary"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDragState({
                            fieldId: field.id,
                            pageWidth,
                            pageHeight,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            originX: field.position_x,
                            originY: field.position_y,
                            originWidth: field.width,
                            originHeight: field.height,
                            mode: "resize",
                          })
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                      />
                    </div>
                  )
                })}
            </div>
          )}
        />
      </div>

      <div className="space-y-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[380px] overflow-auto">
            {sortedFields.map((field, index) => (
              <div
                key={field.id}
                className={cn(
                  "rounded-md border px-2 py-2 text-sm cursor-pointer",
                  selectedFieldId === field.id ? "border-primary bg-primary/5" : "border-border",
                )}
                onClick={() => setSelectedFieldId(field.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{field.label || field.name}</p>
                  <Badge variant="outline">{humanLabel(field.type)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Page {field.page_number}</p>
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (index === 0) return
                      const current = sortedFields[index]
                      const previous = sortedFields[index - 1]
                      const next = fields.map((f) => {
                        if (f.id === current.id) return { ...f, sort_order: previous.sort_order }
                        if (f.id === previous.id) return { ...f, sort_order: current.sort_order }
                        return f
                      })
                      onFieldsChange(next)
                    }}
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (index >= sortedFields.length - 1) return
                      const current = sortedFields[index]
                      const nextField = sortedFields[index + 1]
                      const next = fields.map((f) => {
                        if (f.id === current.id) return { ...f, sort_order: nextField.sort_order }
                        if (f.id === nextField.id) return { ...f, sort_order: current.sort_order }
                        return f
                      })
                      onFieldsChange(next)
                    }}
                  >
                    Down
                  </Button>
                </div>
              </div>
            ))}
            {sortedFields.length === 0 && <p className="text-sm text-muted-foreground">No fields added yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Field Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedField ? (
              <p className="text-sm text-muted-foreground">Select a field to edit settings.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">Field Key</label>
                  <Input value={selectedField.field_key} onChange={(e) => updateField(selectedField.id, { field_key: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">Label</label>
                  <Input value={selectedField.label} onChange={(e) => updateField(selectedField.id, { label: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input value={selectedField.name} onChange={(e) => updateField(selectedField.id, { name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedField.required}
                      onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedField.readonly}
                      onChange={(e) => updateField(selectedField.id, { readonly: e.target.checked })}
                    />
                    Readonly
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedField.hidden}
                      onChange={(e) => updateField(selectedField.id, { hidden: e.target.checked })}
                    />
                    Hidden
                  </label>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">Placeholder</label>
                  <Input
                    value={selectedField.placeholder ?? ""}
                    onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                    disabled={selectedField.type === "checkbox"}
                  />
                </div>
                {selectedField.type === "checkbox" ? (
                  <div className="grid gap-2">
                    <label className="text-xs text-muted-foreground">Checkbox quick tools</label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateField(selectedField.id, { width: 0.018, height: 0.024 })}
                      >
                        Small box
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateField(selectedField.id, { width: 0.024, height: 0.03 })}
                      >
                        Medium box
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateField(selectedField.id, { width: 0.03, height: 0.035 })}
                      >
                        Large box
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Tip: για checkbox βάλε το πεδίο ακριβώς πάνω στο τετράγωνο του PDF και κράτα το label μόνο για εσωτερική οργάνωση.
                    </p>
                  </div>
                ) : null}
                {(selectedField.type === "radio" || selectedField.type === "select") && (
                  <div className="grid gap-2">
                    <label className="text-xs text-muted-foreground">Options (one per line: label|value)</label>
                    <Textarea
                      value={(selectedField.options ?? []).map((o) => `${o.label}|${o.value}`).join("\n")}
                      onChange={(e) =>
                        updateField(selectedField.id, {
                          options: e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => {
                              const [label, value] = line.split("|")
                              return { label: label?.trim() ?? "", value: (value ?? label ?? "").trim() }
                            }),
                        })
                      }
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">Autofill key</label>
                  <Input
                    value={selectedField.autofill_key ?? ""}
                    placeholder="e.g. customer.name"
                    onChange={(e) => updateField(selectedField.id, { autofill_key: e.target.value || null })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">Conditional visibility (JSON array)</label>
                  <Textarea
                    rows={3}
                    value={JSON.stringify(selectedField.conditional_visibility ?? [], null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        updateField(selectedField.id, { conditional_visibility: Array.isArray(parsed) ? parsed : null })
                      } catch {
                        // ignore invalid JSON while typing
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => duplicateField(selectedField)}>
                    Duplicate
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => removeField(selectedField.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
