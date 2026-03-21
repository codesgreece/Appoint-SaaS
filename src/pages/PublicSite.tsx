import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Check, Menu, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  COMPARISON_ROWS,
  FEATURE_SECTIONS,
  PLANS,
  PRICE_DISCLAIMER,
  type PlanId,
} from "@/data/publicSiteContent"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const planOrder: PlanId[] = ["starter", "pro", "premium"]

export default function PublicSite() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/site" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Appoint SaaS
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition-colors">
              Λειτουργίες
            </a>
            <a href="#compare" className="hover:text-foreground transition-colors">
              Σύγκριση
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Πακέτα & τιμές
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen((o) => !o)}>
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
              <a href="#compare">Σύγκριση</a>
            </Button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="border-t border-border/60 bg-background px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2 text-sm">
              <a href="#features" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Λειτουργίες
              </a>
              <a href="#compare" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Σύγκριση
              </a>
              <a href="#pricing" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Πακέτα
              </a>
            </div>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden border-b border-border/40">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-purple-500/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Badge variant="secondary" className="mb-4 border border-primary/25 bg-primary/10 text-primary">
              Αυτόνομη παρουσίαση · μόνο ενημέρωση (χωρίς σύνδεση στην εφαρμογή)
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Όλα όσα προσφέρει το{" "}
              <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
                Appoint SaaS
              </span>{" "}
              για την επιχείρησή σας
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Διαβάστε αναλυτικά τις λειτουργίες, συγκρίνετε τα πακέτα και τις ενδεικτικές τιμές. Η ενεργοποίηση γίνεται
              μόνο μέσω διαχειριστή — εδώ δεν πραγματοποιείται καμία αγορά.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 shadow-lg" asChild>
                <a href="#features">Δείτε τις λειτουργίες</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#compare">Πίνακας σύγκρισης</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features detail */}
      <section id="features" className="scroll-mt-24 border-b border-border/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Τι προσφέρει η εφαρμογή</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Αναλυτική περιγραφή ανά περιοχή λειτουργίας. Η πρόσβαση στην εφαρμογή γίνεται με λογαριασμό που χορηγεί ο
            διαχειριστής — όχι μέσω αυτής της σελίδας.
          </p>
          <div className="mt-12 space-y-10">
            {FEATURE_SECTIONS.map((block, i) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="rounded-2xl border border-border/60 bg-card/40 p-6 md:p-8 backdrop-blur-sm"
              >
                <h3 className="text-xl font-semibold md:text-2xl">{block.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{block.summary}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {block.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="compare" className="scroll-mt-24 border-b border-border/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Σύγκριση πακέτων</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">{PRICE_DISCLAIMER}</p>
          <div className="mt-10 overflow-x-auto rounded-xl border border-border/60 bg-card/30">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[200px] font-semibold">Χαρακτηριστικό</TableHead>
                  {planOrder.map((pid) => {
                    const p = PLANS.find((x) => x.id === pid)!
                    return (
                      <TableHead key={pid} className={cn("min-w-[120px] text-center", p.highlight && "bg-primary/10")}>
                        <span className="font-semibold">{p.name}</span>
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON_ROWS.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    {planOrder.map((pid) => (
                      <TableCell
                        key={pid}
                        className={cn(
                          "text-center text-sm",
                          PLANS.find((x) => x.id === pid)?.highlight && "bg-primary/5",
                        )}
                      >
                        {row.values[pid]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {/* Pricing cards — informational only */}
      <section id="pricing" className="scroll-mt-24 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Ενδεικτικές τιμές πακέτων</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">{PRICE_DISCLAIMER}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col border-border/60 bg-card/50 backdrop-blur",
                  plan.highlight && "ring-2 ring-primary/50 shadow-xl shadow-primary/10 md:scale-[1.02]",
                )}
              >
                {plan.highlight && (
                  <Badge className="mx-auto -mt-2 w-fit bg-gradient-to-r from-primary to-purple-600">Συχνή επιλογή</Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.tagline}</CardDescription>
                  <p className="pt-2 text-2xl font-bold tracking-tight text-foreground">{plan.priceLabel}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      Έως {plan.maxUsers} χρήστες
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      Έως {plan.maxCustomers.toLocaleString("el-GR")} πελάτες
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      Έως {plan.maxAppointments.toLocaleString("el-GR")} ραντεβού
                    </li>
                  </ul>
                  <p className="mt-auto rounded-lg border border-dashed border-border/80 bg-muted/30 p-3 text-xs leading-relaxed">
                    Δεν υπάρχει κουμπί αγοράς. Η συνδρομή και η πρόσβαση στο πάνελ γίνονται μόνο μέσω του διαχειριστή της
                    πλατφόρμας.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Ενδέχεται να υπάρχουν πακέτα Demo ή Premium+ με προσαρμοσμένα όρια — κατόπιν συνεννόησης με τον διαχειριστή.
          </p>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-muted/20 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
          <span>© {new Date().getFullYear()} Appoint SaaS</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/terms" className="hover:text-foreground">
              Όροι χρήσης
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Απόρρητο
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
