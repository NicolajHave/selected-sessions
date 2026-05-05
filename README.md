# Selected Sessions

A live, host-controlled, Jeopardy-style music quiz built for a fashion/B2B team day. Editorial design, manual scoring, real-time updates via Supabase.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Realtime)
- Deployed on Vercel

## Routes

| Route | Description |
|---|---|
| `/` | Landing page with game code entry |
| `/join/[code]` | Player enters team name |
| `/play/[code]` | Live player view (mobile) |
| `/host` | Host passcode gate |
| `/host/dashboard` | List of games |
| `/host/game/[code]` | Live host control panel |
| `/screen/[code]` | Big screen / projector view |

## Environment variables

Create a `.env.local` file (or set on Vercel) with:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
HOST_PASSCODE=choose-your-own
```

> The service role key is used only by API routes (server-side) for host actions that bypass Row Level Security. Never expose it to the browser.

## Database setup

Run the SQL in `db/schema.sql` in Supabase SQL Editor, then run `db/seed.sql` to load the standard quiz.

## Deploy to Vercel

1. Push this repo to GitHub
2. On vercel.com, import the GitHub repo
3. Set the environment variables above
4. Deploy

## Game flow on the day

1. Host opens `/host` and signs in with the passcode
2. Open the `DEMO` session in the host control panel
3. Open `/screen/DEMO` in a separate browser window and project on the big screen
4. Players go to your Vercel URL, enter `DEMO`, and pick a team name
5. Host selects question → "Open answers" → players submit → "Lock answers" → "Reveal answer" → award points
6. "Back to board" to continue

## Adding audio later

Each question has a nullable `audio_url` field. Upload audio files to Supabase Storage (or any public URL host) and update the `questions` table with the URLs. The player and big-screen views automatically render an audio player when set.
