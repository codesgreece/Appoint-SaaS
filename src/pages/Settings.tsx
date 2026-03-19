import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useTheme } from "@/components/theme-provider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Palette } from "lucide-react"

export default function Settings() {
  const { theme, setTheme, palette, setPalette } = useTheme()

  const selectedThemePreset = useMemo(() => `${theme}:${palette}`, [theme, palette])

  function handleThemePresetChange(value: string) {
    const [nextTheme, nextPalette] = value.split(":")
    if (nextTheme === "light" || nextTheme === "dark" || nextTheme === "system") {
      setTheme(nextTheme)
    }
    if (nextPalette === "default" || nextPalette === "beauty") {
      setPalette(nextPalette)
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
          <Sparkles className="h-4 w-4 text-primary" />
          Εφαρμογή • Ρυθμίσεις
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Ρυθμίσεις</h1>
        <p className="text-muted-foreground">Μόνο ρυθμίσεις εμφάνισης και εμπειρίας εφαρμογής.</p>
        <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" />
            Εμφάνιση εφαρμογής
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Theme preset</Label>
            <Select value={selectedThemePreset} onValueChange={handleThemePresetChange}>
              <SelectTrigger className="w-full max-w-sm bg-background/40 border-border/60">
                <SelectValue placeholder="Επίλεξε θέμα" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light:default">Κλασικό - Φωτεινό</SelectItem>
                <SelectItem value="dark:default">Κλασικό - Σκούρο</SelectItem>
                <SelectItem value="system:default">Κλασικό - Σύστημα</SelectItem>
                <SelectItem value="light:beauty">Beauty Pink - Φωτεινό</SelectItem>
                <SelectItem value="dark:beauty">Beauty Pink - Σκούρο</SelectItem>
                <SelectItem value="system:beauty">Beauty Pink - Σύστημα</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Το “Beauty Pink” είναι πιο γυναικείο/premium theme, κατάλληλο για nail, beauty και wellness studios.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
