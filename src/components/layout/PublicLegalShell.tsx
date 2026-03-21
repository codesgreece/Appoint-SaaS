import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

/** Ελάχιστο πλαίσιο για δημόσιες σελίδες (όροι / απόρρητο) χωρίς panel. */
export function PublicLegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/site" className="font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-primary via-primary to-purple-500 bg-clip-text text-transparent">
              Appoint SaaS
            </span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/site">Παρουσίαση</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  )
}
