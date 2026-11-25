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

## Chat flow (Figma page 02 · Chat and sandbox)

A request from the website lands **directly in the chat** after workspace setup (Figma C01); starting from the home screen (N01) opens the same chat.
The chat is two panes: the conversation on the left, the session pane on the right (Overview, Sandbox, Code changes, Files, Workflow).

1. **Grill**: Revolte reads the request, starts the sandbox, then asks 3 questions (recommended answers pre-selected, Skip, own answer).
2. **Plan**: approve, or request changes (the plan is revised). **View plan** opens Plan.md.
3. **Tasks / Build**: live task list and edits. Stop, Resume, and queue a message while it runs.
4. **Verify**: lint, tests, Prettier. A failing test retries automatically (retry 2 of 3); after 3 failures you choose how to continue.
5. **Sandbox ready**: preview in the Sandbox tab (draggable divider, 35%–70%), Code changes, Files.
6. **GitHub and PR**: Connect GitHub (dialog, token option) → Commit and push → Create PR → draft PR opened + Workflow studio card.

Prototype panel: switches for **tests keep failing**, **sandbox does not start**, **out of credits**, **network offline**, **GitHub connect fails**, and the Figma states
C01–C21, C27, R01–R14 (section 09–10) as jumpable ids. Chats persist in localStorage; a run that was mid-flight on reload comes back as Stopped.

Code: `src/chat/engine.ts` (mock agent), `src/chat/ChatView.tsx` (conversation), `src/chat/RightPane.tsx` (session pane, GitHub dialog, PR),
`src/chat/Home.tsx` (new chat), `src/chat/presets.ts` (Figma states).

## Edge cases (Figma section 24)

Built: Manual mode review queue (EC01-EC04, Allow / Deny, switching to Auto releases the queue), background tasks (EC05, EC06, EC08), sandbox hours used up
(EC09-EC11b, switch in the Prototype panel), Choose application (EC12-EC16, also from Create application in the sidebar), sidebar status marks and collapsed
project summary (EC18-EC20), model switched mid-chat (MS01-MS02). A request from the website opens its chat however you arrive (sign up, GitHub, sign in).

## UI stack

New screens use **shadcn/ui** (`src/components/ui`, Radix + Tailwind v4) and **Solar** icons (`src/components/solar.tsx`: Linear by default, Bold when active),
as the Revolte Design System 3.0 specifies. Tailwind runs without preflight so the onboarding screens (plain CSS) are unchanged; the `rv` class scopes the few resets shadcn needs.

## Not in this prototype

Website sections below the hero, upgrade / buy credits flow, Create application dialogs (C15d–n), the existing-user plan-to-workflow
screens (H01–H13), Plan.md side panel (OV01–02), EC07 / EC13 states that need an open menu, and the New chat pickers N05–N25 beyond a basic Agent / mode / model menu.
