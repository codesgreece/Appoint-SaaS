import { useEffect, useMemo, useState } from "react"
import { Lightbulb, Bug, Send, History } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { SupportRequest } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ChangelogCard } from "@/components/ChangelogCard"

export default function Support() {
  const { businessId, user, businessName } = useAuth()
  const { toast } = useToast()
  const [suggestionText, setSuggestionText] = useState("")
  const [issueText, setIssueText] = useState("")
  const [sending, setSending] = useState<"suggestion" | "issue" | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SupportRequest[]>([])

  useEffect(() => {
    if (!businessId) return
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("support_requests")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(50)
        if (!active) return
        if (error) throw error
        setRows((data ?? []) as SupportRequest[])
      } catch (e) {
        console.error("Support fetch error:", e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [businessId])

  const openCount = useMemo(() => rows.filter((r) => r.status === "open").length, [rows])

  async function refresh() {
    if (!businessId) return
    const { data } = await supabase
      .from("support_requests")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50)
    setRows((data ?? []) as SupportRequest[])
  }

  async function submit(type: "suggestion" | "issue") {
    if (!businessId || !user) return
    const text = (type === "suggestion" ? suggestionText : issueText).trim()
    if (!text) {
      toast({ title: "Σφάλμα", description: "Γράψτε το μήνυμα πριν την αποστολή.", variant: "destructive" })
      return
    }
    try {
      setSending(type)
      const payload = {
        business_id: businessId,
        created_by: user.id,
        type,
        message: text,
        business_name: businessName ?? null,
        created_by_name: user.full_name ?? null,
        created_by_username: user.username ?? null,
      }
      const { error } = await supabase.from("support_requests").insert(payload)
      if (error) throw error
      type === "suggestion" ? setSuggestionText("") : setIssueText("")
      toast({ title: "Εστάλη", description: type === "suggestion" ? "Η πρόταση καταχωρήθηκε." : "Το πρόβλημα καταχωρήθηκε." })
      await refresh()
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία αποστολής", variant: "destructive" })
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
          <History className="h-4 w-4 text-primary" />
          {businessName ?? "Επιχείρηση"} • Υποστήριξη
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl md:text-[26px] font-semibold tracking-tight">Υποστήριξη</h1>
          <Badge variant="secondary" className="border border-border/60 bg-background/60 backdrop-blur text-[11px]">
            {openCount} ανοιχτά αιτήματα
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Premium support για την επιχείρησή σου – στείλε πρόταση ή αναφορά προβλήματος.
        </p>
        <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/60 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <span>Πρόταση βελτίωσης</span>
              </span>
              <Badge variant="outline" className="text-[11px] border-primary/30 text-primary bg-primary/5">
                UX / Features
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Label className="text-xs text-muted-foreground">Μήνυμα</Label>
            <Textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Π.χ. Θα ήθελα πιο γρήγορο τρόπο για να κλείνω επαναλαμβανόμενα ραντεβού..."
              className="bg-background/60 border-border/60 focus-visible:ring-primary/30 min-h-[120px] text-sm"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Οι προτάσεις σου μας βοηθούν να βελτιώνουμε την πλατφόρμα.</span>
              <Button type="button" size="sm" onClick={() => submit("suggestion")} disabled={sending !== null}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {sending === "suggestion" ? "Αποστολή..." : "Αποστολή"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <Bug className="h-4 w-4 text-destructive" />
                <span>Αναφορά προβλήματος</span>
              </span>
              <Badge variant="outline" className="text-[11px] border-destructive/30 text-destructive bg-destructive/5">
                Bugs / Σφάλματα
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Label className="text-xs text-muted-foreground">Μήνυμα</Label>
            <Textarea
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              placeholder="Π.χ. Στη σελίδα Ραντεβού, όταν πατάω “Αποθήκευση” δεν κλείνει η φόρμα..."
              className="bg-background/60 border-border/60 focus-visible:ring-destructive/40 min-h-[120px] text-sm"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Πρόσθεσε όσο περισσότερες λεπτομέρειες μπορείς (βήματα, browser κ.λπ.).</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => submit("issue")}
                disabled={sending !== null}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {sending === "issue" ? "Αποστολή..." : "Αποστολή"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm">Ιστορικό αιτημάτων</CardTitle>
            <p className="text-[11px] text-muted-foreground">Δες τις τελευταίες προτάσεις και αναφορές σου.</p>
          </div>
          <Tabs defaultValue="all">
            <TabsList className="bg-card/60 border border-border/60 backdrop-blur text-[11px]">
              <TabsTrigger value="all">Όλα</TabsTrigger>
              <TabsTrigger value="open">Ανοιχτά</TabsTrigger>
              <TabsTrigger value="resolved">Ολοκληρωμένα</TabsTrigger>
            </TabsList>
            <TabsContent value="all" />
            <TabsContent value="open" />
            <TabsContent value="resolved" />
          </Tabs>
        </CardHeader>
        <CardContent className="text-sm">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Δεν υπάρχουν αιτήματα ακόμα.</p>
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 12).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-xs flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={r.type === "issue" ? "destructive" : "secondary"}
                        className="border border-border/60 text-[11px]"
                      >
                        {r.type === "issue" ? "Πρόβλημα" : "Πρόταση"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "open"
                            ? "text-[11px] border-amber-400/50 text-amber-500 bg-amber-500/5"
                            : r.status === "resolved"
                              ? "text-[11px] border-emerald-400/50 text-emerald-500 bg-emerald-500/5"
                              : "text-[11px] border-border/60"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-[12px] leading-snug">{r.message}</p>
                    {r.internal_notes?.trim() ? (
                      <div className="mt-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Απάντηση από την υποστήριξη
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug text-foreground">
                          {r.internal_notes.trim()}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {rows.length > 12 ? (
                <p className="text-xs text-muted-foreground">Εμφανίζονται τα 12 πιο πρόσφατα.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <ChangelogCard />
    </div>
  )
}

