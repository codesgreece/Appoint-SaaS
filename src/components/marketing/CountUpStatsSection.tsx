import { useEffect, useMemo, useRef, useState } from "react"
import { Building2, CalendarCheck2, Users, Wallet } from "lucide-react"

type StatKind = "numberPlus" | "currencyPlus"

type StatItem = {
  id: string
  label: string
  value: number
  kind: StatKind
  icon: React.ComponentType<{ className?: string }>
}

const STATS: StatItem[] = [
  {
    id: "businesses",
    label: "Ενεργές επιχειρήσεις",
    value: 180,
    kind: "numberPlus",
    icon: Building2,
  },
  {
    id: "appointments",
    label: "Κλεισμένα ραντεβού",
    value: 15413,
    kind: "numberPlus",
    icon: CalendarCheck2,
  },
  {
    id: "customers",
    label: "Καταχωρημένοι πελάτες",
    value: 16000,
    kind: "numberPlus",
    icon: Users,
  },
  {
    id: "transactions",
    label: "Συναλλαγές διαχείρισης",
    value: 18759,
    kind: "currencyPlus",
    icon: Wallet,
  },
]

function formatValue(value: number, kind: StatKind): string {
  const n = Math.max(0, Math.floor(value))
  const formatted = n.toLocaleString("el-GR")
  if (kind === "currencyPlus") return `${formatted}€+`
  return `${formatted}+`
}

export function CountUpStatsSection() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [hasStarted, setHasStarted] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [values, setValues] = useState<number[]>(() => STATS.map(() => 0))
  const durationMs = 1400
  const startValues = useMemo(() => STATS.map(() => 0), [])

  useEffect(() => {
    const node = sectionRef.current
    if (!node || hasAnimated) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setHasStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasAnimated])

  useEffect(() => {
    if (!hasStarted || hasAnimated) return
    let rafId = 0
    const startedAt = performance.now()
    const targets = STATS.map((s) => s.value)

    const tick = (now: number) => {
      const elapsed = now - startedAt
      const t = Math.min(1, elapsed / durationMs)
      // Smooth ease-out cubic.
      const eased = 1 - Math.pow(1 - t, 3)
      setValues(targets.map((target, i) => startValues[i] + (target - startValues[i]) * eased))
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setValues(targets)
        setHasAnimated(true)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [hasStarted, hasAnimated, startValues])

  return (
    <section ref={sectionRef} className="border-b border-border/40 bg-gradient-to-b from-background to-muted/20 py-14 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Appoint σε αριθμούς</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Αξιόπιστη καθημερινή λειτουργία για σύγχρονες υπηρεσίες</h2>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:gap-4">
          {STATS.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <article
                key={stat.id}
                className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur sm:p-5"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                  {formatValue(values[idx] ?? 0, stat.kind)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
