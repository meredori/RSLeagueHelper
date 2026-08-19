# RS3 League Helper

A small static helper for RuneScape 3 **Leagues II: Equilibrium**.

## Features

- Paste the latest character JSON containing `league_tasks` and `levels`.
- Stores selected regions, relics, blessings, and strategy notes in browser local storage.
- Fetches the current Equilibrium task table from RuneScape Wiki and caches it locally.
- Calculates completed task / point totals and blessing-task progress.
- Filters tasks to selected regions and completed task IDs.
- Shows skill-ready remaining tasks and nearby skill breakpoints.
- Generates a **new-chat handoff** with low-point quick wins, high-completion tasks, transparent heuristic rankings, point buckets, and a configurable next-relic route with backups.
- Flags bulk production tasks that may be worth deferring until the expected Production Master relic; these are candidates, never automatic exclusions.
- Can export a full context JSON.

The **Next relic points** field defaults to 6,000 and is saved in the browser. The quick-win score is only a ranking aid based on completion percentage, task points, explicit numeric skill readiness and gaps, and blessing-task status. It does not infer whether quests, items, purchases, area access, combat, or production chains make a task practical; the export preserves the Wiki `info` and requirement text so ChatGPT can evaluate those prerequisites.

## GitHub Pages

`main` deploys automatically through `.github/workflows/pages.yml`.

Project-site URL:

`https://meredori.github.io/RSLeagueHelper/`

If a deployment ever reports that Pages is not configured, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.

## Privacy

The app is entirely client-side. Character JSON and manually entered settings remain in the browser unless you explicitly copy or download them.
