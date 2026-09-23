# Boing Boing

A physics downhill racer inspired by **Kamikaze Robots**. Launch a spring-footed robot down jagged mountains, stick flat landings for huge bounces, and limp across the finish — even as a tin head if you have to.

Hosted as a static site on GitHub Pages.

## Play

- **Live (after Pages is enabled):** `https://dwisnowski.github.io/boing-boing/`
- **Local:** from the repo root run `python3 -m http.server 8080` and open `http://localhost:8080`

## Controls

| Action | Input |
| --- | --- |
| Stabilize spin (brake rotation) | Hold **Space**, **S**, click, or touch |
| Tumble freely | Release |

Land **feet-down** on the slope to bounce and build speed. Holding stabilizes your angle but bleeds momentum. Crash landings rip off appendages one at a time — arm, arm, leg, leg. With only a torso left, slam into the ground to trigger the desperation **tin-head** launch (opposite the impact direction). When the head hits the ground, the run ends. Miss the finish and choose **Try Again** or **Quit**.

## Modes

- **Tournament** — climb a ladder of mountain stages; progress is saved locally
- **Quick Race** — one random mountain
- **Upgrades** — spend microchips on Stamina, Spin, Jump Springs, and Explosion

## Project layout

```
index.html
src/
  main.js       # menus, shop, race wiring
  game.js       # race loop, chips, finish rules
  robot.js      # tumble / bounce / limb loss / tin-head physics
  terrain.js    # downhill polyline mountains
  levels.js     # tournament stages
  render.js     # canvas drawing
  input.js      # hold-to-stabilize controls
  upgrades.js   # localStorage save + upgrade stats
  styles.css
.github/workflows/deploy.yml
```

## GitHub Pages

1. Merge to `main`
2. Repo **Settings → Pages → Source: GitHub Actions**
3. The deploy workflow publishes the static site
