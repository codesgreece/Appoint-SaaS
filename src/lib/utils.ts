import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency,
  }).format(amount)
}

/** Calendar YYYY-MM-DD in the user's local timezone (not UTC). Use for `scheduled_date` filters. */
export function localIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("el-GR", {
    dateStyle: options?.dateStyle ?? "short",
    ...options,
  }).format(typeof date === "string" ? new Date(date) : date)
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date)
}
