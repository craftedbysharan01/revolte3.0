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
5. **Build (about 30 seconds).** The Code icon in the top bar turns blue and pulses. Open it: the sidebar closes, the pane
   widens, and you see the file tree, the file being written and the terminal. Click any file to pin it, **Follow Revolte** to resume.
6. **Preview.** When the build is verified the preview (the Hookwatch home page with a live deliveries panel) replaces the code view in place and the sidebar stays closed.
   If you never opened Code, the Sandbox tab opens in the regular layout with the sidebar as it was.
7. **Repository.** Connect repository sits under the environment line on the Overview tab.
8. **Environment.** The gear on the Overview tab (or Environments in the sidebar) opens the environment modal:
   start script, variables, secrets, network access.

The agent runs at 4× real time, so the build takes about 30 seconds. `?speed=10&prompt=...` in the URL changes the speed and starts a run directly.

## Files

- `index.html` shell, landing, pane and modal markup
- `styles.css` tokens (Revolte DS 3.0) and all motion
- `data.js` the scripted scenario: questions, plan, build steps, file contents, preview rows
- `app.js` virtual clock, agent script, code view, preview reveal, environment modal
- `icons.js` Solar icons rendered to static SVG

Not simulated: the "Needs your OK" approval step and the "Finished" summary screen.

## Keyboard shortcuts

Hover a control to see its shortcut. Ctrl on Windows and Linux, Cmd on Mac.

| Shortcut | Action |
| --- | --- |
| Mod+Shift+O | New chat |
| Mod+K | Search |
| Mod+B | Show or hide the sidebar |
| Mod+. | Show or hide the session pane |
| Mod+1 to Mod+5 | Overview, Sandbox, Code, Files, Workflow |
| Mod+Enter | Approve the plan |

Icons: one outline family everywhere (Lucide, `lucide-icons.js`). Brand marks (Revolte, Claude, GitHub) are the originals.
