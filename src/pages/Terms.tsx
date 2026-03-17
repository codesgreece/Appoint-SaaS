import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Terms() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Όροι Χρήσης</h1>
        <p className="text-muted-foreground">Codes Greece</p>
        <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle>Γενικοί Όροι</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            Οι παρόντες Όροι Χρήσης διέπουν τη χρήση της εφαρμογής/υπηρεσίας (“Υπηρεσία”) που παρέχεται από την εταιρεία{" "}
            <strong>Codes Greece</strong>.
          </p>
          <ul>
            <li>Η χρήση της Υπηρεσίας προϋποθέτει αποδοχή των Όρων.</li>
            <li>Η πρόσβαση παρέχεται μόνο σε χρήστες που δημιουργούνται από διαχειριστή.</li>
            <li>Ο χρήστης οφείλει να διατηρεί τα διαπιστευτήριά του ασφαλή.</li>
          </ul>
          <p>
            Για απορίες ή αιτήματα σχετικά με τους Όρους, επικοινωνήστε με την <strong>Codes Greece</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

