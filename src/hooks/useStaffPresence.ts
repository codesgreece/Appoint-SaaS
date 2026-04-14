import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { countStaffOnShiftNow } from "@/lib/staff-shift-presence"
import { fetchActiveTeamMemberCount, fetchWorkingStaffToday } from "@/services/api"

export type StaffPresenceState = { live: number; off: number } | null

/**
 * Live team presence from shifts + active users. Refetches on Supabase Realtime
 * changes to `shifts` or `users` for this business (requires tables in `supabase_realtime`).
 */
export function useStaffPresence(businessId: string | null): StaffPresenceState {
  const [state, setState] = useState<StaffPresenceState>(null)

  useEffect(() => {
    if (!businessId) {
      setState(null)
      return
    }
    const bid = businessId
    let alive = true

    async function loadPresence() {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const [rows, total] = await Promise.all([
          fetchWorkingStaffToday(bid, today),
          fetchActiveTeamMemberCount(bid),
        ])
        const live = countStaffOnShiftNow(rows, new Date())
        const off = Math.max(0, total - live)
        if (alive) setState({ live, off })
      } catch {
        if (alive) setState(null)
      }
    }

    void loadPresence()

    const channel = supabase
      .channel(`staff-presence:${bid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `business_id=eq.${bid}` },
        () => void loadPresence(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users", filter: `business_id=eq.${bid}` },
        () => void loadPresence(),
      )
      .subscribe()

    function onVisible() {
      if (document.visibilityState === "visible") void loadPresence()
    }
    document.addEventListener("visibilitychange", onVisible)

    const safety = window.setInterval(() => void loadPresence(), 300_000)

    return () => {
      alive = false
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(safety)
      void supabase.removeChannel(channel)
    }
  }, [businessId])

  return state
}
