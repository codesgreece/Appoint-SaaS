import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { FormTemplateBuilder } from "@/components/forms/FormTemplateBuilder"
import {
  createSignedDocumentUrl,
  createTemplateVersionSnapshot,
  fetchFormTemplateById,
  replaceTemplateFields,
  updateFormTemplateMeta,
} from "@/services/formTemplates"
import type { FormTemplateField } from "@/types"

export default function FormTemplateBuilderPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const { user, businessId } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pdfUrl, setPdfUrl] = useState("")
  const [template, setTemplate] = useState<any>(null)
  const [fields, setFields] = useState<FormTemplateField[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")

  const canSave = useMemo(() => Boolean(user?.id && businessId && templateId), [user?.id, businessId, templateId])

  const loadTemplate = async () => {
    if (!templateId) return
    setLoading(true)
    try {
      const tpl = await fetchFormTemplateById(templateId)
      if (!tpl?.pdf_file) {
        toast({ title: "Template not found", variant: "destructive" })
        navigate("/forms")
        return
      }
      setTemplate(tpl)
      setFields(tpl.fields ?? [])
      setName(tpl.name)
      setDescription(tpl.description ?? "")
      setCategory(tpl.category ?? "")
      const signed = await createSignedDocumentUrl(tpl.pdf_file.file_path)
      setPdfUrl(signed)
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  const onSave = async () => {
    if (!templateId || !user?.id || !businessId) return
    setSaving(true)
    try {
      await updateFormTemplateMeta({
        templateId,
        userId: user.id,
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
      })
      await replaceTemplateFields({
        templateId,
        businessId,
        fields: fields.map((f, idx) => ({
          id: f.id,
          field_key: f.field_key,
          name: f.name,
          label: f.label,
          type: f.type,
          page_number: f.page_number,
          position_x: f.position_x,
          position_y: f.position_y,
          width: f.width,
          height: f.height,
          sort_order: idx + 1,
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
      await createTemplateVersionSnapshot({ templateId, businessId, userId: user.id })
      toast({ title: "Template saved", description: "Draft updated with a new version snapshot." })
      await loadTemplate()
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading template builder...</p>
  if (!template || !pdfUrl) return <p className="text-sm text-muted-foreground">Template unavailable.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Template Builder</h1>
          <p className="text-sm text-muted-foreground">Design reusable fields on top of PDF pages.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/forms/templates/${template.id}/fill`)}>
            Preview / Fill
          </Button>
          <Button disabled={!canSave || saving} onClick={onSave}>
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Template Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-3">
            <label className="text-xs text-muted-foreground">Description</label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <FormTemplateBuilder pdfUrl={pdfUrl} fields={fields} onFieldsChange={setFields} />
    </div>
  )
}
