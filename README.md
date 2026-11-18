# Chinmay Career Tracker

Mobile PWA for tracking job opportunities, applications and employer responses.

- **Frontend:** React 18 + Vite PWA, deployed to GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)
- **Backend:** Supabase project `Chinmay Career Tracker` (`kthwrqikcpoparckkvvr`, eu-central-1)
- **Access:** email + password; only emails in `public.allowed_users` can see data (Row Level Security)

## Flow
1. Daily scheduled task (06:38 Berlin) finds openings → inserts into `opportunities` (codes A001…E999 auto-assigned per section) → emails Chinmay.
2. Chinmay selects opportunities in the app → `applications` rows with status `submitted`.
3. Scheduled task (07:38 & 19:38 Berlin) writes cover letter + tips → status `letter_ready` → emails Chinmay.
4. Chinmay logs the mail he sent + date → `sent`; logs the reply + date → `response_received`.
5. Insights tab: per-section reply rates and average days to response.

## Sections
A Best-fit · B Needs B2 German · C Needs driving licence · D Part-time income · E Plan B other countries

## Local dev
```bash
npm install
npm run dev
```
