# Revolte 3.0 · Onboarding prototype

Interactive prototype of Figma page **01 Onboarding** (website → sign up → verify → sign in →
forgot password → workspace setup → Get started). Vite + React + TypeScript, no UI libraries.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

## Reviewing against Figma

Click **Prototype** (bottom right) to:

- **Jump to any of the 61 Figma states** by id (U01…U25, S01…S10, F01…F08, W01…W13, GS-F01…F09).
- **Simulate failures**: network offline, server error on workspace create, GitHub connect fails.
- Read the **mock inbox** (verification codes, reset links) and reset all prototype data.

## Test data

| What | Value |
| --- | --- |
| Registered account | `james@acmecorp.com` / `Revolte@2024x` |
| GitHub-only account | `github@acmecorp.com` |
| Verification code | `670381` (`000000` = expired, anything else = wrong, 5 tries then a 15 min pause) |
| Taken usernames | `james`, `admin`, `revolte` |
| Taken workspace URLs | `acme`, `revolte`, `admin` |
| Sign in | 5 wrong passwords pauses sign in for 15 min |

## Structure

- `src/api.ts` mock backend (latency, lockouts, one-time reset links, offline switch)
- `src/store.ts` state, localStorage persistence, hash routing
- `src/screens/*` one file per flow; each takes a `preset` that hydrates a Figma state
- `src/dev/*` the prototype panel and the state table
- `public/assets` logo, submark, spinner, auth grid (exported from Figma)

## Not in this prototype

Website sections below the hero, the real Chat / Sandbox modules (the shell behind Get started is
a placeholder), upgrade flow, and Create application / Jira / Run workflow steps (they mark done).
