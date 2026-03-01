-- supabase/migrations/003_fix_status_check_constraint.sql
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- The businesses_status_check constraint was missing 'pending_payment',
-- causing paid-tier submissions to fail with a constraint violation error.
-- This migration drops and recreates the constraint with the correct values.

-- Drop the existing constraint (may have been created manually without pending_payment)
alter table public.businesses
    drop constraint if exists businesses_status_check;

-- Recreate with all valid status values
alter table public.businesses
    add constraint businesses_status_check
    check (status in ('pending', 'pending_payment', 'approved', 'rejected'));
