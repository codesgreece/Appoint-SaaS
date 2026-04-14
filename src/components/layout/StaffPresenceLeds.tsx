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

function PremiumLens({ variant }: { variant: "green" | "red" }) {
  const isGreen = variant === "green"
  const reduce = useReducedMotion()

  const glow = isGreen
    ? "shadow-[0_0_22px_rgba(16,185,129,0.55),0_0_42px_rgba(16,185,129,0.2),inset_0_-8px_16px_rgba(0,0,0,0.45)]"
    : "shadow-[0_0_22px_rgba(248,113,113,0.5),0_0_42px_rgba(248,113,113,0.18),inset_0_-8px_16px_rgba(0,0,0,0.45)]"

  return (
    <div className="relative h-8 w-8 shrink-0 [perspective:140px]" aria-hidden>
      {/* Bezel — brushed metal ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full p-[2px]",
          "bg-[conic-gradient(at_50%_120%,hsl(0_0%_100%_/_0.35),hsl(0_0%_45%_/_0.5),hsl(0_0%_12%_/_0.6),hsl(0_0%_75%_/_0.25),hsl(0_0%_100%_/_0.2))]",
        )}
      >
        <div className="h-full w-full rounded-full bg-gradient-to-b from-zinc-800/90 to-zinc-950/95 p-[1px] shadow-inner">
          <div className="relative h-full w-full overflow-hidden rounded-full">
            {/* Core emissive body */}
            <motion.div
              className={cn(
                "absolute inset-[2px] rounded-full",
                isGreen
                  ? "bg-[radial-gradient(circle_at_35%_28%,rgb(167,243,208)_0%,rgb(5,150,105)_38%,rgb(6,78,59)_100%)]"
                  : "bg-[radial-gradient(circle_at_35%_28%,rgb(254,202,202)_0%,rgb(220,38,38)_40%,rgb(69,10,10)_100%)]",
              )}
              style={{ transformStyle: "preserve-3d" }}
              animate={
                reduce
                  ? {}
                  : {
                      rotateX: [0, 11, 0, -8, 0],
                      rotateY: [0, -7, 5, 0],
                    }
              }
              transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Inner depth & glass */}
            <div
              className={cn(
                "pointer-events-none absolute inset-[2px] rounded-full",
                "shadow-[inset_0_5px_14px_rgba(255,255,255,0.42),inset_0_-10px_20px_rgba(0,0,0,0.55)]",
              )}
            />
            {/* Specular sweep */}
            {!reduce ? (
              <motion.div
                className="pointer-events-none absolute -left-1/2 top-0 h-[55%] w-[70%] rounded-full bg-gradient-to-br from-white/70 via-white/15 to-transparent blur-[1px]"
                animate={{ x: ["-20%", "120%", "-20%"], opacity: [0.15, 0.55, 0.15] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : (
              <div className="pointer-events-none absolute left-1/4 top-[12%] h-[40%] w-[45%] rounded-full bg-gradient-to-br from-white/45 to-transparent blur-[1px]" />
            )}
            {/* Bloom */}
            <motion.div
              className={cn("pointer-events-none absolute inset-[1px] rounded-full", glow)}
              animate={reduce ? {} : { opacity: [0.55, 1, 0.6, 0.95, 0.55], scale: [1, 1.04, 1, 1.03, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Rim highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AnimatedCount({ value }: { value: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      key={value}
      initial={reduce ? false : { scale: 0.82, opacity: 0.35 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      className="tabular-nums text-[12px] font-semibold tracking-tight text-foreground sm:text-[13px]"
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
        "inline-flex max-w-[100vw] items-stretch gap-0 overflow-hidden rounded-2xl",
        "border border-white/[0.07] bg-gradient-to-b from-card/95 via-card/85 to-muted/25",
        "shadow-[0_10px_36px_rgba(0,0,0,0.14),0_1px_0_rgba(255,255,255,0.06)_inset,0_-1px_0_rgba(0,0,0,0.12)_inset]",
        "backdrop-blur-md",
        className,
      )}
      role="group"
      aria-label={`${titleGreen}: ${workingLive}. ${titleRed}: ${notWorking}.`}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2"
        title={titleGreen}
      >
        <PremiumLens variant="green" />
        <div className="flex min-w-0 flex-col leading-none">
          <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-muted-foreground/90 sm:text-[9px]">
            {labelLive}
          </span>
          <AnimatedCount value={workingLive} />
        </div>
      </div>
      <div
        className="w-px shrink-0 bg-gradient-to-b from-transparent via-border/80 to-transparent"
        aria-hidden
      />
      <div
        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2"
        title={titleRed}
      >
        <PremiumLens variant="red" />
        <div className="flex min-w-0 flex-col leading-none">
          <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-muted-foreground/90 sm:text-[9px]">
            {labelOff}
          </span>
          <AnimatedCount value={notWorking} />
        </div>
      </div>
    </div>
  )
}
