-- Seed data: 1 business, 10 customers, 3 services, 15 appointments, payments
-- After running migrations, create an auth user in Supabase Dashboard (Authentication -> Add user)
-- with e.g. admin@demo.com, then run in SQL Editor:
--   INSERT INTO public.users (id, business_id, full_name, email, role, status)
--   VALUES ('<auth-user-uuid>', (SELECT id FROM businesses LIMIT 1), 'Demo Admin', 'admin@demo.com', 'admin', 'active');

INSERT INTO businesses (
  id, name, business_type, phone, email, address,
  subscription_plan, subscription_status, max_users, max_customers, max_appointments
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Demo Business',
  'service',
  '+30 210 1234567',
  'contact@demobusiness.gr',
  'Αθήνα, Ελλάδα',
  'starter',
  'active',
  10,
  500,
  1000
) ON CONFLICT (id) DO NOTHING;

-- Customers
INSERT INTO customers (business_id, first_name, last_name, phone, email, address, area, postal_code, notes, tags) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Νίκος', 'Παπαδόπουλος', '6912345678', 'nikos@email.gr', 'Λεωφ. Σταδίου 10', 'Αθήνα', '10431', 'Πιστός πελάτης', ARRAY['vip']),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Μαρία', 'Γεωργίου', '6987654321', 'maria@email.gr', 'Οδ. Ερμού 5', 'Αθήνα', '10563', NULL, ARRAY['retail']),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Γιάννης', 'Κωνσταντίνου', '2103456789', 'giannis@email.gr', 'Πλατεία Ομονοίας 2', 'Αθήνα', '10431', NULL, '{}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ελένη', 'Δημητρίου', '6934567890', 'eleni@email.gr', 'Ακαδημίας 20', 'Αθήνα', '10672', 'Ζητάει πάντα το ίδιο τεχνικό', '{}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Δημήτρης', 'Αντωνίου', '2105678901', 'dimitris@email.gr', 'Πανεπιστημίου 15', 'Αθήνα', '10678', NULL, '{}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Κατερίνα', 'Μιχαήλ', '6945678901', 'katerina@email.gr', 'Σόλωνος 8', 'Αθήνα', '10672', NULL, ARRAY['new']),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Αλέξανδρος', 'Πέτρου', '2106789012', 'alex@email.gr', 'Βουκουρεστίου 25', 'Αθήνα', '10437', NULL, '{}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Σοφία', 'Ιωάννου', '6956789012', 'sofia@email.gr', 'Πατησίων 100', 'Αθήνα', '11144', NULL, '{}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Μιχάλης', 'Νικολάου', '2107890123', 'michalis@email.gr', 'Κηφισίας 50', 'Αθήνα', '11528', 'Εταιρικός πελάτης', ARRAY['corporate']),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Χριστίνα', 'Βασιλείου', '6967890123', 'christina@email.gr', 'Λ. Αλεξάνδρας 30', 'Αθήνα', '11473', NULL, '{}');

-- Services
INSERT INTO services (business_id, name, description, duration_minutes, price) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Συντήρηση κλιματιστικού', 'Ετήσια συντήρηση', 60, 50.00),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Εγκατάσταση υδραυλικών', 'Εγκατάσταση νέων σωληνών', 120, 150.00),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ηλεκτρολογικές εργασίες', 'Έλεγχος και επισκευές', 90, 80.00);

-- Appointments (assigned_user_id NULL until user exists) - use first 5 customers
INSERT INTO appointments_jobs (
  business_id, customer_id, title, status, scheduled_date, start_time, end_time,
  cost_estimate, final_cost, description, creation_notes
)
SELECT
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  (SELECT id FROM customers WHERE business_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' ORDER BY created_at LIMIT 1 OFFSET (s.n % 5)),
  'Ραντεβού #' || s.n,
  (ARRAY['pending', 'confirmed', 'in_progress', 'completed', 'completed', 'cancelled'])[1 + (s.n % 6)],
  (CURRENT_DATE + ((s.n || ' days')::interval))::date,
  (('09:00'::time + ((s.n * 30) || ' minutes')::interval))::time,
  (('10:00'::time + ((s.n * 30) || ' minutes')::interval))::time,
  50 + (s.n * 10),
  CASE WHEN s.n % 3 = 0 THEN 50 + (s.n * 10) ELSE NULL END,
  'Σημειώσεις εργασίας',
  'Δημιουργία από seed'
FROM generate_series(0, 14) AS s(n);

-- Payments for first 10 appointments
INSERT INTO payments (business_id, appointment_job_id, amount, payment_method, payment_status, deposit, paid_amount, remaining_balance)
SELECT
  aj.business_id,
  aj.id,
  COALESCE(aj.final_cost::numeric, aj.cost_estimate::numeric, 0),
  (ARRAY['cash', 'card', 'bank_transfer'])[1 + (row_number() OVER (ORDER BY aj.created_at)::int % 3)],
  (ARRAY['unpaid', 'partial', 'paid'])[1 + (row_number() OVER (ORDER BY aj.created_at)::int % 3)],
  COALESCE(aj.final_cost::numeric, aj.cost_estimate::numeric, 0) * 0.3,
  CASE (row_number() OVER (ORDER BY aj.created_at)::int % 3)
    WHEN 0 THEN COALESCE(aj.final_cost::numeric, aj.cost_estimate::numeric, 0)
    WHEN 2 THEN COALESCE(aj.final_cost::numeric, aj.cost_estimate::numeric, 0) * 0.5
    ELSE NULL
  END,
  CASE (row_number() OVER (ORDER BY aj.created_at)::int % 3)
    WHEN 0 THEN 0
    ELSE COALESCE(aj.final_cost::numeric, aj.cost_estimate::numeric, 0) * 0.5
  END
FROM appointments_jobs aj
WHERE aj.business_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
ORDER BY aj.created_at
LIMIT 10;
