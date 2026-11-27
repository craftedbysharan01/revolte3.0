# Revolte 3.0 · Chat prototype (standalone)

New chat landing → clarifying questions → plan → a two-minute build you can watch → sandbox preview.
Plain HTML, CSS and JS. No install, no build: open `index.html`, or serve the folder.

```bash
npx serve prototype
```

## What to try

1. **Landing.** The Curate workflows card runs the 11s Figma timeline and its glow drifts slowly.
2. **Type any prompt.** Every prompt runs the same webhook delivery dashboard scenario.
3. **Questions.** Pick an option, type your own answer, or skip to use the recommended ones.
4. **Plan.** Approve it, or reply with feedback to get a revised plan. **View plan** opens `plan.md` in the right pane.
5. **Build (about 2 minutes at 1×).** The Code tab pulses and a hint points at it. Open it: the sidebar closes, the pane
   widens, and you see the file tree, the file being written and the terminal. Click any file to pin it, **Follow Revolte** to resume.
6. **Preview.** When the build is verified the preview replaces the code view in place and the sidebar stays closed.
   If you never opened Code, the Sandbox tab opens in the regular layout with the sidebar as it was.
7. **Environment.** The gear on the Overview tab (or Environments in the sidebar) opens the environment modal:
   start script, variables, secrets, network access.

**Prototype speed** (top right) runs the agent at 1×, 4× or 10×. `?speed=10&prompt=...` in the URL starts a run directly.

## Files

- `index.html` shell, landing, pane and modal markup
- `styles.css` tokens (Revolte DS 3.0) and all motion
- `data.js` the scripted scenario: questions, plan, build steps, file contents, preview rows
- `app.js` virtual clock, agent script, code view, preview reveal, environment modal
- `icons.js` Solar icons rendered to static SVG

Not simulated: the "Needs your OK" approval step and the "Finished" summary screen.
