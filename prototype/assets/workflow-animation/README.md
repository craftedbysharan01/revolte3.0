# Workflow animation

The Curate workflows / Workflow studio animation: trigger → developer agent → QA agent → draft PR,
with two cursors. 11 second loop; timings come from the Figma motion data (node 4890:12816).

| File | Use |
| --- | --- |
| `workflow-animation.html` | Self-contained HTML/CSS (no JS). Open it, or lift `.wf-stage` and its CSS into a page. Scale with `--k` on `.flow`. |
| `workflow-animation.mp4` | H.264, 1280×360, 11 s, loops cleanly. |
| `workflow-animation.webm` | VP9, same as the MP4, smaller. |
| `workflow-animation.gif` | 960 px wide, 20 fps, for docs and Slack. |
| `poster.png` | Still of the completed flow, for a video poster or fallback. |

Icons are the same Lucide outline family as the prototype; the Claude and GitHub marks are the originals.
