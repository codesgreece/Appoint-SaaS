import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChangelogEntry } from "@/types"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"

const FALLBACK_ENTRIES: ChangelogEntry[] = [
  {
    id: 1,
    created_at: new Date().toISOString(),
    title: "Νέα καρτέλα Υποστήριξη",
    description: "Οι επιχειρήσεις μπορούν να στέλνουν προτάσεις και αναφορές προβλημάτων απευθείας μέσα από την εφαρμογή.",
    visible: true,
  },
  {
    id: 2,
    created_at: new Date().toISOString(),
    title: "Απενεργοποίηση μελών ομάδας",
    description: "Οι admins μπορούν να απενεργοποιούν προσωρινά λογαριασμούς χρηστών από την καρτέλα Ομάδα.",
    visible: true,
  },
  {
    id: 3,
    created_at: new Date().toISOString(),
    title: "Βελτιωμένο UI με glass / gradients",
    description: "Νέο, πιο μοντέρνο layout για μενού, πίνακες και κάρτες.",
    visible: true,
  },
]

export function ChangelogCard({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<ChangelogEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("changelog_entries")
          .select("*")
          .eq("visible", true)
          .order("created_at", { ascending: false })
          .limit(5)
        if (!active) return
        if (error || !data || data.length === 0) {
          setRows(FALLBACK_ENTRIES)
        } else {
          setRows(data as ChangelogEntry[])
        }
      } catch {
        if (active) setRows(FALLBACK_ENTRIES)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Τελευταίες αλλαγές</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {loading || !rows ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          rows.slice(0, compact ? 3 : 5).map((e) => (
            <div key={e.id} className="space-y-1">
              <p className="font-medium text-foreground/90">{e.title}</p>
              {e.description ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{e.description}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

