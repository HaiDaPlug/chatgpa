-- Migration: Add description column to classes table
-- Date: 2025-11-01
-- Purpose: Support class descriptions in the UI

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS description text;
