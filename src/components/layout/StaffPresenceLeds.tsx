import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type Props = {
  workingLive: number
  notWorking: number
  titleGreen: string
  titleRed: string
  className?: string
}

function Led3d({ variant }: { variant: "green" | "red" }) {
  const isGreen = variant === "green"
  return (
    <div
      className="relative h-7 w-7 shrink-0 [perspective:120px]"
      aria-hidden
    >
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full border border-white/20",
          isGreen
            ? "bg-gradient-to-b from-emerald-200 via-emerald-500 to-emerald-900"
            : "bg-gradient-to-b from-rose-200 via-red-500 to-red-950",
        )}
        style={{ transformStyle: "preserve-3d" }}
        animate={{
          rotateX: [0, 14, 0, -10, 0],
          rotateY: [0, -6, 4, 0],
          scale: [1, 1.06, 1, 1.04, 1],
        }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_3px_10px_rgba(255,255,255,0.45),inset_0_-6px_12px_rgba(0,0,0,0.35)]",
        )}
      />
      <motion.div
        className={cn(
          "pointer-events-none absolute left-1/2 top-[18%] h-[28%] w-[42%] -translate-x-1/2 rounded-full bg-white/55 blur-[2px]",
        )}
        animate={{ opacity: [0.45, 0.85, 0.5, 0.75, 0.45] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full",
          isGreen ? "shadow-[0_0_14px_rgba(34,197,94,0.6)]" : "shadow-[0_0_14px_rgba(239,68,68,0.55)]",
        )}
        animate={{
          opacity: [0.35, 0.95, 0.4, 0.85, 0.35],
          scale: [1, 1.06, 1, 1.05, 1],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  )
}

export function StaffPresenceLeds({ workingLive, notWorking, titleGreen, titleRed, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex max-w-[100vw] items-center gap-1.5 sm:gap-2 rounded-full border border-border/60 bg-card/80 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-[11px]",
        className,
      )}
      role="group"
      aria-label={`${titleGreen}: ${workingLive}. ${titleRed}: ${notWorking}.`}
    >
      <div className="flex items-center gap-1" title={titleGreen}>
        <Led3d variant="green" />
        <span className="min-w-[1.1rem] tabular-nums font-semibold text-foreground">{workingLive}</span>
      </div>
      <span className="text-muted-foreground/60">|</span>
      <div className="flex items-center gap-1" title={titleRed}>
        <Led3d variant="red" />
        <span className="min-w-[1.1rem] tabular-nums font-semibold text-foreground">{notWorking}</span>
      </div>
    </div>
  )
}
