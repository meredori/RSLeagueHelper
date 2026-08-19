# RS3 League Helper

A small static helper for RuneScape 3 **Leagues II: Equilibrium**.

## Features

- Paste the latest character JSON containing `league_tasks` and `levels`.
- Stores selected regions, relics, blessings, and strategy notes in browser local storage.
- Fetches the current Equilibrium task table from RuneScape Wiki and caches it locally.
- Calculates completed task / point totals and blessing-task progress.
- Filters tasks to selected regions and completed task IDs.
- Shows skill-ready remaining tasks and nearby skill breakpoints.
- Generates a compact **new-chat handoff** for ChatGPT.
- Can export a full context JSON.

## GitHub Pages

`main` deploys automatically through `.github/workflows/pages.yml`.

Expected project-site URL:

`https://meredori.github.io/RSLeagueHelper/`

If the first deployment reports that Pages is not configured, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.

## Privacy

The app is entirely client-side. Character JSON and manually entered settings remain in the browser unless you explicitly copy or download them.
