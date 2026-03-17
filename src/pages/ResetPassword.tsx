import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ResetPassword() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [validSession, setValidSession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
      setLoading(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast({ title: "Σφάλμα", description: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.", variant: "destructive" })
      return
    }
    if (password !== confirmPassword) {
      toast({ title: "Σφάλμα", description: "Οι κωδικοί δεν ταιριάζουν.", variant: "destructive" })
      return
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast({ title: "Σφάλμα", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Επιτυχής αλλαγή κωδικού", description: "Μπορείτε να συνδεθείτε με τον νέο κωδικό." })
    navigate("/login", { replace: true })
  }

  if (loading) {
    return null
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Μη έγκυρος σύνδεσμος</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Ο σύνδεσμος επαναφοράς κωδικού δεν είναι έγκυρος ή έχει λήξει.
            </p>
            <Button onClick={() => navigate("/login")}>Επιστροφή στη σύνδεση</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Νέος κωδικός</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Νέος κωδικός
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirmPassword">
                Επιβεβαίωση κωδικού
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Αλλαγή κωδικού
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

