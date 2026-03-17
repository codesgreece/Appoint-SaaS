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
