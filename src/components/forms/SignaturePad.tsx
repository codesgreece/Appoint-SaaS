import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

interface SignaturePadProps {
  value?: string | null
  onChange: (dataUrl: string) => void
  disabled?: boolean
}

export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(Boolean(value))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.strokeStyle = "#111827"
    ctx.lineWidth = 2
    ctx.lineCap = "round"

    if (value) {
      const image = new Image()
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      }
      image.src = value
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [value])

  const beginDraw = (x: number, y: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || disabled) return
    drawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const moveDraw = (x: number, y: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !drawingRef.current || disabled) return
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    setHasDrawn(true)
    onChange(canvas.toDataURL("image/png"))
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={420}
        height={140}
        className="w-full rounded border bg-white cursor-crosshair"
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          beginDraw(e.clientX - rect.left, e.clientY - rect.top)
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          moveDraw(e.clientX - rect.left, e.clientY - rect.top)
        }}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={(e) => {
          const touch = e.touches[0]
          const rect = e.currentTarget.getBoundingClientRect()
          beginDraw(touch.clientX - rect.left, touch.clientY - rect.top)
        }}
        onTouchMove={(e) => {
          e.preventDefault()
          const touch = e.touches[0]
          const rect = e.currentTarget.getBoundingClientRect()
          moveDraw(touch.clientX - rect.left, touch.clientY - rect.top)
        }}
        onTouchEnd={endDraw}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !hasDrawn}
          onClick={() => {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            if (!canvas || !ctx) return
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            setHasDrawn(false)
            onChange("")
          }}
        >
          Clear Signature
        </Button>
      </div>
    </div>
  )
}
