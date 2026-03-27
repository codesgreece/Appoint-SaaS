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
  "Αποτυχία": "Failed",
  "Αποτυχία φόρτωσης": "Failed to load",
  "Αποτυχία ενημέρωσης": "Failed to update",
  "Αποτυχία διαγραφής": "Failed to delete",
  "Ανανέωση σελίδας": "Refresh page",
  "Δοκιμάστε ξανά": "Try again",
  "Απρόσμενο σφάλμα": "Unexpected error",
  "Dashboard": "Dashboard",
  "Πληρωμή": "Payment",
  "υπόλ.": "rem.",
  "Τελική χρέωση": "Final charge",
  "Εκτίμηση τιμής": "Estimated price",
  "Χωρίς ποσό": "No amount",
  "μέλη σε βάρδια": "members on shift",
  "ολοκληρωμένα": "completed",
  "Εκπρόθεσμες": "Overdue",
  "Επόμενες υπενθυμίσεις": "Upcoming reminders",
  "Άνοιγμα υπενθυμίσεων": "Open reminders",
  "Κενές ώρες": "Empty slots",
  "Δεν υπάρχουν κενές ώρες για τη συγκεκριμένη ημέρα.": "No empty slots for this day.",
  "Αναζήτηση": "Search",
  "Όριο πλάνου": "Plan limit",
  "του πλάνου": "of plan",
  "Σύνολο πελατών": "Total customers",
  "Με email": "With email",
  "Με τηλέφωνο": "With phone",
  "Κλήση / SMS": "Call / SMS",
  "Λίστα πελατών": "Customer list",
  "Δεν βρέθηκαν πελάτες": "No customers found",
  "Δεν βρέθηκαν ραντεβού": "No appointments found",
  "Διαχείριση πελατών": "Customer management",
  "Διαχείριση ραντεβού και work orders": "Manage appointments and work orders",
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

    const attrs = ["placeholder", "title", "aria-label", "alt", "value"] as const
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
      attributeFilter: ["placeholder", "title", "aria-label", "alt", "value"],
    })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [language])

  return <>{translateNode(children, language)}</>
}
