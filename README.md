# Student Registration Finder

Standalone Next.js app for secure student registration lookup using Supabase and Vercel.

## Features
- Team email/password login through Supabase Auth
- Search by student name, mobile, or registration number
- Displays FND/INTER source and complete student details
- Student data is not bundled into frontend code
- Search API verifies the signed-in user and active team profile server-side
- RLS enabled; student tables are not readable directly by browser roles
- Excel importer supports the INTER and FND workbook formats

## Setup
1. Create a new Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Create team users in Supabase Auth.
4. Insert matching rows into `team_profiles` using each Auth user UUID.
5. Copy `.env.example` to `.env.local` and add your project URL, publishable key and secret key.
6. Install dependencies: `npm install`
7. Import students:
   `npm run import:students -- "/path/INTER 24-09-2026.xlsx" "/path/FND 24-09-2026.xlsx"`
8. Run locally: `npm run dev`
9. Import the repository into Vercel.
10. Add the same 3 environment variables in Vercel and deploy.

## Privacy
Do not commit the Excel files or normalized student data. `.gitignore` excludes spreadsheet files.
