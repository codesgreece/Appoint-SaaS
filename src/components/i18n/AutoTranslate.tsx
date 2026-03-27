import { cloneElement, isValidElement, useEffect, type ReactNode } from "react"
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
  "Τελευταίες αλλαγές": "Latest changes",
  "Ημερήσια Διαδρομή": "Daily Route",
  "Σημερινά ραντεβού": "Today's appointments",
  "Κάνε drag-and-drop για να ορίσεις τη σειρά εκτέλεσης.": "Drag and drop to define execution order.",
  "Υπενθυμίσεις Συντήρησης": "Service Reminders",
  "Εκκρεμές": "Pending",
  "Εφαρμογή · Settings": "App · Settings",
  "Εμφάνιση": "Appearance",
}

const exactContainsMap: Array<[string, string]> = [
  ["Δεν υπάρχουν ραντεβού για σήμερα.", "There are no appointments for today."],
  ["Δεν υπάρχουν upcoming service reminders.", "There are no upcoming service reminders."],
  ["Δεν υπάρχουν υπενθυμίσεις για το φίλτρο που επέλεξες.", "There are no reminders for the selected filter."],
  ["Νέα υπηρεσία", "New service"],
  ["Άνοιγμα διαδρομής", "Open route"],
  ["Αποθήκευση σειράς", "Save order"],
  ["Λίστα υπηρεσιών", "Service list"],
  ["Λίστα υπενθυμίσεων", "Reminders list"],
  ["Σύνοψη ομάδας", "Team summary"],
  ["Ρόλοι & Δικαιώματα", "Roles & Permissions"],
  ["Μέλη και ρόλοι", "Members and roles"],
  ["Έσοδα, ραντεβού και πληρωμές", "Revenue, appointments and payments"],
  ["Μόνο ρυθμίσεις εμφάνισης και εμπειρίας εφαρμογής.", "Only appearance and app experience settings."],
  ["Εξαγωγή λίστας πελατών σε αρχείο Excel για backup ή μεταφορά σε άλλο σύστημα", "Export customer list to Excel for backup or migration to another system"],
  ["Export πελατών σε Excel", "Export customers to Excel"],
  ["Booking window (ημέρες)", "Booking window (days)"],
  ["Έναρξη ωραρίου", "Start hour"],
  ["Λήξη ωραρίου", "End hour"],
  ["Βήμα slots (λεπτά)", "Slot step (minutes)"],
  ["Ελάχιστη προειδοποίηση (ώρες)", "Minimum notice (hours)"],
  ["There are no ραντεβού για σήμερα.", "There are no appointments for today."],
  ["There are no υπενθυμίσεις για το φίλτρο που επέλεξες.", "There are no reminders for the selected filter."],
  ["Reminders Συντήρησης", "Service Reminders"],
  ["Ημερήσια Διαδρομή", "Daily Route"],
  ["Λίστα υπηρεσιών", "Service list"],
  ["Λίστα υπενθυμίσεων", "Reminders list"],
  ["Σειρά εργασιών για", "Job order for"],
  ["Μέλη και ρόλοι", "Members and roles"],
  ["Σύνοψη ομάδας", "Team summary"],
  ["Ρόλοι & Δικαιώματα", "Roles & Permissions"],
  ["Διαχείριση πελατών", "Customer management"],
  ["Διαχείριση ραντεβού και work orders", "Manage appointments and work orders"],
  ["Μόνο ρυθμίσεις εμφάνισης και εμπειρίας εφαρμογής.", "Only appearance and app experience settings."],
  ["Εξαγωγή λίστας πελατών σε αρχείο Excel για backup ή μεταφορά σε άλλο σύστημα", "Export customer list to Excel for backup or migration to another system"],
]

function translateText(text: string, language: "el" | "en"): string {
  if (language === "el") return text
  if (!/[Α-Ωα-ωΆ-Ώά-ώ]/.test(text)) return text
  if (exactPhraseMap[text]) return exactPhraseMap[text]
  let next = text
  for (const [gr, en] of exactContainsMap) {
    if (next.includes(gr)) next = next.split(gr).join(en)
  }
  return next
}

const originalTextNodes = new WeakMap<Text, string>()
const originalElementAttrs = new WeakMap<Element, Record<string, string>>()
let applyingNow = false

function collectTranslatableElements(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll("*"))
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement
  if (!parent) return true
  const tag = parent.tagName
  return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT"
}

function applyDomTranslation(language: "el" | "en") {
  applyingNow = true
  try {
    const body = document.body
    if (!body) return

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    let current = walker.nextNode()
    while (current) {
      const textNode = current as Text
      if (!shouldSkipTextNode(textNode)) {
        const currentText = textNode.nodeValue ?? ""
        if (language === "en") {
          if (!originalTextNodes.has(textNode)) originalTextNodes.set(textNode, currentText)
          textNode.nodeValue = translateText(currentText, language)
        } else if (originalTextNodes.has(textNode)) {
          textNode.nodeValue = originalTextNodes.get(textNode) ?? currentText
        }
      }
      current = walker.nextNode()
    }

    const attrs = ["placeholder", "title", "aria-label", "alt"] as const
    for (const el of collectTranslatableElements(body)) {
      const originals: Record<string, string> = originalElementAttrs.get(el) ?? {}
      let changed = false
      for (const attr of attrs) {
        const currentVal = el.getAttribute(attr)
        if (currentVal == null) continue
        if (language === "en") {
          if (!(attr in originals)) {
            originals[attr] = currentVal
            changed = true
          }
          el.setAttribute(attr, translateText(currentVal, language))
        } else if (attr in originals) {
          el.setAttribute(attr, originals[attr])
        }
      }
      if (language === "en" && changed) {
        originalElementAttrs.set(el, originals)
      }
    }
  } finally {
    applyingNow = false
  }
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
  if (Array.isArray(node)) return node.map((n) => translateNode(n, language))
  if (!isValidElement(node)) return node

  const translatedChildren = translateNode(node.props.children, language)
  const translatedProps = translateProps(node.props as Record<string, unknown>, language)
  return cloneElement(node, translatedProps, translatedChildren)
}

export function AutoTranslate({ children }: { children: ReactNode }) {
  const { language } = useLanguage()

  useEffect(() => {
    let raf = 0
    const apply = () => applyDomTranslation(language)
    apply()

    const observer = new MutationObserver(() => {
      if (applyingNow) return
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [language])

  return <>{translateNode(children, language)}</>
}
