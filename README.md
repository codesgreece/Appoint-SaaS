# Appoint SaaS – Multi-tenant Appointment & Job Management

Production-grade, multi-tenant SaaS for appointments, jobs, customers, team, and basic finances. Built for small businesses and freelancers (plumbers, electricians, salons, clinics, etc.).

## Tech Stack

- **Frontend:** React 18, TypeScript, TailwindCSS, shadcn/ui, Framer Motion, React Hook Form, Zod, TanStack Table, Recharts, date-fns, Lucide Icons
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Row Level Security)

## Multi-tenancy

- Each **business** is a tenant.
- All users belong to a **business** (`business_id`).
- Every business-scoped table has **business_id** and RLS enforces **tenant isolation** (users see only their business data).
- No cross-tenant data access is possible.

## Prerequisites

- Node.js 18+
- Supabase project

## Setup

### 1. Clone and install

```bash
cd d:\App
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the migrations in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_storage.sql`
   - `supabase/migrations/004_seed.sql`

### 3. Create first user (after seed)

1. In Supabase Dashboard go to **Authentication → Users → Add user**.
2. Create a user (e.g. `admin@demo.com` with a password).
3. Copy the user **UUID**.
4. In **SQL Editor** run:

```sql
INSERT INTO public.users (id, business_id, full_name, email, role, status)
VALUES (
  '<paste-auth-user-uuid-here>',
  (SELECT id FROM businesses LIMIT 1),
  'Demo Admin',
  'admin@demo.com',
  'admin',
  'active'
);
```

### 4. Environment

```bash
cp .env.example .env
```

Edit `.env`:

- `VITE_SUPABASE_URL` = your project URL (Project Settings → API)
- `VITE_SUPABASE_ANON_KEY` = your anon/public key

### 5. (Optional) Deploy Edge Function for adding team members

Business admins can add team members from the **Team** page. This requires the `invite-team-member` Edge Function:

```bash
supabase functions deploy invite-team-member
```

The function uses `SUPABASE_SERVICE_ROLE_KEY` to create auth users and insert into `public.users`. Only users with role `admin` or `super_admin` can call it; they can only add users to their own business.

### 6. Run the app

```bash
npm run dev
```

Open `http://localhost:5173`: **`/`** is always the **public marketing page** (like `/book/...` — no panel, works even when logged in). The app lives at **`/dashboard`** after **Login**.

## Project structure

```
src/
  components/     # UI components (shadcn), layout, forms
  contexts/      # AuthContext
  hooks/         # useToast, etc.
  lib/           # supabase client, utils
  pages/         # Dashboard, Customers, Appointments, Calendar, Team, Payments, Reports, Settings
  services/      # API / Supabase data functions
  types/         # TypeScript types and DB types
supabase/
  migrations/    # 001 schema, 002 RLS, 003 storage, 004 seed
```

## Features

- **Auth:** Supabase Auth, no public sign-up; businesses/users created by admin.
- **Dashboard:** Today’s appointments, pending/in-progress/completed counts, revenue today/month, outstanding balances, chart.
- **Customers:** CRUD, search, filters, tags, full profile fields.
- **Appointments/Jobs:** Unified module with statuses (Pending, Confirmed, In Progress, Completed, Cancelled, No Show, Rescheduled), cost estimate/final cost, recurrence rule field, comments/audit ready in schema.
- **Calendar:** Month view with appointments per day.
- **Team:** List of users with role and status.
- **Payments:** List with payment status (unpaid/partial/paid), amount, method.
- **Settings:** Business info and theme (light/dark/system).
- **Subscription-ready:** `businesses` has `subscription_plan`, `subscription_status`, `subscription_expires_at`, `max_users`, `max_customers`, `max_appointments` (billing not implemented).

## Roles

- **Super Admin** – (reserved for platform-level)
- **Admin** – full access within the business
- **Employee** – standard access
- **Reception** – reception-level access

RLS is by `business_id`; role-based UI restrictions can be added on top.

## Storage

Buckets: `attachments`, `job_photos`. Paths are tenant-scoped: `{business_id}/jobs/`, `{business_id}/customers/`. RLS on `storage.objects` restricts access by path prefix.

## Telegram notifications

Αυτόματες ειδοποιήσεις (ραντεβού, πληρωμές, support, digests, όρια) περνάνε από Edge Functions και χρειάζονται **cron** + secrets. Λεπτομέρειες: **[docs/TELEGRAM_SETUP.md](docs/TELEGRAM_SETUP.md)**.

Στις **Ρυθμίσεις → Telegram** μπορείς να στείλεις **δοκιμαστικό μήνυμα** για να επιβεβαιώσεις bot + chat id.

## Deploy

Build:

```bash
npm run build
```

Serve the `dist/` folder with any static host (Vercel, Netlify, etc.). Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in the deployment environment.
