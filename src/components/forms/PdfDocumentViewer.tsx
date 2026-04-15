import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import * as pdfjsLib from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url"

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

interface PdfPageMetric {
  width: number
  height: number
}

interface PdfDocumentViewerProps {
  pdfUrl: string
  className?: string
  pageClassName?: string
  scale?: number
  onPageClick?: (params: { pageNumber: number; relativeX: number; relativeY: number }) => void
  renderOverlay?: (params: { pageNumber: number; pageWidth: number; pageHeight: number }) => React.ReactNode
}

export function PdfDocumentViewer({
  pdfUrl,
  className,
  pageClassName,
  scale = 1.3,
  onPageClick,
  renderOverlay,
}: PdfDocumentViewerProps) {
  const [pageMetrics, setPageMetrics] = useState<PdfPageMetric[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([])
  const pageRefs = useRef<Array<HTMLDivElement | null>>([])

  const pageCount = pageMetrics.length

  useEffect(() => {
    let disposed = false
    const render = async () => {
      setLoading(true)
      setError(null)
      setPageMetrics([])

      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise
        if (disposed) return

        const metrics: PdfPageMetric[] = []
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })
          metrics.push({ width: viewport.width, height: viewport.height })
        }
        if (disposed) return
        setPageMetrics(metrics)

        requestAnimationFrame(async () => {
          for (let i = 0; i < metrics.length; i += 1) {
            const canvas = canvasRefs.current[i]
            if (!canvas || disposed) continue
            const page = await pdf.getPage(i + 1)
            const viewport = page.getViewport({ scale })
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext("2d")
            if (!ctx) continue
            await page.render({ canvasContext: ctx, viewport, canvas }).promise
          }
        })
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "Failed to load PDF.")
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void render()
    return () => {
      disposed = true
    }
  }, [pdfUrl, scale])

  const pageItems = useMemo(() => Array.from({ length: pageCount }, (_, idx) => idx + 1), [pageCount])

  return (
    <div className={cn("space-y-4", className)}>
      {loading && <div className="text-sm text-muted-foreground">Loading PDF pages...</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {pageItems.map((pageNumber, idx) => {
        const metric = pageMetrics[idx]
        if (!metric) return null
        return (
          <div
            key={pageNumber}
            ref={(el) => {
              pageRefs.current[idx] = el
            }}
            className={cn("relative rounded-lg border bg-card shadow-sm overflow-hidden", pageClassName)}
            style={{ width: metric.width }}
            onClick={(event) => {
              if (!onPageClick) return
              const rect = pageRefs.current[idx]?.getBoundingClientRect()
              if (!rect) return
              const relativeX = (event.clientX - rect.left) / rect.width
              const relativeY = (event.clientY - rect.top) / rect.height
              onPageClick({
                pageNumber,
                relativeX: Math.min(Math.max(relativeX, 0), 1),
                relativeY: Math.min(Math.max(relativeY, 0), 1),
              })
            }}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[idx] = el
              }}
            />
            <div className="absolute inset-0">{renderOverlay?.({ pageNumber, pageWidth: metric.width, pageHeight: metric.height })}</div>
            <div className="absolute right-2 top-2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
              Page {pageNumber}
            </div>
          </div>
        )
      })}
    </div>
  )
}
