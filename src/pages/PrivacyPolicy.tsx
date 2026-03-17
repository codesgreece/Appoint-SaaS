import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrivacyPolicy() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Πολιτική Απορρήτου</h1>
        <p className="text-muted-foreground">Codes Greece</p>
        <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle>Προστασία δεδομένων</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            Η παρούσα Πολιτική Απορρήτου περιγράφει πώς η <strong>Codes Greece</strong> επεξεργάζεται δεδομένα κατά τη χρήση
            της Υπηρεσίας.
          </p>
          <ul>
            <li>
              <strong>Δεδομένα λογαριασμού</strong>: όνομα, username, ρόλος, κατάσταση λογαριασμού.
            </li>
            <li>
              <strong>Δεδομένα λειτουργίας</strong>: πελάτες, ραντεβού, υπηρεσίες και λοιπά στοιχεία που εισάγει η επιχείρηση.
            </li>
            <li>
              <strong>Ασφάλεια</strong>: εφαρμόζονται τεχνικά/οργανωτικά μέτρα για την προστασία των δεδομένων.
            </li>
          </ul>
          <p>
            Για αιτήματα πρόσβασης/διόρθωσης/διαγραφής ή ερωτήσεις, επικοινωνήστε με την <strong>Codes Greece</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

