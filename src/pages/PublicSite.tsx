import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Check, Gift, Menu, Sparkles, Target, TrendingUp, X, Zap } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BILLING_PERIODS,
  CLOSING_CTA,
  COMPARISON_ROWS,
  FEATURE_SECTIONS,
  getWhatsAppChatUrl,
  HERO,
  PERSONAS,
  PLAN_PRICES_EUR,
  PLANS,
  PRICE_DISCLAIMER,
  PRICING_PROMOS,
  VALUE_PILLS,
  WHATSAPP,
  type PlanId,
} from "@/data/publicSiteContent"
import { LiveViewersStrip } from "@/components/marketing/LiveViewersStrip"
import { CountUpStatsSection } from "@/components/marketing/CountUpStatsSection"
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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      />
    </svg>
  )
}

export default function PublicSite() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/site" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Appoint SaaS
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
            <a href="#why" className="hover:text-foreground transition-colors">
              Γιατί Appoint
            </a>
            <a href="#personas" className="hover:text-foreground transition-colors">
              Για ποιους
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Λειτουργίες
            </a>
            <a href="#compare" className="hover:text-foreground transition-colors">
              Σύγκριση
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Πακέτα
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen((o) => !o)}>
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
              <a href="#pricing">Τιμές</a>
            </Button>
            <Button size="sm" className="shadow-md shadow-primary/20" asChild>
              <a href="#compare">Σύγκριση πακέτων</a>
            </Button>
            <Button
              size="sm"
              className="hidden gap-1.5 bg-[#25D366] text-white hover:bg-[#20BD5A] sm:inline-flex"
              asChild
            >
              <a href={getWhatsAppChatUrl()} target="_blank" rel="noopener noreferrer" aria-label={WHATSAPP.buttonLabel}>
                <WhatsAppIcon className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="border-t border-border/60 bg-background px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-2 text-sm">
              <a href="#why" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Γιατί Appoint
              </a>
              <a href="#personas" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Για ποιους
              </a>
              <a href="#features" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Λειτουργίες
              </a>
              <a href="#compare" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Σύγκριση
              </a>
              <a href="#pricing" className="py-1" onClick={() => setMobileNavOpen(false)}>
                Πακέτα
              </a>
              <a
                href={getWhatsAppChatUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 py-2 pl-2 font-medium text-[#128C7E] dark:text-[#25D366]"
                onClick={() => setMobileNavOpen(false)}
              >
                <WhatsAppIcon className="h-4 w-4" />
                WhatsApp — δοκιμή / αγορά
              </a>
            </div>
          </div>
        )}
      </header>

      <LiveViewersStrip />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute top-1/4 right-0 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Badge className="mb-4 border border-primary/30 bg-primary/15 px-3 py-1 text-primary hover:bg-primary/20">
              {HERO.badge}
            </Badge>
            <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl lg:leading-[1.1]">
              {HERO.headlineLead}{" "}
              <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
                {HERO.headlineHighlight}
              </span>
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {HERO.subheadline}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button size="lg" className="h-12 bg-gradient-to-r from-primary to-purple-600 px-8 text-base shadow-lg shadow-primary/25" asChild>
                <a href="#features">{HERO.ctaPrimary}</a>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                <a href="#compare">{HERO.ctaSecondary}</a>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-3 text-xs text-muted-foreground md:text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-foreground/90">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Όλα σε ένα πάνελ
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-foreground/90">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                Έτοιμο για κράτηση online
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-foreground/90">
                <Target className="h-3.5 w-3.5 text-primary" />
                Για μικρές & μεγάλες ομάδες
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value pills */}
      <section id="why" className="scroll-mt-24 border-b border-border/40 bg-gradient-to-b from-muted/30 to-background py-14 md:py-18">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            Γιατί αξίζει να αφήσετε τα χάρτινα και τα χύμα μηνύματα
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Λιγότερη σπατάλη χρόνου, πιο καθαρή εικόνα — ώστε εσείς και η ομάδα σας να εστιάζετε στον πελάτη, όχι στη
            διαχείριση χάους.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PILLS.map((pill, i) => (
              <motion.div
                key={pill.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur"
              >
                <p className="font-semibold text-foreground">{pill.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pill.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CountUpStatsSection />

      {/* Personas */}
      <section id="personas" className="scroll-mt-24 border-b border-border/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Τι «πονάει» στον κλάδο σας — και πώς βοηθάμε</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Δεν είναι όλες οι επιχειρήσεις ίδιες. Γι’ αυτό το Appoint SaaS καλύπτει διαφορετικές ανάγκες με την ίδια
            σταθερή βάση.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {PERSONAS.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-6 md:p-7"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl" aria-hidden>
                    {p.emoji}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold"> {p.title}</h3>
                    <p className="mt-2 text-sm text-destructive/90">
                      <span className="font-medium text-foreground">Πρόβλημα: </span>
                      {p.pain}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Λύση με Appoint: </span>
                      {p.gain}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 border-b border-border/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Λειτουργίες σε βάθος</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Αναλυτική περιγραφή — ώστε να ξέρετε τι παίρνετε πριν μιλήσετε με τον διαχειριστή σας για την ενεργοποίηση.
          </p>
          <div className="mt-12 space-y-12">
            {FEATURE_SECTIONS.map((block, i) => (
              <motion.article
                key={block.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.03, 0.25) }}
                className="rounded-2xl border border-border/60 bg-card/50 p-6 shadow-sm backdrop-blur-sm md:p-9"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Λειτουργία</p>
                <h3 className="mt-1 text-2xl font-bold md:text-3xl">{block.title}</h3>
                <p className="mt-2 text-lg font-medium text-foreground/95">{block.hook}</p>
                {block.pain ? (
                  <div className="mt-4 rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Πραγματικός πόνος: </span>
                    {block.pain}
                  </div>
                ) : null}
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">{block.summary}</p>
                <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
                  {block.bullets.map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {block.idealFor ? (
                  <p className="mt-5 text-sm italic text-muted-foreground">
                    <span className="font-medium not-italic text-foreground">Μάλλον για σας αν: </span>
                    {block.idealFor}
                  </p>
                ) : null}
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="border-b border-border/40 bg-gradient-to-b from-primary/10 via-background to-purple-500/5 py-14 md:py-18">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Ένα εργαλείο που πληρώνεται με ηρεμία και ακρίβεια</h2>
          <p className="mt-2 text-muted-foreground">
            Όταν ο χρόνος πάνελ γίνεται παραγωγικός, η επιχείρηση «αναπνέει». Δείτε τα πακέτα και τις ενδεικτικές τιμές
            παρακάτω — επιλέγετε μαζί με τον πάροχό σας το πλάνο που ταιριάζει στο μέγεθός σας.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="#pricing">Δείτε πακέτα & τιμές</a>
            </Button>
            <Button size="lg" className="gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A]" asChild>
              <a href={getWhatsAppChatUrl()} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="h-5 w-5" />
                {WHATSAPP.buttonLabel}
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="scroll-mt-24 border-b border-border/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Σύγκριση πακέτων</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">{PRICE_DISCLAIMER}</p>
          <div className="mt-10 overflow-x-auto rounded-xl border border-border/60 bg-card/30 shadow-inner">
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

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Τιμές πακέτων — ανά περίοδο</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Κάθε κελί είναι το <strong>συνολικό ποσό</strong> για την επιλεγμένη περίοδο (όχι μηνιαία χρέωση). Η ενεργοποίηση
            γίνεται με τον διαχειριστή της πλατφόρμας ή μέσω της ροής εγγραφής όπου υπάρχει.
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-muted-foreground">{PRICE_DISCLAIMER}</p>

          {/* Προσφορές */}
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.07] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <Gift className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-semibold text-foreground">{PRICING_PROMOS.trialTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{PRICING_PROMOS.trialBody}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/35 bg-primary/[0.06] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <Gift className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">{PRICING_PROMOS.longTermTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{PRICING_PROMOS.longTermBody}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-5 md:p-6">
              <p className="font-semibold text-foreground">{PRICING_PROMOS.freeInstallTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{PRICING_PROMOS.freeInstallBody}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 p-5 md:p-6">
              <p className="font-semibold text-foreground">{PRICING_PROMOS.freeOnboardingTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{PRICING_PROMOS.freeOnboardingBody}</p>
            </div>
          </div>

          {/* Πίνακας τιμών */}
          <div className="mt-12 overflow-x-auto rounded-xl border border-border/60 bg-card/30 shadow-inner">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[120px] font-semibold">Πακέτο</TableHead>
                  {BILLING_PERIODS.map((bp) => (
                    <TableHead key={bp.id} className="min-w-[100px] text-center font-semibold">
                      {bp.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {planOrder.map((pid) => {
                  const p = PLANS.find((x) => x.id === pid)!
                  return (
                    <TableRow key={pid}>
                      <TableCell className={cn("font-medium", p.highlight && "bg-primary/5")}>
                        {p.name}
                        {p.highlight ? (
                          <Badge className="ml-2 align-middle text-[10px]">Συχνή επιλογή</Badge>
                        ) : null}
                      </TableCell>
                      {BILLING_PERIODS.map((bp) => (
                        <TableCell
                          key={bp.id}
                          className={cn("text-center tabular-nums", p.highlight && "bg-primary/5")}
                        >
                          {PLAN_PRICES_EUR[pid][bp.id]} €
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Παράδειγμα: με πακέτο 6 μηνών ενεργοποιείτε την πληρωμή της περιόδου — ενδέχεται να ισχύουν +2 μήνες δώρο·
            ρωτήστε τον διαχειριστή για την ακριβή εφαρμογή στον λογαριασμό σας.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col border-border/60 bg-card/60 backdrop-blur transition-transform hover:-translate-y-0.5",
                  plan.highlight && "ring-2 ring-primary/50 shadow-xl shadow-primary/15 md:scale-[1.02]",
                )}
              >
                {plan.highlight && (
                  <Badge className="mx-auto -mt-2 w-fit bg-gradient-to-r from-primary to-purple-600">Συχνή επιλογή</Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-base">{plan.tagline}</CardDescription>
                  <p className="pt-2 text-lg font-bold tracking-tight text-foreground">{plan.priceLabel}</p>
                  <p className="text-xs text-muted-foreground">Δείτε τον πίνακα πάνω για 3, 6 και 12 μήνες.</p>
                  <p className="pt-2 text-sm leading-relaxed text-muted-foreground">{plan.valuePitch}</p>
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
                    Για δοκιμή ή αγορά επικοινωνήστε μέσω WhatsApp ή με τον διαχειριστή — δεν υπάρχει κουμπί πληρωμής σε αυτή τη
                    σελίδα.
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

      {/* Closing */}
      <section className="border-t border-border/60 bg-muted/20 py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">{CLOSING_CTA.headline}</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">{CLOSING_CTA.subtext}</p>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <a href="#pricing">{CLOSING_CTA.anchor}</a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background py-10">
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

      {/* Floating WhatsApp — πάντα πρόσβαση σε κινητό */}
      <a
        href={getWhatsAppChatUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 ring-2 ring-background transition hover:scale-105 hover:bg-[#20BD5A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
        aria-label={WHATSAPP.buttonLabel}
      >
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </div>
  )
}
