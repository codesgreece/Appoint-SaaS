# Architecture Summary

## Multi-tenant model

- **Tenant** = one row in `businesses`.
- Every user has `business_id`; all app access is scoped to that business.
- All business-scoped tables include `business_id`; RLS restricts access to the current user's `business_id`.

## Database schema (main tables)

| Table | Purpose |
|-------|--------|
| `businesses` | Tenant; subscription fields (plan, status, max_users, max_customers, max_appointments) |
| `users` | Links auth.users to business; role, status |
| `staff_profiles` | Staff-specific data (phone, availability) |
| `customers` | Customer records per business |
| `services` | Services offered by business |
| `appointments_jobs` | Appointments/work orders; recurrence_rule, parent_appointment_id for recurring |
| `appointment_job_comments` | Comments on appointments |
| `appointment_job_audit_logs` | Audit: who, when, field, old/new value, reason |
| `payments` | Payment records (deposit, paid_amount, remaining_balance, payment_status) |
| `attachments` | File refs (entity_type, entity_id, file_path) |
| `activity_logs` | General activity log |
| `notification_preferences` | Per-user email preferences |

## RLS strategy

- **Helper:** `get_user_business_id()` returns the current user's `business_id` (SECURITY DEFINER).
- **Policy pattern:** For every business-scoped table:
  - `SELECT`: `business_id = get_user_business_id()`
  - `INSERT`: `business_id = get_user_business_id()` (via WITH CHECK)
  - `UPDATE` / `DELETE`: `business_id = get_user_business_id()`
- **businesses:** Users can only SELECT and UPDATE their own business row (no INSERT from app; tenants created by platform admin).
- **Storage:** Buckets `attachments` and `job_photos`; object path must start with `{business_id}/` so RLS restricts by folder.

## Role matrix

| Role | Scope | Typical use |
|------|--------|-------------|
| Super Admin | Platform | Future: manage all tenants |
| Admin | One business | Full access within business; create users |
| Employee | One business | Standard access |
| Reception | One business | Reception/front-desk access |

RLS does not differentiate by role; it only enforces `business_id`. Role-based UI or extra policies can be added later.

## Folder structure

- `src/components` – shared UI (ui/, layout/, forms)
- `src/contexts` – Auth (and optional theme)
- `src/hooks` – useToast, etc.
- `src/lib` – supabase client, utils
- `src/pages` – route-level pages
- `src/services` – Supabase/data API
- `src/types` – TypeScript and DB types
- `supabase/migrations` – schema, RLS, storage, seed
