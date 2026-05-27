# Loome Admin — Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com and create a free account
2. Create a new project (pick any name, e.g. "loome-admin")
3. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Create .env.local

Copy `.env.local.example` to `.env.local` and fill in the values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
AUTH_SECRET=loome-admin-secret-change-this-to-something-long-and-random
```

## 3. Deploy to Vercel (no GitHub)

Install Vercel CLI if not already installed:
```
npm i -g vercel
```

From the `loome-admin` folder:
```
vercel
```

Follow the prompts:
- Set up and deploy: **Y**
- Link to existing project: **N**
- Project name: **loome-admin**
- In which directory is your code: **./** (current)
- Want to override settings: **N**

After first deploy, set the environment variables in Vercel:
```
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add AUTH_SECRET
```

Then redeploy for production:
```
vercel --prod
```

## Login Credentials

- **Username**: loome
- **Password**: hairremoval
