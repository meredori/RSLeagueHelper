# RS3 Equilibrium Context Exporter

A small static helper for RuneScape 3 **Leagues II: Equilibrium**.

## What it does

- Loads the complete Equilibrium task table from RuneScape Wiki and caches it in the browser.
- Accepts character JSON containing `league_tasks` and `levels`.
- Stores selected regions, relics, blessings, and character JSON in browser local storage.
- Records the point breakpoint for every relic tier and the task breakpoint for every blessing tier.
- Produces a ChatGPT-ready export containing the exact character object and every incomplete task from Global and the selected unlocked regions.

The exporter does not rank, truncate, or recommend tasks. A task is included when its region is selected and its numeric ID is absent from `character.league_tasks`.

## Usage

1. Wait for the task database to load.
2. Check every region the character has unlocked.
3. Select the character's relics and blessings by tier.
4. Paste the latest character JSON.
5. Select **Build export**, then **Copy complete context**.

## GitHub Pages

`main` deploys automatically through `.github/workflows/pages.yml`.

Project URL: [https://meredori.github.io/RSLeagueHelper/](https://meredori.github.io/RSLeagueHelper/)

## Privacy

The app is entirely client-side. Character JSON and selections remain in the browser unless the generated context is explicitly copied.
