import { useMemo, useState } from "react"
import { HelpCircle, Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type FaqItem = { q: string; a: string; tags: string[] }

function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const isOpen = open === idx
        return (
          <button
            key={it.q}
            type="button"
            onClick={() => setOpen((cur) => (cur === idx ? null : idx))}
            className={cn(
              "w-full text-left rounded-lg border bg-card p-4 transition-colors",
              isOpen ? "border-primary/40" : "hover:bg-accent/40",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="font-medium">{it.q}</div>
              <div className="text-muted-foreground text-sm">{isOpen ? "−" : "+"}</div>
            </div>
            {isOpen && (
              <div className="mt-3 text-sm text-muted-foreground whitespace-pre-line">
                {it.a}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function FAQ() {
  const [query, setQuery] = useState("")

  const sections = useMemo(() => {
    const business: FaqItem[] = [
      {
        q: "Πώς μπαίνω στο σύστημα;",
        a: "Κάνεις σύνδεση με username + κωδικό.\nΔεν χρειάζεται email επιβεβαίωση.",
        tags: ["login", "auth", "σύνδεση"],
      },
      {
        q: "Πού ορίζω τις υπηρεσίες της επιχείρησης;",
        a: "Από το μενού αριστερά → Υπηρεσίες.\nΕκεί μπορείς να προσθέσεις όνομα, διάρκεια και τιμή.",
        tags: ["υπηρεσίες", "services"],
      },
      {
        q: "Πώς συνδέονται οι υπηρεσίες με τα ραντεβού;",
        a: "Στη φόρμα Ραντεβού υπάρχει πεδίο Υπηρεσία.\nΗ υπηρεσία που επιλέγεις αποθηκεύεται στο ραντεβού και εμφανίζεται και στη λίστα.",
        tags: ["ραντεβού", "appointments", "υπηρεσίες"],
      },
      {
        q: "Πώς προσθέτω νέο πελάτη;",
        a: "Μενού → Πελάτες → Νέος πελάτης.\nΜπορείς επίσης να προσθέσεις νέο πελάτη μέσα από τη φόρμα Ραντεβού.",
        tags: ["πελάτες", "customers"],
      },
      {
        q: "Πώς δημιουργώ νέο ραντεβού;",
        a: "Μενού → Ραντεβού → Νέο ραντεβού.\nΣυμπλήρωσε πελάτη, ώρα/ημερομηνία, υπηρεσία και κατάσταση.",
        tags: ["ραντεβού", "appointments"],
      },
      {
        q: "Πώς φιλτράρω τα ραντεβού;",
        a: "Στη σελίδα Ραντεβού μπορείς να χρησιμοποιήσεις τα quick filters (Σήμερα / 7 ημέρες) και φίλτρο κατάστασης.",
        tags: ["φίλτρα", "ραντεβού"],
      },
      {
        q: "Τι γίνεται με πληρωμές/κόστη;",
        a: "Στο ραντεβού μπορείς να ορίσεις εκτίμηση κόστους και τελικό κόστος.\nΣτις Πληρωμές βλέπεις τις εγγραφές πληρωμών ανά ραντεβού.",
        tags: ["πληρωμές", "payments"],
      },
      {
        q: "Πού αλλάζω ρυθμίσεις επιχείρησης/λογαριασμού;",
        a: "Μενού → Ρυθμίσεις.\nΕκεί αλλάζεις στοιχεία επιχείρησης και στοιχεία λογαριασμού.",
        tags: ["ρυθμίσεις", "settings"],
      },
    ]

    const platform: FaqItem[] = [
      {
        q: "Πώς δημιουργώ νέα επιχείρηση (tenant);",
        a: "Platform → Επιχειρήσεις → Νέα επιχείρηση.\nΕπιλέγεις πακέτο από dropdown και διάρκεια (ανά μήνα/ανά χρόνο).",
        tags: ["platform", "επιχειρήσεις"],
      },
      {
        q: "Πώς προσθέτω admin σε μια επιχείρηση;",
        a: "Platform → Επιχειρήσεις → Λεπτομέρειες → Προσθήκη διαχειριστή.\nΔίνεις full name, username, password και ο χρήστης μπορεί να συνδεθεί άμεσα.",
        tags: ["platform", "admin", "χρήστες"],
      },
      {
        q: "Τι είναι η ‘Επιδιόρθωση σύνδεσης’;",
        a: "Χρησιμοποιείται για παλιούς χρήστες που είχαν δημιουργηθεί χωρίς επιβεβαίωση.\nΚάνει confirm τον λογαριασμό ώστε να μπορεί να συνδεθεί.",
        tags: ["platform", "επιδιόρθωση", "auth"],
      },
      {
        q: "Μπορώ να διαγράψω επιχείρηση;",
        a: "Ναι. Platform → Επιχειρήσεις → ⋯ → Διαγραφή ή μέσα στις Λεπτομέρειες.\nΗ διαγραφή είναι μη αναστρέψιμη και αφαιρεί όλα τα δεδομένα της επιχείρησης.",
        tags: ["platform", "delete"],
      },
    ]

    return { business, platform }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    const match = (it: FaqItem) =>
      it.q.toLowerCase().includes(q) ||
      it.a.toLowerCase().includes(q) ||
      it.tags.some((t) => t.toLowerCase().includes(q))
    return {
      business: sections.business.filter(match),
      platform: sections.platform.filter(match),
    }
  }, [query, sections])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FAQ</h1>
          <p className="text-muted-foreground">Συχνές ερωτήσεις για τη χρήση της εφαρμογής</p>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Αναζήτηση</CardTitle>
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ψάξε με λέξεις-κλειδιά (π.χ. ραντεβού, υπηρεσίες, admin)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="business">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="business">Χρήση επιχείρησης</TabsTrigger>
              <TabsTrigger value="platform">Platform (super_admin)</TabsTrigger>
            </TabsList>
            <TabsContent value="business" className="mt-4">
              {filtered.business.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <HelpCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium text-foreground/80">Δεν βρέθηκαν αποτελέσματα</p>
                  <p className="text-sm">Δοκίμασε διαφορετικές λέξεις-κλειδιά.</p>
                </div>
              ) : (
                <FaqList items={filtered.business} />
              )}
            </TabsContent>
            <TabsContent value="platform" className="mt-4">
              {filtered.platform.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <HelpCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium text-foreground/80">Δεν βρέθηκαν αποτελέσματα</p>
                  <p className="text-sm">Δοκίμασε διαφορετικές λέξεις-κλειδιά.</p>
                </div>
              ) : (
                <FaqList items={filtered.platform} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

