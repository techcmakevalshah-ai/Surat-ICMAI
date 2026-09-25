# Surat ICMAI — Student Registration Finder

Standalone Next.js student lookup application with Supabase Auth + Row Level Security.

## Databases
- Foundation: `foundation_students`
- Intermediate: `intermediate_students`

The two course datasets are stored separately.

## Security model
- Anyone may create a Supabase Auth account.
- A new account gets **no student access** by default.
- Only users with an active row in `team_profiles` can read student records.
- RLS enforces this directly in PostgreSQL.
- The app uses only the public Supabase URL and publishable key.
- No service-role/secret key is needed in Vercel.

## Team onboarding
1. User chooses **Create a new team account** on the login page.
2. User confirms their email if Supabase asks for confirmation.
3. Admin approves the account by inserting its Auth UUID into `team_profiles`.
4. User logs in and can search Foundation / Intermediate / All.

## Student import
For future Excel updates, set `SUPABASE_SECRET_KEY` locally and run:

```bash
npm run import:students -- "INTER.xlsx" "FND.xlsx"
```

Never commit Excel files or a Supabase secret key.
