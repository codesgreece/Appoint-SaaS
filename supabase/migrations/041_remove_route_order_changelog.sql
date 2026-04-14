-- Remove old changelog entries related to Route Order feature.
DELETE FROM public.changelog_entries
WHERE title ILIKE '%Ημερήσια Διαδρομή%'
   OR description ILIKE '%Ημερήσια Διαδρομή%'
   OR title ILIKE '%Daily Route%'
   OR description ILIKE '%Daily Route%'
   OR title ILIKE '%Tagesroute%'
   OR description ILIKE '%Tagesroute%';
