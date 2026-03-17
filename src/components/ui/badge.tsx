import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        pending: "border-transparent bg-status-pending/15 text-[hsl(var(--status-pending))]",
        confirmed: "border-transparent bg-status-confirmed/15 text-[hsl(var(--status-confirmed))]",
        inProgress: "border-transparent bg-status-inProgress/15 text-[hsl(var(--status-inProgress))]",
        completed: "border-transparent bg-status-completed/15 text-[hsl(var(--status-completed))]",
        cancelled: "border-transparent bg-status-cancelled/15 text-[hsl(var(--status-cancelled))]",
        rescheduled: "border-transparent bg-status-rescheduled/15 text-[hsl(var(--status-rescheduled))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
