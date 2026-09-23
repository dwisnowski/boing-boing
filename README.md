# Boing Boing

A 2D side-scrolling web game, hosted on GitHub Pages.

## Play

- **Live:** once GitHub Pages is enabled, the game will be at  
  `https://dwisnowski.github.io/boing-boing/`
- **Local:** open a static server from the repo root, e.g.  
  `python3 -m http.server 8080`  
  then visit `http://localhost:8080`

## Controls

| Action | Keys |
| --- | --- |
| Move | ← → or A D |
| Jump | ↑ W Space |
| Start | Enter, Space, or click the canvas |

## Project layout

```
index.html          # entry point
src/
  main.js           # boots the game
  game.js           # world, camera, render loop
  player.js         # player movement & drawing
  input.js          # keyboard handling
  styles.css        # shell UI
.github/workflows/
  deploy.yml        # deploys to GitHub Pages on push to main
```

## GitHub Pages setup

This repo deploys with GitHub Actions (`.github/workflows/deploy.yml`).

1. Merge to `main`.
2. In the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. After the workflow runs, the site URL appears under **Settings → Pages**.

No build step is required — the game is static HTML, CSS, and ES modules.
