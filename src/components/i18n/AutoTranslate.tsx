import { cloneElement, isValidElement, type ReactNode } from "react"
import { useLanguage } from "@/contexts/LanguageContext"

const exactPhraseMap: Record<string, string> = {
  "Σφάλμα": "Error",
  "Αποθηκεύτηκε": "Saved",
  "Ενημερώθηκε": "Updated",
  "Διαγράφηκε": "Deleted",
  "Κλείσιμο": "Close",
  "Ενέργειες": "Actions",
  "Επεξεργασία": "Edit",
  "Διαγραφή": "Delete",
  "Προσθήκη": "Add",
  "Προσθήκη πελάτη": "Add customer",
  "Προσθήκη ραντεβού": "Add appointment",
  "Νέος πελάτης": "New customer",
  "Νέο ραντεβού": "New appointment",
  "Ιστορικό": "History",
  "Κατάσταση": "Status",
  "Όλες οι καταστάσεις": "All statuses",
  "Λίστα": "List",
  "Ημερολόγιο": "Calendar",
  "Φίλτρα:": "Filters:",
  "Όλα": "All",
  "Σήμερα": "Today",
  "Ολοκληρώθηκε": "Completed",
  "Ολοκληρωμένα": "Completed",
  "Σε εξέλιξη": "In progress",
  "Εκκρεμεί": "Pending",
  "Επιβεβαιωμένο": "Confirmed",
  "Ακυρώθηκε": "Cancelled",
  "Δεν εμφανίστηκε": "No show",
  "Εκκρεμή": "Pending",
  "Υπηρεσίες": "Services",
  "Πελάτες": "Customers",
  "Ραντεβού": "Appointments",
  "Υποστήριξη": "Support",
  "Ρυθμίσεις": "Settings",
  "Ομάδα & Βάρδιες": "Team & Shifts",
  "Αναφορές & Πληρωμές": "Reports & Payments",
  "Υπενθυμίσεις": "Reminders",
  "Διαθέσιμο σε": "Available on",
  "Επιχείρηση": "Business",
  "Η επιχείρησή μου": "My business",
  "Διαχείριση πλατφόρμας": "Platform management",
  "Αποσύνδεση": "Sign out",
  "Η συνδρομή έχει λήξει": "Subscription expired",
  "Επικοινωνήστε με κάποιον διαχειριστή για την αγορά προγράμματος.": "Contact an administrator to purchase a plan.",
  "Υπολείπονται": "Remaining",
  "ημέρες στη συνδρομή": "days in subscription",
  "λήξη": "expires",
}

const tokenMap: Record<string, string> = {
  "Επιχείρηση": "Business",
  "Πελάτης": "Customer",
  "Πελάτες": "Customers",
  "Υπηρεσία": "Service",
  "Υπηρεσίες": "Services",
  "Ραντεβού": "Appointments",
  "Ραντεβού ": "Appointments ",
  "Κατάσταση": "Status",
  "Κόστος": "Cost",
  "Ενέργειες": "Actions",
  "Ημ/νία": "Date",
  "Ώρα": "Time",
  "Τίτλος": "Title",
  "Περιοχή": "Area",
  "Σύνολο": "Total",
  "Σήμερα": "Today",
  "Ολοκληρωμένα": "Completed",
  "Ενεργά": "Active",
  "Εκκρεμή": "Pending",
  "Νέος": "New",
  "Νέα": "New",
  "Νέο": "New",
  "Προσθήκη": "Add",
  "Επεξεργασία": "Edit",
  "Διαγραφή": "Delete",
  "Ιστορικό": "History",
  "Υποστήριξη": "Support",
  "Ρυθμίσεις": "Settings",
  "Αναφορές": "Reports",
  "Πληρωμές": "Payments",
  "Ομάδα": "Team",
  "Βάρδιες": "Shifts",
  "Υπενθυμίσεις": "Reminders",
  "Σε πραγματικό χρόνο": "Real-time",
  "Δεν βρέθηκαν": "Not found",
  "Δεν υπάρχουν": "There are no",
  "Σφάλμα": "Error",
}

function replaceByTokens(text: string): string {
  let next = text
  for (const [gr, en] of Object.entries(tokenMap)) {
    next = next.split(gr).join(en)
  }
  return next
}

function translateText(text: string, language: "el" | "en"): string {
  if (language === "el") return text
  if (!/[Α-Ωα-ωΆ-Ώά-ώ]/.test(text)) return text
  if (exactPhraseMap[text]) return exactPhraseMap[text]
  return replaceByTokens(text)
}

function translateProps(props: Record<string, unknown>, language: "el" | "en"): Record<string, unknown> {
  if (language === "el") return props
  const out: Record<string, unknown> = { ...props }
  const keys: Array<keyof typeof out> = ["placeholder", "title", "aria-label", "alt"]
  for (const key of keys) {
    const val = out[key]
    if (typeof val === "string") out[key] = translateText(val, language)
  }
  return out
}

function translateNode(node: ReactNode, language: "el" | "en"): ReactNode {
  if (typeof node === "string") return translateText(node, language)
  if (Array.isArray(node)) return node.map((n, i) => <AutoTranslateFragment key={i}>{translateNode(n, language)}</AutoTranslateFragment>)
  if (!isValidElement(node)) return node

  const translatedChildren = translateNode(node.props.children, language)
  const translatedProps = translateProps(node.props as Record<string, unknown>, language)
  return cloneElement(node, translatedProps, translatedChildren)
}

function AutoTranslateFragment({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function AutoTranslate({ children }: { children: ReactNode }) {
  const { language } = useLanguage()
  return <>{translateNode(children, language)}</>
}
