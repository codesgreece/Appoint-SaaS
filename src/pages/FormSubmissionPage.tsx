import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { FormRenderer } from "@/components/forms/FormRenderer"
import { applyAutofillValues, buildInitialValues } from "@/lib/formEngine"
import { renderFilledSubmissionPdf } from "@/lib/pdfFormExport"
import { fetchAppointments, fetchCustomers } from "@/services/api"
import {
  createFormSubmission,
  createSignedDocumentUrl,
  fetchFormTemplateById,
  fetchSubmissionById,
  finalizeFormSubmission,
  resolveFormAutofillContext,
  saveFormSubmissionDraft,
  saveSubmissionExportFile,
} from "@/services/formTemplates"
import type { FormSubmissionValueMap, FormTemplateWithRelations } from "@/types"

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function FormSubmissionPage() {
  const { templateId, submissionId } = useParams<{ templateId?: string; submissionId?: string }>()
  const { businessId, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [template, setTemplate] = useState<FormTemplateWithRelations | null>(null)
  const [pdfUrl, setPdfUrl] = useState("")
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null)
  const [submissionStatus, setSubmissionStatus] = useState<"draft" | "finalized" | "void">("draft")
  const [values, setValues] = useState<FormSubmissionValueMap>({})

  const [customers, setCustomers] = useState<Array<any>>([])
  const [appointments, setAppointments] = useState<Array<any>>([])
  const [title, setTitle] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [appointmentJobId, setAppointmentJobId] = useState("")
  const [workOrderRef, setWorkOrderRef] = useState("")

  const canEdit = submissionStatus !== "finalized"

  const requiredMissing = useMemo(() => {
    if (!template) return []
    return template.fields.filter((f) => f.required && !values[f.field_key] && !f.hidden)
  }, [template, values])

  const loadBaseTemplate = async (id: string) => {
    const tpl = await fetchFormTemplateById(id)
    if (!tpl?.pdf_file) throw new Error("Template PDF not found.")
    const signed = await createSignedDocumentUrl(tpl.pdf_file.file_path)
    setTemplate(tpl)
    setPdfUrl(signed)
    return tpl
  }

  useEffect(() => {
    const run = async () => {
      if (!businessId || !user?.id) return
      setLoading(true)
      try {
        const [customerRows, appointmentRows] = await Promise.all([
          fetchCustomers(businessId),
          fetchAppointments(businessId, {}),
        ])
        setCustomers(customerRows)
        setAppointments(appointmentRows)

        if (submissionId) {
          const loaded = await fetchSubmissionById(submissionId)
          if (!loaded) throw new Error("Submission not found.")
          if (!loaded.template.pdf_file?.file_path) throw new Error("Template PDF is missing.")
          setTemplate(loaded.template)
          setActiveSubmissionId(loaded.submission.id)
          setSubmissionStatus(loaded.submission.status)
          setTitle(loaded.submission.title ?? "")
          setCustomerId(loaded.submission.customer_id ?? "")
          setAppointmentJobId(loaded.submission.appointment_job_id ?? "")
          setWorkOrderRef(loaded.submission.work_order_ref ?? "")
          const signed = await createSignedDocumentUrl(loaded.template.pdf_file.file_path)
          setPdfUrl(signed)

          const autofill = await resolveFormAutofillContext({
            businessId,
            customerId: loaded.submission.customer_id,
            appointmentJobId: loaded.submission.appointment_job_id,
          })
          const seeded = buildInitialValues(loaded.template.fields, loaded.values)
          setValues(applyAutofillValues(loaded.template.fields, seeded, autofill))
        } else if (templateId) {
          const tpl = await loadBaseTemplate(templateId)
          const autofill = await resolveFormAutofillContext({ businessId })
          const seeded = buildInitialValues(tpl.fields, {})
          setValues(applyAutofillValues(tpl.fields, seeded, autofill))
        } else {
          throw new Error("Missing template identifier.")
        }
      } catch (e) {
        toast({ title: "Load failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [businessId, user?.id, templateId, submissionId, toast])

  const ensureSubmission = async (): Promise<string> => {
    if (!businessId || !user?.id || !template) throw new Error("Missing context.")
    if (activeSubmissionId) return activeSubmissionId
    const created = await createFormSubmission({
      businessId,
      templateId: template.id,
      userId: user.id,
      title: title || null,
      customerId: customerId || null,
      appointmentJobId: appointmentJobId || null,
      workOrderRef: workOrderRef || null,
      values,
      metadata: { createdFrom: "form_renderer" },
    })
    setActiveSubmissionId(created.id)
    navigate(`/forms/submissions/${created.id}`, { replace: true })
    return created.id
  }

  const onSaveDraft = async () => {
    if (!businessId || !template) return
    setSaving(true)
    try {
      const id = await ensureSubmission()
      await saveFormSubmissionDraft({
        submissionId: id,
        businessId,
        values,
        templateFields: template.fields,
        metadata: {
          title,
          customer_id: customerId || null,
          appointment_job_id: appointmentJobId || null,
          work_order_ref: workOrderRef || null,
        },
      })
      toast({ title: "Draft saved" })
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const onFinalize = async () => {
    if (!businessId || !user?.id || !template) return
    if (requiredMissing.length > 0) {
      toast({
        title: "Required fields missing",
        description: `${requiredMissing.length} required fields are empty.`,
        variant: "destructive",
      })
      return
    }
    setFinalizing(true)
    try {
      const id = await ensureSubmission()
      const finalized = await finalizeFormSubmission({
        submissionId: id,
        userId: user.id,
        businessId,
        values,
        templateFields: template.fields,
        metadata: {
          title,
          customer_id: customerId || null,
          appointment_job_id: appointmentJobId || null,
          work_order_ref: workOrderRef || null,
        },
      })
      setSubmissionStatus(finalized.status)
      toast({ title: "Submission finalized" })
    } catch (e) {
      toast({ title: "Finalize failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setFinalizing(false)
    }
  }

  const onExportPdf = async () => {
    if (!template || !pdfUrl || !businessId) return
    setExporting(true)
    try {
      const res = await fetch(pdfUrl)
      const bytes = new Uint8Array(await res.arrayBuffer())
      const rendered = await renderFilledSubmissionPdf({
        template,
        values,
        originalPdfBytes: bytes,
      })
      if (activeSubmissionId) {
        await saveSubmissionExportFile({
          businessId,
          submissionId: activeSubmissionId,
          fileBytes: rendered,
        })
      }
      downloadBytes(rendered, `${template.name.replace(/\s+/g, "_")}_filled.pdf`)
      toast({ title: "PDF exported" })
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading form renderer...</p>
  if (!template || !pdfUrl) return <p className="text-sm text-muted-foreground">Template unavailable.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <p className="text-sm text-muted-foreground">Fill, save as draft, finalize, and export PDF.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSaveDraft} disabled={!canEdit || saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button variant="secondary" onClick={onFinalize} disabled={!canEdit || finalizing}>
            {finalizing ? "Finalizing..." : "Finalize"}
          </Button>
          <Button onClick={onExportPdf} disabled={exporting}>
            {exporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Submission Context</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-muted-foreground">Submission title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Customer</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={!canEdit}
            >
              <option value="">None</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Appointment / Job</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={appointmentJobId}
              onChange={(e) => setAppointmentJobId(e.target.value)}
              disabled={!canEdit}
            >
              <option value="">None</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.scheduled_date})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Work order ref</label>
            <Input value={workOrderRef} onChange={(e) => setWorkOrderRef(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Status</label>
            <Input value={submissionStatus} disabled />
          </div>
        </CardContent>
      </Card>

      <FormRenderer pdfUrl={pdfUrl} fields={template.fields} values={values} onChange={setValues} readonly={!canEdit} />
    </div>
  )
}
