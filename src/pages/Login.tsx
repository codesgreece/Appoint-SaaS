import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const loginSchema = z.object({
  identifier: z.string().min(1, "Απαιτείται email ή όνομα χρήστη"),
  password: z.string().min(1, "Απαιτείται κωδικός"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  })

  async function onSubmit(data: LoginForm) {
    const rawIdentifier = data.identifier.trim()
    const isEmail = rawIdentifier.includes("@")

    let emailForAuth = rawIdentifier

    // If identifier is not an email, treat it as username and resolve to auth email
    if (!isEmail) {
      emailForAuth = `${rawIdentifier.toLowerCase()}@internal.app`
    }

    const { error } = await supabase.auth.signInWithPassword({ email: emailForAuth, password: data.password })
    if (error) {
      toast({
        title: "Σφάλμα σύνδεσης",
        description: error.message,
        variant: "destructive",
      })
      return
    }
    toast({ title: "Επιτυχής σύνδεση", description: "Ανακατεύθυνση..." })
    navigate("/dashboard", { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient background with soft glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-white/20 bg-white/10 dark:bg-white/5 backdrop-blur-xl shadow-2xl shadow-primary/10">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Appoint SaaS
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Διαχείριση ραντεβού & εργασιών
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email ή Όνομα χρήστη</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="admin@demo.com ή username"
                  className="bg-background/50 border-white/20"
                  {...register("identifier")}
                />
                {errors.identifier && (
                  <p className="text-sm text-destructive">{errors.identifier.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Κωδικός</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="bg-background/50 border-white/20 pr-10"
                    {...register("password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword((p) => !p)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Σύνδεση...
                  </>
                ) : (
                  "Σύνδεση"
                )}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-xs text-muted-foreground"
                disabled={isSubmitting}
                onClick={async () => {
                  const rawIdentifier = getValues("identifier")?.trim()
                  if (!rawIdentifier) {
                    toast({
                      title: "Υπενθύμιση κωδικού",
                      description: "Συμπληρώστε email ή όνομα χρήστη για επαναφορά κωδικού.",
                    })
                    return
                  }
                  let emailForReset = rawIdentifier
                  if (!rawIdentifier.includes("@")) {
                    emailForReset = `${rawIdentifier.toLowerCase()}@internal.app`
                  }
                  const { error } = await supabase.auth.resetPasswordForEmail(emailForReset, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  })
                  if (error) {
                    toast({
                      title: "Υπενθύμιση κωδικού",
                      description: error.message,
                      variant: "destructive",
                    })
                    return
                  }
                  toast({
                    title: "Υπενθύμιση κωδικού",
                    description: "Σας στείλαμε email για επαναφορά κωδικού (αν υπάρχει ο λογαριασμός).",
                  })
                }}
              >
                Ξεχάσατε τον κωδικό;
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Δεν υπάρχει δημόσια εγγραφή. Ο λογαριασμός δημιουργείται από τον διαχειριστή.
            </p>
            <p className="mt-2 text-center text-xs">
              <Link to="/" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Παρουσίαση λειτουργιών & πακέτων
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
