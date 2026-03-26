# Sinch Migration Roadmap

Salesmsg → Sinch SMS platform migration tracker — Clutch RevOps.

## Features

- Four-phase roadmap with task detail and subtasks
- Password-protected edit mode for updating task statuses
- Notes field per task (persisted in localStorage)
- Overall and per-phase progress tracking
- Mobile responsive

## Deploy to Vercel (3 steps)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init"
gh repo create sinch-roadmap --private --push --source=.
```

Or create a repo manually at github.com and push.

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repo
3. Framework will auto-detect as **Next.js**
4. Click **Deploy** — no environment variables needed

### 3. Share the URL

Vercel will give you a URL like `sinch-roadmap.vercel.app`.
Share it with stakeholders. Only you can edit statuses (password: `clutch2024`).

## Change the edit password

Edit this line in `src/app/page.tsx`:

```ts
const EDIT_PASSWORD = 'clutch2024'
```

Replace with any password, commit, and Vercel will redeploy automatically.

## Run locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Update task content

All roadmap content lives in `src/lib/data.ts`. Edit task titles, descriptions,
subtasks, or add new tasks there — no other files need to change.

## How status is stored

Status and notes are saved to `localStorage` in the viewer's browser. This means:
- **Your edits persist across sessions on your device**
- Stakeholders viewing the link see the default state unless you deploy updated defaults

If you want shared live state (everyone sees your updates), the next step is
adding a small Supabase table — ask Claude to add that when ready.
