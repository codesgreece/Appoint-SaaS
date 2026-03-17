import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Users as UsersIcon } from "lucide-react"

interface PlatformUserRow {
  id: string
  full_name: string
  email: string
  role: string
  status: string
  created_at: string
  business?: { name: string } | { name: string }[]
}

export default function PlatformUsers() {
  const [users, setUsers] = useState<PlatformUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [businessFilter, setBusinessFilter] = useState("")

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("users")
          .select("id, full_name, email, role, status, created_at, business:businesses(name)")
          .order("created_at", { ascending: false })
        if (error) throw error
        setUsers(((data as unknown) as PlatformUserRow[]) ?? [])
      } catch (err) {
        console.error("Load platform users error:", err)
        setUsers([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (statusFilter && u.status !== statusFilter) return false
    const businessName =
      Array.isArray(u.business) ? u.business[0]?.name : u.business?.name
    if (businessFilter && !businessName?.toLowerCase().includes(businessFilter.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Χρήστες πλατφόρμας</h1>
          <p className="text-muted-foreground">Επισκόπηση χρηστών όλων των επιχειρήσεων</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Φίλτρα</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="space-y-1">
            <Label>Ρόλος</Label>
            <Input
              placeholder="super_admin, admin, employee..."
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Κατάσταση</Label>
            <Input
              placeholder="active, inactive, pending..."
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Επιχείρηση</Label>
            <Input
              placeholder="Όνομα επιχείρησης"
              value={businessFilter}
              onChange={(e) => setBusinessFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Λίστα χρηστών</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <UsersIcon className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium text-foreground/80">Δεν βρέθηκαν χρήστες</p>
              <p className="text-sm">Δοκίμασε να αλλάξεις τα φίλτρα.</p>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {filtered.map((u) => {
                  const businessName = Array.isArray(u.business) ? u.business[0]?.name : (u.business as any)?.name
                  return (
                    <div key={u.id} className="rounded-lg border bg-card p-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.role} • {businessName ?? "—"} • {u.status}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden md:block rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Ονοματεπώνυμο</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ρόλος</TableHead>
                      <TableHead>Επιχείρηση</TableHead>
                      <TableHead>Κατάσταση</TableHead>
                      <TableHead>Δημιουργήθηκε</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => (
                      <TableRow key={u.id} className="odd:bg-muted/40">
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{u.role}</TableCell>
                        <TableCell>{(u.business as any)?.name ?? "—"}</TableCell>
                        <TableCell>{u.status}</TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

