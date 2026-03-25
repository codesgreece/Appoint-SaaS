import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChangelogEntry } from "@/types"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"

const FALLBACK_ENTRIES: ChangelogEntry[] = [
  {
    id: 19,
    created_at: new Date().toISOString(),
    title: "Ραντεβού: νέα ενότητα «Κενές ώρες»",
    description:
      "Προστέθηκε λίστα διαθέσιμων κενών για επιλεγμένη ημέρα (09:00–18:00), με γρήγορο κλικ για προ-συμπλήρωση νέου ραντεβού.",
    visible: true,
  },
  {
    id: 18,
    created_at: new Date().toISOString(),
    title: "Βάρδιες προσωπικού (Shift Management)",
    description:
      "Νέα εβδομαδιαία διαχείριση βαρδιών ανά μέλος ομάδας με δυνατότητα OFF ημέρας και έλεγχο ώστε τα ραντεβού να μην κλείνονται εκτός βάρδιας.",
    visible: true,
  },
  {
    id: 17,
    created_at: new Date().toISOString(),
    title: "Public Site: animated στατιστικά στην σελίδα /site",
    description:
      "Προστέθηκε premium section με count-up αριθμούς (IntersectionObserver + animation μόνο μία φορά): ενεργές επιχειρήσεις, κλεισμένα ραντεβού, πελάτες και συναλλαγές.",
    visible: true,
  },
  {
    id: 16,
    created_at: new Date().toISOString(),
    title: "Ημερήσια Διαδρομή: σειρά εργασιών & άνοιγμα σε Google Maps",
    description:
      "Νέα σελίδα «Ημερήσια Διαδρομή» με drag-and-drop για τα σημερινά ραντεβού, αποθήκευση σειράς (order_index) και κουμπί «Άνοιγμα διαδρομής» σε Google Maps.",
    visible: true,
  },
  {
    id: 15,
    created_at: new Date().toISOString(),
    title: "Υπενθυμίσεις Συντήρησης: δημιουργία, μεταφορά και dashboard widget",
    description:
      "Προστέθηκε πλήρες MVP για service reminders: δημιουργία από ολοκλήρωση ραντεβού, φίλτρα pending/completed/overdue, ενέργειες ολοκλήρωσης/ακύρωσης/μεταφοράς και κάρτα στο Dashboard.",
    visible: true,
  },
  {
    id: 14,
    created_at: new Date().toISOString(),
    title: "Ημερολόγιο: προβολή ημέρας πριν από νέο ραντεβού",
    description:
      "Με κλικ σε ημέρα ανοίγει πλέον popup με τα κλεισμένα ραντεβού της ημέρας και κουμπί «Κλείσιμο νέου ραντεβού» από το ίδιο σημείο.",
    visible: true,
  },
  {
    id: 13,
    created_at: new Date().toISOString(),
    title: "Ραντεβού: πιο απλές ενέργειες & ολοκλήρωση με χρεώσεις",
    description:
      "Αφαιρέθηκαν τα μενού με 3 τελείες και οι ενέργειες εμφανίζονται ως άμεσα κουμπιά. Στην ολοκλήρωση προστέθηκαν διάρκεια ραντεβού, έξτρα χρεώσεις και αυτόματος υπολογισμός τελικής τιμής.",
    visible: true,
  },
  {
    id: 12,
    created_at: new Date().toISOString(),
    title: "Υπηρεσίες: υποστήριξη χρέωσης ανά ώρα",
    description:
      "Στην καρτέλα Υπηρεσίες προστέθηκε τύπος χρέωσης (σταθερή ή ανά ώρα), πεδίο ωριαίας χρέωσης και αυτόματος υπολογισμός κόστους από διάρκεια υπηρεσίας.",
    visible: true,
  },
  {
    id: 11,
    created_at: new Date().toISOString(),
    title: "Πλάνα & διάρκεια στη διαχείριση επιχειρήσεων",
    description:
      "Super admin: αλλαγή πλάνου ανά επιχείρηση από τις Λεπτομέρειες. Νέο πεδίο Λήξη συνδρομής με ημερομηνία και κουμπί «Ενημέρωση λήξης». Δημιουργία επιχείρησης με πλάνο Demo: κρύβεται η επιλογή διάρκειας, εμφανίζεται «3 ημέρες (σταθερό)».",
    visible: true,
  },
  {
    id: 10,
    created_at: new Date().toISOString(),
    title: "Διαγραφή χρήστη από Ομάδα (διόρθωση Forbidden)",
    description:
      "Διόρθωση σφάλματος Forbidden κατά τη διαγραφή μέλους από Super Admin. Ο super_admin μπορεί πλέον να διαγράφει χρήστες ακόμα και χωρίς business_id.",
    visible: true,
  },
  {
    id: 9,
    created_at: new Date().toISOString(),
    title: "Διαγραφή πελάτη και ραντεβού",
    description:
      "Κατά τη διαγραφή πελάτη διαγράφονται αυτόματα και όλα τα ραντεβού (και οι πληρωμές τους). Δεν εμφανίζεται πλέον σφάλμα foreign key.",
    visible: true,
  },
  {
    id: 8,
    created_at: new Date().toISOString(),
    title: "Διαγραφή ραντεβού (μόνο admin)",
    description:
      "Στην καρτέλα Ραντεβού προστέθηκε ενέργεια «Διαγραφή ραντεβού» στο μενού Ενέργειες. Εμφανίζεται μόνο για admin και super_admin.",
    visible: true,
  },
  {
    id: 7,
    created_at: new Date().toISOString(),
    title: "Πλάνο Demo και χειροκίνητη αλλαγή πλάνου",
    description:
      "Νέο πλάνο Demo (1 χρήστης, 20 πελάτες, 50 ραντεβού, 3 ημέρες). Στο superadmin panel επιλογή πλάνου ανά επιχείρηση και όρια ανά πλάνο.",
    visible: true,
  },
  {
    id: 6,
    created_at: new Date().toISOString(),
    title: "Όρια πλάνων (Starter / Pro / Premium)",
    description:
      "Τα πλάνα εφαρμόζουν πλέον πραγματικά όρια: απαγόρευση νέων χρηστών/πελατών/ραντεβού όταν φτάνετε το όριο. Στην Ομάδα, Πελάτες και Ραντεβού εμφανίζονται ενδείξεις χρήσης (π.χ. 2/3 μέλη, 120/300 πελάτες).",
    visible: true,
  },
  {
    id: 5,
    created_at: new Date().toISOString(),
    title: "Ρύθμιση ωραρίου και δικαιωμάτων ανά μέλος",
    description:
      "Στην Ομάδα: ρύθμιση ωραρίου εργασίας ανά ημέρα και δικαιώματα (βλέπει reports, αλλάζει τιμές, διαγράφει ραντεβού). Στα ραντεβού ελέγχεται ωράριο και επικάλυψη.",
    visible: true,
  },
  {
    id: 4,
    created_at: new Date().toISOString(),
    title: "Ιστορικό πελάτη και ημερολόγιο",
    description:
      "Από τη λίστα πελατών μπορείτε να ανοίξετε Ιστορικό: ραντεβού, υπηρεσίες, ποσά. Στο Ημερολόγιο: φίλτρα, κουμπί Σήμερα, δημιουργία ραντεβού με κλικ σε ημέρα, κλείδωμα περασμένων ημερών.",
    visible: true,
  },
  {
    id: 3,
    created_at: new Date().toISOString(),
    title: "Βελτιωμένο UI με glass / gradients",
    description: "Νέο, πιο μοντέρνο layout για μενού, πίνακες και κάρτες.",
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
    id: 1,
    created_at: new Date().toISOString(),
    title: "Νέα καρτέλα Υποστήριξη",
    description:
      "Οι επιχειρήσεις μπορούν να στέλνουν προτάσεις και αναφορές προβλημάτων απευθείας μέσα από την εφαρμογή.",
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

