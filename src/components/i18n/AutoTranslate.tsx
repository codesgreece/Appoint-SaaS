import { cloneElement, isValidElement, type ReactNode } from "react"
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext"

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
  "Νέα υπηρεσία": "New service",
  "Νέος πελάτης": "New customer",
  "Νέο ραντεβού": "New appointment",
  "Λίστα": "List",
  "Ημερολόγιο": "Calendar",
  "Όλα": "All",
  "Σήμερα": "Today",
  "Εκκρεμές": "Pending",
  "Εκκρεμή": "Pending",
  "Ολοκληρωμένα": "Completed",
  "Υπενθυμίσεις Συντήρησης": "Service Reminders",
  "Reminders Συντήρησης": "Service Reminders",
  "Λίστα υπηρεσιών": "Service list",
  "Λίστα υπενθυμίσεων": "Reminders list",
  "Σύνοψη ομάδας": "Team summary",
  "Μέλη και ρόλοι": "Members and roles",
  "Ρόλοι & Δικαιώματα": "Roles & Permissions",
  "Αναφορές & Πληρωμές": "Reports & Payments",
  "Όροι Χρήσης": "Terms of Use",
  "Πολιτική Απορρήτου": "Privacy Policy",
  "Αποστολή": "Submit",
  "Ανοιχτά": "Open",
  "Εμφάνιση": "Appearance",
  "Εφαρμογή · Services": "Business · Services",
  "Εφαρμογή · Settings": "Business · Settings",
  "Εφαρμογή · Reports": "Reports · Premium",
  "Εφαρμογή · Team": "Business · Team",
}

const exactContainsMap: Array<[string, string]> = [
  ["There are no ραντεβού για σήμερα.", "There are no appointments for today."],
  ["There are no υπενθυμίσεις για το φίλτρο που επέλεξες.", "There are no reminders for the selected filter."],
  ["Δεν υπάρχουν ραντεβού για σήμερα.", "There are no appointments for today."],
  ["Δεν υπάρχουν υπενθυμίσεις για το φίλτρο που επέλεξες.", "There are no reminders for the selected filter."],
  ["Δεν υπάρχουν upcoming service reminders.", "There are no upcoming service reminders."],
  ["Εξαγωγή λίστας πελατών", "Export customer list"],
  ["σε αρχείο Excel", "to Excel file"],
  ["για backup ή μεταφορά σε άλλο σύστημα", "for backup or migration to another system"],
  ["Export πελατών σε Excel", "Export customers to Excel"],
  ["Booking window (ημέρες)", "Booking window (days)"],
  ["Έναρξη ωραρίου", "Start hour"],
  ["Λήξη ωραρίου", "End hour"],
  ["Βήμα slots (λεπτά)", "Slot step (minutes)"],
  ["Ελάχιστη προειδοποίηση (ώρες)", "Minimum notice (hours)"],
  ["Διαχείριση πελατών", "Customer management"],
  ["Διαχείριση ραντεβού και work orders", "Manage appointments and work orders"],
  ["Μόνο ρυθμίσεις εμφάνισης και εμπειρίας εφαρμογής.", "Only appearance and app experience settings."],
  ["Έσοδα σήμερα", "Revenue today"],
  ["Έσοδα μήνα", "Revenue month"],
  ["Υπόλοιπα", "Balances"],
  ["Κορυφαίοι πελάτες", "Top customers"],
  ["Έσοδα ανά υπηρεσία", "Revenue by service"],
  ["Έσοδα ανά υπεύθυνο", "Revenue by assignee"],
  ["Μάρτιος", "March"],
  ["Δευ", "Mon"],
  ["Τρι", "Tue"],
  ["Τετ", "Wed"],
  ["Πεμ", "Thu"],
  ["Παρ", "Fri"],
  ["Σαβ", "Sat"],
  ["Κυρ", "Sun"],
]

const tokenMap: Array<[string, string]> = [
  ["Υπηρεσίες", "Services"],
  ["Υπηρεσία", "Service"],
  ["Πελάτες", "Customers"],
  ["Πελάτης", "Customer"],
  ["Ραντεβού", "Appointments"],
  ["Ραντεβο", "Appointment"],
  ["Ημερολόγιο", "Calendar"],
  ["Υπενθυμίσεις", "Reminders"],
  ["Συντήρησης", "Maintenance"],
  ["Συντήρηση", "Maintenance"],
  ["Ομάδα", "Team"],
  ["Βάρδιες", "Shifts"],
  ["Αναφορές", "Reports"],
  ["Πληρωμές", "Payments"],
  ["Ρυθμίσεις", "Settings"],
  ["Υποστήριξη", "Support"],
  ["Σύνολο", "Total"],
  ["Όνομα", "Name"],
  ["Διάρκεια", "Duration"],
  ["Χρέωση", "Charge"],
  ["Περιγραφή", "Description"],
  ["Κατάσταση", "Status"],
  ["Κόστος", "Cost"],
  ["Ενέργειες", "Actions"],
  ["Αναζήτηση", "Search"],
  ["Σήμερα", "Today"],
  ["Από", "From"],
  ["Έως", "To"],
  ["Ανοιχτά", "Open"],
  ["Ανοιγμα", "Open"],
  ["Άνοιγμα", "Open"],
  ["Αποθήκευση", "Save"],
  ["Νέα", "New"],
  ["Νέος", "New"],
  ["Νέο", "New"],
  ["Προσθήκη", "Add"],
  ["Διαγραφή", "Delete"],
  ["Επεξεργασία", "Edit"],
  ["Διαχειριστής", "Admin"],
  ["Υπάλληλος", "Staff"],
  ["Ρεσεψιόν", "Reception"],
  ["Ενεργός", "Active"],
  ["Ανενεργός", "Inactive"],
  ["Ενεργά", "Active"],
  ["Ανενεργά", "Inactive"],
  ["Δεν υπάρχουν", "There are no"],
  ["Δεν", "No"],
  ["και", "and"],
  ["για", "for"],
  ["ανά", "per"],
  ["μέλος", "member"],
  ["μέλη", "members"],
  ["επιχείρησης", "business"],
  ["επιχείρηση", "business"],
  ["ωραρίου", "hours"],
  ["ώρες", "hours"],
  ["ημέρες", "days"],
  ["λεπτά", "minutes"],
]

function translateText(text: string, language: AppLanguage): string {
  if (language === "el") return text
  if (!/[Α-Ωα-ωΆ-Ώά-ώ]/.test(text)) return text
  if (exactPhraseMap[text]) return exactPhraseMap[text]

  let next = text
  for (const [gr, en] of exactContainsMap) {
    if (next.includes(gr)) next = next.split(gr).join(en)
  }
  for (const [gr, en] of tokenMap) {
    if (next.includes(gr)) next = next.split(gr).join(en)
  }
  return next
}

function translateProps(props: Record<string, unknown>, language: AppLanguage): Record<string, unknown> {
  if (language === "el") return props
  const out: Record<string, unknown> = { ...props }
  const keys: Array<keyof typeof out> = ["placeholder", "title", "aria-label", "alt"]
  for (const key of keys) {
    const val = out[key]
    if (typeof val === "string") out[key] = translateText(val, language)
  }
  return out
}

function translateNode(node: ReactNode, language: AppLanguage): ReactNode {
  if (typeof node === "string") return translateText(node, language)
  if (Array.isArray(node)) return node.map((n) => translateNode(n, language))
  if (!isValidElement(node)) return node

  const translatedChildren = translateNode(node.props.children, language)
  const translatedProps = translateProps(node.props as Record<string, unknown>, language)
  return cloneElement(node, translatedProps, translatedChildren)
}

export function AutoTranslate({ children }: { children: ReactNode }) {
  const { language } = useLanguage()
  return <>{translateNode(children, language)}</>
}
