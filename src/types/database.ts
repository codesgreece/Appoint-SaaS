export type UserRole = "super_admin" | "admin" | "employee" | "reception"
export type UserStatus = "active" | "inactive" | "pending"

export type SupportRequestType = "suggestion" | "issue"
export type SupportRequestStatus = "open" | "in_progress" | "resolved"

export type AppointmentJobStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled"

export type PaymentStatus = "unpaid" | "partial" | "paid"
export type ServiceBillingType = "fixed" | "hourly"

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "none"

export interface Business {
  id: string
  name: string
  business_type: string | null
  phone: string | null
  email: string | null
  address: string | null
  logo_url: string | null
  telegram_enabled: boolean
  telegram_chat_id: string | null
  telegram_bot_token: string | null
  telegram_notification_preferences: {
    appointment_created?: boolean
    appointment_cancelled_or_no_show?: boolean
    appointment_rescheduled?: boolean
    payment_recorded?: boolean
    support_incident_new?: boolean
    support_reply?: boolean
    daily_summary?: boolean
    morning_briefing?: boolean
    plan_limits?: boolean
    subscription_alerts?: boolean
    reminder_30m?: boolean
  } | null
  subscription_plan: string | null
  subscription_status: SubscriptionStatus | null
  subscription_started_at: string | null
  subscription_expires_at: string | null
  max_users: number | null
  max_customers: number | null
  max_appointments: number | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  business_id: string
  full_name: string
  username: string | null
  email: string
  role: UserRole
  status: UserStatus
  must_change_password: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
  /** Populated by app when loading business limits for the current tenant (not from DB). */
  business_limits?: {
    max_users?: number | null
    max_customers?: number | null
    max_appointments?: number | null
  }
}

export interface SupportRequest {
  id: string
  business_id: string
  created_by: string
  type: SupportRequestType
  status: SupportRequestStatus
  message: string
  business_name: string | null
  created_by_name: string | null
  created_by_username: string | null
  internal_notes: string | null
  has_unread_reply: boolean
  created_at: string
  updated_at: string
}

export type SupportRequestMessageSenderRole = "admin" | "super_admin"

export interface SupportRequestMessage {
  id: string
  support_request_id: string
  business_id: string
  sender_user_id: string
  sender_role: SupportRequestMessageSenderRole
  content: string
  created_at: string
}

export interface ChangelogEntry {
  id: number
  created_at: string
  title: string
  description: string | null
  visible: boolean
}

export interface StaffProfile {
  id: string
  business_id: string
  user_id: string
  phone: string | null
  availability: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  business_id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  address: string | null
  area: string | null
  postal_code: string | null
  company: string | null
  vat_number: string | null
  notes: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  business_id: string
  name: string
  description: string | null
  duration_minutes: number | null
  price: number | null
  billing_type: ServiceBillingType
  hourly_rate: number | null
  created_at: string
  updated_at: string
}

export interface AppointmentJob {
  id: string
  business_id: string
  customer_id: string
  assigned_user_id: string | null
  service_id: string | null
  title: string
  description: string | null
  status: AppointmentJobStatus
  scheduled_date: string
  start_time: string
  end_time: string
  cost_estimate: number | null
  final_cost: number | null
  creation_notes: string | null
  completion_notes: string | null
  recurrence_rule: string | null
  parent_appointment_id: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentJobComment {
  id: string
  business_id: string
  appointment_job_id: string
  user_id: string
  content: string
  created_at: string
}

export interface AppointmentJobAuditLog {
  id: string
  business_id: string
  appointment_job_id: string
  user_id: string
  changed_at: string
  field_name: string
  old_value: string | null
  new_value: string | null
  reason: string | null
}

export interface AppointmentJobService {
  id: string
  business_id: string
  appointment_job_id: string
  service_id: string
  created_at: string
}

export interface Payment {
  id: string
  business_id: string
  appointment_job_id: string
  amount: number
  payment_method: string | null
  payment_status: PaymentStatus
  deposit: number | null
  paid_amount: number | null
  remaining_balance: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: string
  business_id: string
  entity_type: string
  entity_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_by: string
  created_at: string
}

export interface ActivityLog {
  id: string
  business_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface NotificationPreference {
  id: string
  business_id: string
  user_id: string
  email_appointments: boolean
  email_payments: boolean
  email_team: boolean
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      businesses: { Row: Business; Insert: Omit<Business, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<Business> }
      users: { Row: User; Insert: Omit<User, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<User> }
      staff_profiles: { Row: StaffProfile; Insert: Omit<StaffProfile, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<StaffProfile> }
      customers: { Row: Customer; Insert: Omit<Customer, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<Customer> }
      services: { Row: Service; Insert: Omit<Service, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<Service> }
      appointments_jobs: { Row: AppointmentJob; Insert: Omit<AppointmentJob, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<AppointmentJob> }
      appointment_job_comments: { Row: AppointmentJobComment; Insert: Omit<AppointmentJobComment, "created_at"> & { created_at?: string }; Update: Partial<AppointmentJobComment> }
      appointment_job_audit_logs: { Row: AppointmentJobAuditLog; Insert: Omit<AppointmentJobAuditLog, "changed_at"> & { changed_at?: string }; Update: Partial<AppointmentJobAuditLog> }
      appointment_job_services: { Row: AppointmentJobService; Insert: Omit<AppointmentJobService, "created_at"> & { created_at?: string }; Update: Partial<AppointmentJobService> }
      payments: { Row: Payment; Insert: Omit<Payment, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<Payment> }
      attachments: { Row: Attachment; Insert: Omit<Attachment, "created_at"> & { created_at?: string }; Update: Partial<Attachment> }
      activity_logs: { Row: ActivityLog; Insert: Omit<ActivityLog, "created_at"> & { created_at?: string }; Update: Partial<ActivityLog> }
      notification_preferences: { Row: NotificationPreference; Insert: Omit<NotificationPreference, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }; Update: Partial<NotificationPreference> }
    }
  }
}
