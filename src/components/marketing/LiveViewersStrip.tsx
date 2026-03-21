import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"

const MIN = 80
const MAX = 120

function clamp(n: number) {
  return Math.min(MAX, Math.max(MIN, n))
}

/** Ενδεικτικός αριθμός «θεατών» για marketing — κινείται ελαφρά μεταξύ min/max. */
export function LiveViewersStrip({ className }: { className?: string }) {
  const [count, setCount] = useState(() => clamp(96 + Math.floor(Math.random() * 9)))

  useEffect(() => {
    let cancelled = false
    let tid: ReturnType<typeof setTimeout>

    const tick = () => {
      setCount((c) => {
        const moves = [-2, -1, -1, -1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2] as const
        const valid = moves.filter((d) => {
          const n = c + d
          return n >= MIN && n <= MAX
        })
        if (valid.length === 0) return c
        const delta = valid[Math.floor(Math.random() * valid.length)]!
        return c + delta
      })
    }

    const schedule = () => {
      tid = setTimeout(
        () => {
          if (cancelled) return
          tick()
          schedule()
        },
        1800 + Math.random() * 4200,
      )
    }

    schedule()
    return () => {
      cancelled = true
      clearTimeout(tid)
    }
  }, [])

  return (
    <>
      <div
        className={cn(
          "border-b border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.07] via-primary/[0.06] to-emerald-500/[0.07]",
          className,
        )}
        aria-hidden
        title="Ενδεικτικός δείκτης ενδιαφέροντος (marketing)"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2.5 px-4 py-2 text-center text-xs sm:text-sm md:justify-start">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Users className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{count}</span>{" "}
            <span className="hidden sm:inline">άτομα βλέπουν αυτή τη στιγμή αυτή τη σελίδα</span>
            <span className="sm:hidden">βλέπουν τώρα τη σελίδα</span>
          </p>
          <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400 md:inline-flex">
            live
          </span>
        </div>
      </div>
      <span className="sr-only">Ενδεικτικός δείκτης ενδιαφέροντος για τη σελίδα.</span>
    </>
  )
}
