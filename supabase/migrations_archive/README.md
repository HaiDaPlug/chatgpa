# Archived Migrations

This directory contains legacy Carpool migrations for historical reference only.

**These migrations are NOT applied to the ChatGPA database.**

---

## What's Here

19 legacy migration files from the Carpool AI project (V14-V16):
- Fuel/token management system
- LemonSqueezy billing integration
- Old tier system (Cruiser/Power/Pro)
- Account views and RPCs

---

## Active ChatGPA Schema

The active ChatGPA schema is in `/supabase/migrations/`:
- `20251021_chatgpa_init.sql` - Core ChatGPA tables (classes, notes, quizzes, quiz_attempts, usage_limits)

---

## Why Keep These?

- **Reference**: Understanding original Carpool architecture decisions
- **Documentation**: Context for what was refactored
- **History**: Git trail for infrastructure evolution

---

**Do not modify files in this archive.** All ChatGPA schema changes should be new migrations in the parent `/migrations/` directory.
