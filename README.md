# Boing Boing

[![Play on GitHub Pages](https://img.shields.io/badge/Play-GitHub%20Pages-2ea44f?style=for-the-badge&logo=github)](https://boing.wildideazone.com/)

A physics downhill racer inspired by **Kamikaze Robots**. Launch a spring-footed robot down jagged mountains, stick flat landings for huge bounces, and limp across the finish — even as a tin head if you have to.

Hosted as a static site on GitHub Pages.

Looking for the Morse code trainer that used to live here? It moved to its own repo, [morse-code-trainer](https://github.com/dwisnowski/morse-code-trainer), live at [morse.wildideazone.com](https://morse.wildideazone.com/).

## Play

- **Live:** [boing.wildideazone.com](https://boing.wildideazone.com/)
- **Local:** from the repo root run `python3 -m http.server 8080` and open `http://localhost:8080`

## Controls

| Action | Input |
| --- | --- |
| Brace / stabilize spin | Hold **Space**, **S**, click, or touch |
| Correct spin backward | Hold **A** or **←** |
| Timed bounce pump | Tap **W**, **↑**, **E**, or **D** just before landing (right-click also works) |
| Tumble freely | Release |

Land **feet-down** on the slope to bounce and build speed. Holding stabilizes your angle but bleeds momentum. Tap the pump right before impact for a **BOOST BOING**. Crash landings rip off appendages one at a time — arm, arm, leg, leg. With only a torso left, slam into the ground to trigger the desperation **tin-head** launch (opposite the impact direction). When the head hits the ground, the run ends. Miss the finish and choose **Try Again** or **Quit**.

## Modes

- **Tournament** — climb a ladder of mountain stages; progress is saved locally
- **Quick Race** — one random mountain
- **Upgrades** — spend microchips on Stamina, Spin, Jump Springs, and Explosion

## Project layout

```
index.html
src/
  main.js       # game menus/shop/race boot
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

### Custom domain (`boing.wildideazone.com`)

DNS lives on Cloudflare: `boing` is a CNAME to `dwisnowski.github.io`, **DNS only** (grey cloud) so
GitHub can issue the HTTPS certificate. The workflow deploys via Actions, so the domain is set in
**Settings → Pages → Custom domain** (a `CNAME` file in the repo is ignored), then enable
**Enforce HTTPS** once the certificate is ready.
