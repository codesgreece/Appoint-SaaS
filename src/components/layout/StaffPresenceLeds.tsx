import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

type Props = {
  workingLive: number
  notWorking: number
  titleGreen: string
  titleRed: string
  labelLive: string
  labelOff: string
  className?: string
}

/** Compact status lamp: clean saturated colors + visible pulse (CSS) + subtle motion. */
function StatusLamp({ variant }: { variant: "green" | "red" }) {
  const isGreen = variant === "green"
  const reduce = useReducedMotion()

  return (
    <div className="relative h-4 w-4 shrink-0" aria-hidden>
      {/* Outer halo — obvious pulse */}
      <div
        className={cn(
          "absolute inset-[-3px] rounded-full",
          reduce ? "opacity-60" : isGreen ? "animate-led-halo-green" : "animate-led-halo-red",
          isGreen ? "bg-emerald-400/35" : "bg-rose-400/35",
        )}
      />
      {/* Core — flat vivid gradient, no muddy darks */}
      <motion.div
        className={cn(
          "relative h-4 w-4 rounded-full",
          "ring-1 ring-white/40",
          isGreen
            ? "bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),inset_0_-2px_4px_rgba(5,100,70,0.25)]"
            : "bg-gradient-to-br from-rose-300 via-rose-400 to-rose-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(159,18,57,0.25)]",
        )}
        animate={
          reduce
            ? {}
            : {
                boxShadow: isGreen
                  ? [
                      "inset 0 1px 2px rgba(255,255,255,0.55), 0 0 8px rgba(52,211,153,0.5)",
                      "inset 0 1px 3px rgba(255,255,255,0.65), 0 0 14px rgba(52,211,153,0.85)",
                      "inset 0 1px 2px rgba(255,255,255,0.55), 0 0 8px rgba(52,211,153,0.5)",
                    ]
                  : [
                      "inset 0 1px 2px rgba(255,255,255,0.5), 0 0 8px rgba(251,113,133,0.45)",
                      "inset 0 1px 3px rgba(255,255,255,0.6), 0 0 14px rgba(251,113,133,0.8)",
                      "inset 0 1px 2px rgba(255,255,255,0.5), 0 0 8px rgba(251,113,133,0.45)",
                    ],
              }
        }
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Specular dot */}
      <div className="pointer-events-none absolute left-[3px] top-[2px] h-[5px] w-[5px] rounded-full bg-white/70 blur-[0.5px]" />
    </div>
  )
}

function AnimatedCount({ value }: { value: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      key={value}
      initial={reduce ? false : { y: 3, opacity: 0.2 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="tabular-nums text-[11px] font-semibold leading-none tracking-tight text-foreground"
    >
      {value}
    </motion.span>
  )
}

export function StaffPresenceLeds({
  workingLive,
  notWorking,
  titleGreen,
  titleRed,
  labelLive,
  labelOff,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "inline-flex max-w-[100vw] items-stretch gap-0 rounded-xl",
        "border border-border/50 bg-card/90 px-0.5 py-0.5 shadow-sm",
        "backdrop-blur-sm",
        className,
      )}
      role="group"
      aria-label={`${titleGreen}: ${workingLive}. ${titleRed}: ${notWorking}.`}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 sm:gap-2 sm:px-2.5 sm:py-1"
        title={titleGreen}
      >
        <StatusLamp variant="green" />
        <div className="flex min-w-0 flex-col gap-0.5 leading-none">
          <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[8px]">
            {labelLive}
          </span>
          <AnimatedCount value={workingLive} />
        </div>
      </div>
      <div className="w-px shrink-0 bg-border/60" aria-hidden />
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 sm:gap-2 sm:px-2.5 sm:py-1"
        title={titleRed}
      >
        <StatusLamp variant="red" />
        <div className="flex min-w-0 flex-col gap-0.5 leading-none">
          <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[8px]">
            {labelOff}
          </span>
          <AnimatedCount value={notWorking} />
        </div>
      </div>
    </div>
  )
}
