import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import {
  createFormTemplate,
  duplicateFormTemplate,
  listFormTemplateCategories,
  listFormTemplates,
  listUploadedPdfFiles,
  updateFormTemplateMeta,
  uploadTemplatePdfFile,
} from "@/services/formTemplates"
import type { FormTemplateStatus, UploadedPdfFile } from "@/types"
import * as pdfjsLib from "pdfjs-dist"

export default function FormTemplates() {
  const navigate = useNavigate()
  const { businessId, user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  const [statusFilter, setStatusFilter] = useState<FormTemplateStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")

  const [templates, setTemplates] = useState<Array<any>>([])
  const [categories, setCategories] = useState<string[]>([])
  const [pdfFiles, setPdfFiles] = useState<UploadedPdfFile[]>([])

  const [newTemplateName, setNewTemplateName] = useState("")
  const [newTemplateCategory, setNewTemplateCategory] = useState("")
  const [selectedPdfFileId, setSelectedPdfFileId] = useState("")

  const canMutate = Boolean(businessId && user?.id)

  const filtered = useMemo(() => templates, [templates])

  const loadAll = async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [tpl, pdf, cats] = await Promise.all([
        listFormTemplates({ businessId, status: statusFilter, search, category: category || undefined }),
        listUploadedPdfFiles(businessId),
        listFormTemplateCategories(businessId),
      ])
      setTemplates(tpl)
      setPdfFiles(pdf)
      setCategories(cats)
    } catch (e) {
      toast({ title: "Failed loading templates", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, statusFilter, category])

  const onUploadPdf = async (file: File | null) => {
    if (!file || !businessId || !user?.id) return
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" })
      return
    }
    setUploading(true)
    try {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const uploaded = await uploadTemplatePdfFile({
        businessId,
        userId: user.id,
        file,
        pageCount: pdf.numPages,
      })
      setPdfFiles((prev) => [uploaded, ...prev])
      setSelectedPdfFileId(uploaded.id)
      toast({ title: "PDF uploaded", description: "The file is ready for template creation." })
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const onCreateTemplate = async () => {
    if (!businessId || !user?.id || !selectedPdfFileId || !newTemplateName.trim()) return
    setCreatingTemplate(true)
    try {
      const created = await createFormTemplate({
        businessId,
        userId: user.id,
        pdfFileId: selectedPdfFileId,
        name: newTemplateName.trim(),
        category: newTemplateCategory.trim() || null,
        status: "draft",
      })
      toast({ title: "Template created", description: "Open builder to place fields." })
      navigate(`/forms/templates/${created.id}/builder`)
    } catch (e) {
      toast({ title: "Create failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    } finally {
      setCreatingTemplate(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">PDF Form Templates</h1>
        <p className="text-sm text-muted-foreground">Upload PDFs, build reusable templates, and manage published forms.</p>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Upload PDF & Create Template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Upload PDF</label>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              disabled={!canMutate || uploading}
              onChange={(e) => onUploadPdf(e.target.files?.[0] ?? null)}
            />
            {uploading && <p className="text-xs text-muted-foreground">Uploading PDF...</p>}
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Use uploaded PDF</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedPdfFileId}
              onChange={(e) => setSelectedPdfFileId(e.target.value)}
            >
              <option value="">Select PDF</option>
              {pdfFiles.map((pdf) => (
                <option key={pdf.id} value={pdf.id}>
                  {pdf.file_name} {pdf.page_count ? `(${pdf.page_count} pages)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Template name</label>
            <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Inspection report template" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Category (optional)</label>
            <Input value={newTemplateCategory} onChange={(e) => setNewTemplateCategory(e.target.value)} placeholder="HVAC / Safety / Service" />
          </div>
          <div>
            <Button disabled={!canMutate || creatingTemplate || !selectedPdfFileId || !newTemplateName.trim()} onClick={onCreateTemplate}>
              {creatingTemplate ? "Creating..." : "Create template"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input value={search} placeholder="Search template name" onChange={(e) => setSearch(e.target.value)} onBlur={() => void loadAll()} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FormTemplateStatus | "all")}
          >
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => void loadAll()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates found.</p>
        ) : (
          filtered.map((template) => (
            <Card key={template.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">Status: {template.status}</p>
                <p className="text-muted-foreground">Category: {template.category || "—"}</p>
                <p className="text-muted-foreground">Version: {template.version}</p>
                <p className="text-muted-foreground">PDF: {template.pdf_file?.file_name ?? "—"}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => navigate(`/forms/templates/${template.id}/builder`)}>
                    Builder
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/forms/templates/${template.id}/fill`)}>
                    Fill
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!businessId || !user?.id) return
                      try {
                        const copy = await duplicateFormTemplate({
                          sourceTemplateId: template.id,
                          businessId,
                          userId: user.id,
                          name: `${template.name} Copy`,
                        })
                        toast({ title: "Template duplicated" })
                        navigate(`/forms/templates/${copy.id}/builder`)
                      } catch (e) {
                        toast({ title: "Duplicate failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
                      }
                    }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant={template.status === "published" ? "secondary" : "outline"}
                    onClick={async () => {
                      if (!user?.id) return
                      const nextStatus: FormTemplateStatus = template.status === "published" ? "draft" : "published"
                      try {
                        await updateFormTemplateMeta({
                          templateId: template.id,
                          userId: user.id,
                          status: nextStatus,
                        })
                        toast({ title: nextStatus === "published" ? "Template published" : "Template moved to draft" })
                        await loadAll()
                      } catch (e) {
                        toast({
                          title: "Status update failed",
                          description: e instanceof Error ? e.message : "Unknown error",
                          variant: "destructive",
                        })
                      }
                    }}
                  >
                    {template.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
