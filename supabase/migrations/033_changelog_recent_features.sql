-- Add latest delivered features to panel changelog.
INSERT INTO public.changelog_entries (title, description, visible)
VALUES
  (
    'Υπενθυμίσεις Συντήρησης: δημιουργία, μεταφορά και dashboard widget',
    'Προστέθηκε πλήρες MVP για service reminders: δημιουργία από ολοκλήρωση ραντεβού, φίλτρα pending/completed/overdue, ενέργειες ολοκλήρωσης/ακύρωσης/μεταφοράς και κάρτα στο Dashboard.',
    true
  ),
  (
    'Ημερήσια Διαδρομή: σειρά εργασιών & άνοιγμα σε Google Maps',
    'Νέα σελίδα «Ημερήσια Διαδρομή» με drag-and-drop για τα σημερινά ραντεβού, αποθήκευση σειράς (order_index) και κουμπί «Άνοιγμα διαδρομής» σε Google Maps.',
    true
  ),
  (
    'Public Site: animated στατιστικά στην σελίδα /site',
    'Προστέθηκε premium section με count-up αριθμούς (IntersectionObserver + animation μόνο μία φορά): ενεργές επιχειρήσεις, κλεισμένα ραντεβού, πελάτες και συναλλαγές.',
    true
  );
