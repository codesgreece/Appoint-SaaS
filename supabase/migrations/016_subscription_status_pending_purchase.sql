-- App uses pending_purchase for businesses that have not bought a plan yet (standard onboarding).
ALTER TYPE subscription_status_enum ADD VALUE 'pending_purchase';
