import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { FormSubmissionValueMap, FormTemplateField, FormTemplateWithRelations } from "@/types"

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl)
  return new Uint8Array(await res.arrayBuffer())
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.map((v) => normalizeText(v)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function fieldRectToPdf(
  field: Pick<FormTemplateField, "position_x" | "position_y" | "width" | "height">,
  pageWidth: number,
  pageHeight: number,
) {
  const x = Number(field.position_x) * pageWidth
  const yFromTop = Number(field.position_y) * pageHeight
  const width = Number(field.width) * pageWidth
  const height = Number(field.height) * pageHeight
  const yBottom = pageHeight - yFromTop - height
  return { x, yBottom, width, height }
}

export async function renderFilledSubmissionPdf(params: {
  template: FormTemplateWithRelations
  values: FormSubmissionValueMap
  originalPdfBytes: Uint8Array
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(params.originalPdfBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const field of params.template.fields) {
    const pageIndex = field.page_number - 1
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue
    const page = pdfDoc.getPage(pageIndex)
    const value = params.values[field.field_key]
    if (value === undefined || value === null || value === "") continue

    const { x, yBottom, width, height } = fieldRectToPdf(field, page.getWidth(), page.getHeight())

    switch (field.type) {
      case "checkbox": {
        if (Boolean(value)) {
          page.drawText("X", {
            x: x + width * 0.25,
            y: yBottom + height * 0.2,
            size: Math.max(10, height * 0.8),
            font,
          })
        }
        break
      }
      case "signature": {
        const textValue = normalizeText(value)
        if (textValue.startsWith("data:image/")) {
          const bytes = await dataUrlToBytes(textValue)
          const image = textValue.includes("image/jpeg")
            ? await pdfDoc.embedJpg(bytes)
            : await pdfDoc.embedPng(bytes)
          page.drawImage(image, { x, y: yBottom, width, height })
        } else {
          page.drawText(textValue, { x, y: yBottom + 2, size: Math.max(10, height * 0.5), font })
        }
        break
      }
      case "static_label":
        break
      case "repeater": {
        const asText = Array.isArray(value) ? value.map((row) => normalizeText(row)).join("\n") : normalizeText(value)
        page.drawText(asText, {
          x: x + 2,
          y: yBottom + Math.max(2, height - 12),
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth: width - 4,
          lineHeight: 12,
        })
        break
      }
      default: {
        const text = normalizeText(value)
        page.drawText(text, {
          x: x + 2,
          y: yBottom + Math.max(2, height * 0.3),
          size: Math.max(9, Math.min(12, height * 0.55)),
          font,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth: width - 4,
        })
      }
    }
  }

  return pdfDoc.save()
}
