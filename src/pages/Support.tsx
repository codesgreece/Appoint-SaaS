import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Lightbulb, Bug, Send, History, HelpCircle, FileText, ShieldCheck } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { SupportRequest, SupportRequestMessage } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ChangelogCard } from "@/components/ChangelogCard"
import { notifyInAppQuiet } from "@/services/api"
import FAQ from "@/pages/FAQ"
import Terms from "@/pages/Terms"
import PrivacyPolicy from "@/pages/PrivacyPolicy"

export default function Support() {
  const { businessId, user, businessName } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [suggestionText, setSuggestionText] = useState("")
  const [issueText, setIssueText] = useState("")
  const [sending, setSending] = useState<"suggestion" | "issue" | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SupportRequest[]>([])
  const [messagesByRequestId, setMessagesByRequestId] = useState<Record<string, SupportRequestMessage[]>>({})
  const [draftByRequestId, setDraftByRequestId] = useState<Record<string, string>>({})
  const [chatSendingId, setChatSendingId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<"all" | "open" | "resolved">("all")

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
        const nextRows = (data ?? []) as SupportRequest[]
        setRows(nextRows)

        const ids = nextRows.map((r) => r.id)
        if (ids.length === 0) {
          setMessagesByRequestId({})
          return
        }

        const { data: msgData, error: msgError } = await supabase
          .from("support_request_messages")
          .select("*")
          .in("support_request_id", ids)
          .order("created_at", { ascending: true })
        if (msgError) throw msgError

        const grouped: Record<string, SupportRequestMessage[]> = {}
        ;(msgData ?? []).forEach((m) => {
          const mm = m as SupportRequestMessage
          if (!grouped[mm.support_request_id]) grouped[mm.support_request_id] = []
          grouped[mm.support_request_id].push(mm)
        })
        setMessagesByRequestId(grouped)
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

  const ticketFromQuery = searchParams.get("ticket")

  useEffect(() => {
    if (!ticketFromQuery || loading) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(`support-req-${ticketFromQuery}`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete("ticket")
          return next
        },
        { replace: true },
      )
    }, 120)
    return () => window.clearTimeout(t)
  }, [ticketFromQuery, loading, rows, setSearchParams])

  const openCount = useMemo(() => rows.filter((r) => r.status === "open").length, [rows])
  const filteredRows = useMemo(() => {
    if (historyFilter === "all") return rows
    return rows.filter((r) => r.status === historyFilter)
  }, [rows, historyFilter])

  async function refresh() {
    if (!businessId) return
    const { data } = await supabase
      .from("support_requests")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50)

    const nextRows = (data ?? []) as SupportRequest[]
    setRows(nextRows)

    const ids = nextRows.map((r) => r.id)
    if (ids.length === 0) {
      setMessagesByRequestId({})
      return
    }

    const { data: msgData, error: msgError } = await supabase
      .from("support_request_messages")
      .select("*")
      .in("support_request_id", ids)
      .order("created_at", { ascending: true })

    if (msgError) {
      console.error("Support messages fetch error:", msgError)
      setMessagesByRequestId({})
      return
    }

    const grouped: Record<string, SupportRequestMessage[]> = {}
    ;(msgData ?? []).forEach((m) => {
      const mm = m as SupportRequestMessage
      if (!grouped[mm.support_request_id]) grouped[mm.support_request_id] = []
      grouped[mm.support_request_id].push(mm)
    })
    setMessagesByRequestId(grouped)
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
      const { data: inserted, error } = await supabase.from("support_requests").insert(payload).select("id").single()
      if (error) throw error
      if (inserted?.id) {
        await notifyInAppQuiet(
          businessId,
          type === "suggestion"
            ? "Νέο αίτημα υποστήριξης (πρόταση)"
            : "Νέο αίτημα υποστήριξης (πρόβλημα)",
          { notificationType: "support_request", relatedSupportRequestId: inserted.id as string },
        )
      }
      type === "suggestion" ? setSuggestionText("") : setIssueText("")
      toast({ title: "Εστάλη", description: type === "suggestion" ? "Η πρόταση καταχωρήθηκε." : "Το πρόβλημα καταχωρήθηκε." })
      await refresh()
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία αποστολής", variant: "destructive" })
    } finally {
      setSending(null)
    }
  }

  async function sendChatMessage(requestId: string) {
    if (!businessId || !user) return
    const content = (draftByRequestId[requestId] ?? "").trim()
    if (!content) {
      toast({ title: "Σφάλμα", description: "Γράψτε ένα μήνυμα πριν την αποστολή.", variant: "destructive" })
      return
    }

    setChatSendingId(requestId)
    try {
      const payload = {
        support_request_id: requestId,
        business_id: businessId,
        sender_user_id: user.id,
        sender_role: "admin" as const,
        content,
      }

      const { error } = await supabase.from("support_request_messages").insert(payload)
      if (error) throw error

      setDraftByRequestId((prev) => ({ ...prev, [requestId]: "" }))
      // Status is controlled only by super_admin (incident closes only when super_admin marks it resolved).
      await refresh()
      toast({ title: "Εστάλη", description: "Το μήνυμα καταχωρήθηκε." })
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία αποστολής", variant: "destructive" })
    } finally {
      setChatSendingId((prev) => (prev === requestId ? null : prev))
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
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

      <Tabs defaultValue="support" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Support requests</p>
              <p className="text-xl font-semibold tracking-tight">{rows.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/60">
            <CardContent className="py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ανοιχτά</p>
              <p className="text-xl font-semibold tracking-tight">{openCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/60">
            <CardContent className="py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Knowledge base</p>
              <p className="text-xl font-semibold tracking-tight">FAQ + Νομικά</p>
            </CardContent>
          </Card>
        </div>

        <TabsList className="h-auto w-full max-w-full justify-start overflow-x-auto whitespace-nowrap bg-card/60 border border-border/60 backdrop-blur text-[11px] p-1">
          <TabsTrigger value="support" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Υποστήριξη
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Όροι Χρήσης
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Πολιτική Απορρήτου
          </TabsTrigger>
        </TabsList>

        <TabsContent value="support" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60 bg-card/60 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <CardHeader className="space-y-1">
                <CardTitle className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
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
                  className="bg-background/60 border-border/60 focus-visible:ring-primary/30 min-h-[120px] text-base md:text-sm"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground">
                  <span className="pr-1">Οι προτάσεις σου μας βοηθούν να βελτιώνουμε την πλατφόρμα.</span>
                  <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => submit("suggestion")} disabled={sending !== null}>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    {sending === "suggestion" ? "Αποστολή..." : "Αποστολή"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <CardHeader className="space-y-1">
                <CardTitle className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
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
                  className="bg-background/60 border-border/60 focus-visible:ring-destructive/40 min-h-[120px] text-base md:text-sm"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground">
                  <span className="pr-1">Πρόσθεσε όσο περισσότερες λεπτομέρειες μπορείς (βήματα, browser κ.λπ.).</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
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
            <CardHeader className="space-y-3">
              <div className="space-y-1">
                <CardTitle className="text-sm">Ιστορικό αιτημάτων</CardTitle>
                <p className="text-[11px] text-muted-foreground">Δες τις τελευταίες προτάσεις και αναφορές σου.</p>
              </div>
              <div className="flex w-full flex-wrap gap-2">
                <Button
                  type="button"
                  variant={historyFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHistoryFilter("all")}
                >
                  Όλα
                </Button>
                <Button
                  type="button"
                  variant={historyFilter === "open" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHistoryFilter("open")}
                >
                  Ανοιχτά
                </Button>
                <Button
                  type="button"
                  variant={historyFilter === "resolved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHistoryFilter("resolved")}
                >
                  Ολοκληρωμένα
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : filteredRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Δεν υπάρχουν αιτήματα ακόμα.</p>
              ) : (
                <div className="space-y-2">
                  {filteredRows.map((r) => (
                    <div
                      key={r.id}
                      id={`support-req-${r.id}`}
                      className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-xs"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
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
                        <div className="mt-2 rounded-xl border border-border/60 bg-background/40 p-2 overflow-hidden">
                          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                            <div className="flex justify-end">
                              <div className="max-w-[88%] rounded-2xl rounded-br-md border border-border/50 bg-background/70 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Εσυ</p>
                                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug">{r.message}</p>
                              </div>
                            </div>

                            {(messagesByRequestId[r.id] ?? []).map((m, idx, msgs) => {
                              const firstUnreadSupportIdx = r.has_unread_reply
                                ? msgs.findIndex((x) => x.sender_role === "super_admin")
                                : -1

                              return (
                                <div key={m.id}>
                                  {idx === firstUnreadSupportIdx ? (
                                    <div className="mb-2 flex items-center gap-2 py-1">
                                      <div className="h-px flex-1 bg-primary/25" />
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                                        Μη αναγνωσμένα
                                      </span>
                                      <div className="h-px flex-1 bg-primary/25" />
                                    </div>
                                  ) : null}
                                  <div className={m.sender_role === "super_admin" ? "flex justify-start" : "flex justify-end"}>
                                    <div
                                      className={
                                        m.sender_role === "super_admin"
                                          ? "max-w-[88%] rounded-2xl rounded-bl-md border border-primary/25 bg-primary/5 px-3 py-2"
                                          : "max-w-[88%] rounded-2xl rounded-br-md border border-border/50 bg-background/70 px-3 py-2"
                                      }
                                    >
                                      <p
                                        className={
                                          m.sender_role === "super_admin"
                                            ? "text-[10px] font-semibold uppercase tracking-wide text-primary"
                                            : "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                                        }
                                      >
                                        {m.sender_role === "super_admin" ? "Υποστήριξη" : "Εσυ"}
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug">{m.content}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}

                            {r.internal_notes?.trim() && (messagesByRequestId[r.id] ?? []).length === 0 ? (
                              <div className="flex justify-start">
                                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-primary/25 bg-primary/5 px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Απάντηση από την υποστήριξη</p>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground">{r.internal_notes.trim()}</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {r.status !== "resolved" && (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              value={draftByRequestId[r.id] ?? ""}
                              onChange={(e) => setDraftByRequestId((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              placeholder="Στείλε ένα μήνυμα..."
                              className="bg-background/40 border-border/60 focus-visible:ring-primary/30 min-h-[92px] text-base md:text-sm"
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => sendChatMessage(r.id)}
                                disabled={chatSendingId === r.id}
                              >
                                {chatSendingId === r.id ? "Αποστολή..." : "Αποστολή"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ChangelogCard />
        </TabsContent>

        <TabsContent value="faq">
          <FAQ />
        </TabsContent>
        <TabsContent value="terms">
          <Terms />
        </TabsContent>
        <TabsContent value="privacy">
          <PrivacyPolicy />
        </TabsContent>
      </Tabs>
    </div>
  )
}

