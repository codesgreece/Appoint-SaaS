# Telegram ειδοποιήσεις — έλεγχος λειτουργίας

Όλες οι **αυτόματες** ειδοποιήσεις (ουρά + triggers) επεξεργάζονται από το Edge Function **`process-telegram-events`**.  
Οι **άμεσες** αποστολές από την εφαρμογή (π.χ. κουμπί στο Dashboard) χρησιμοποιούν **`send-telegram-notification`**.

## Τι πρέπει να είναι ρυθμισμένο

### 1. Στη βάση (επιχείρηση)

Στις **Ρυθμίσεις → Telegram**:

- **Telegram ενεργό**, έγκυρο **Chat ID** και (προαιρετικά) **Bot token** ανά επιχείρηση.
- Αν δεν βάλεις token στην επιχείρηση, χρησιμοποιείται το **fallback** `TELEGRAM_BOT_TOKEN` στα Edge Functions (project secrets).

### 2. Secrets στο Supabase (Edge Functions)

| Μεταβλητή | Ρόλος |
|-----------|--------|
| `SUPABASE_URL` | Αυτόματα από Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Αυτόματα |
| `TELEGRAM_BOT_TOKEN` | Fallback bot αν η επιχείρηση δεν έχει δικό της token |
| `CRON_SECRET` | (Προαιρετικό) Κοινό μυστικό για κλήσεις cron: `Authorization: Bearer <CRON_SECRET>` |
| `TELEGRAM_WEBHOOK_SECRET` | (Προαιρετικό) Για webhook inline κουμπιών — header `x-telegram-bot-api-secret-token` |

### 3. Cron / χρονοπρόγραμμα (απαραίτητο για την ουρά)

Το **`process-telegram-events`** πρέπει να καλείται **τακτικά** (π.χ. κάθε 5 λεπτά), με:

```http
POST https://<PROJECT_REF>.supabase.co/functions/v1/process-telegram-events
Authorization: Bearer <CRON_SECRET>
```

(Αν **δεν** έχεις ορίσει `CRON_SECRET`, η συνάρτηση δέχεται κλήση χωρίς auth — λιγότερο ασφαλές.)

Από εκεί στέλνονται:

- Ειδοποιήσεις από την ουρά (`appointment_created`, ακυρώσεις, reschedule, πληρωμές, support).
- **Κλείσιμο ημέρας / βραδινό summary** (από τις **22:00** και μετά, τοπική ώρα **Europe/Athens**): έσοδα ημέρας (πληρωμές με `created_at` μέσα στην ημέρα), ολοκληρωμένα / ακυρώσεις / no-show για τα ραντεβού με ημερομηνία σήμερα, κρατήσεις για **αύριο**, και σύνοψη **ανά υπεύθυνο προσωπικό** (ολοκλ. / ακυρ. / no-show).
- **Πρωινή ενημέρωση** (περίπου **08:00** Europe/Athens): πόσα ενεργά ραντεβού έχεις σήμερα, λίστα ωρών (έως 30), και **κρατήσεις ανά ημέρα** για τις επόμενες **14** ημέρες (μόνο ενεργές καταστάσεις).
- Ειδοποιήσεις **ορίων πλάνου** και **λήξης συνδρομής** (με dedup μέσω `telegram_limit_alert_logs`).

### 4. Υπενθυμίσεις 30 λεπτά

Ξεχωριστό function: **`process-appointment-reminders`** — πρέπει να τρέχει **συχνά** (π.χ. κάθε 1–2 λεπτά), με τον ίδιο τρόπο auth όπως πάνω, για να πιάνει το παράθυρο «29–31 λεπτά πριν».

### 5. Inline κουμπιά (Confirm / Cancel / Reschedule)

Webhook: **`telegram-webhook`** — ρύθμιση στο BotFather με URL του function και (προαιρετικά) secret token = `TELEGRAM_WEBHOOK_SECRET`.

## Τι ελέγχει τι (mapping)

| Πηγή | Function / μηχανισμός |
|------|------------------------|
| Νέο ραντεβού, αλλαγή κατάστασης, reschedule | DB triggers → `telegram_notification_queue` → `process-telegram-events` |
| Πληρωμές | Triggers σε `payments` → ουρά → `process-telegram-events` |
| Support | Triggers σε `support_requests` / `support_request_messages` → ουρά |
| Υπενθύμιση 30′ | `process-appointment-reminders` (όχι η ουρά) |
| Κουμπί «στείλε έσοδα» κ.λπ. | `send-telegram-notification` από το frontend |

## Δοκιμή από την εφαρμογή

Στις **Ρυθμίσεις → Telegram** υπάρχει κουμπί **«Δοκιμαστικό μήνυμα»** — στέλνει ένα σύντομο test μέσω `send-telegram-notification`. Αν φτάσει στο chat, το bot + chat id + JWT session λειτουργούν.

## Αν δεν φτάνουν αυτόματα μηνύνματα

1. Έλεγξε ότι τρέχει cron στο **`process-telegram-events`**.
2. Έλεγξε `telegram_enabled` και chat id.
3. Στο Supabase → **Edge Functions → Logs** για σφάλματα Telegram API.
4. Δες πίνακα **`telegram_notification_queue`** (`status`, `error`) για αποτυχημένα jobs.
