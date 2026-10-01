# Boing Boing

A physics downhill racer inspired by **Kamikaze Robots**. Launch a spring-footed robot down jagged mountains, stick flat landings for huge bounces, and limp across the finish — even as a tin head if you have to.

Hosted as a static site on GitHub Pages.

## Play

- **Live (after Pages is enabled):** `https://dwisnowski.github.io/boing-boing/`
- **Local:** from the repo root run `python3 -m http.server 8080` and open `http://localhost:8080`

## Routes

Hash routes (static-hosting friendly):

| Path | Page |
| --- | --- |
| `#/` | Home — choose Bounce Race or Morse Trainer |
| `#/game` | Boing Boing downhill racer |
| `#/morse` | Morse Code Trainer (mobile-friendly) |

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
- **Morse Trainer** — interactive dichotomous Morse chart (Trainer Card Pro style): hold **Space** or **Key** for dits/dahs, watch the LED path light up, hear CW beeps, mute for silent practice, and use Record / Play to audit timing
- **Upgrades** — spend microchips on Stamina, Spin, Jump Springs, and Explosion

## Morse Trainer controls

| Action | Input |
| --- | --- |
| Key (hold) | **Space** or on-screen **Key** (short = dit, long = dah) |
| Dit / Dah (tap) | **.** / **-** or on-screen **Dit** / **Dah** |
| Mute / silent LED mode | **M** or **Mute** |
| Record / stop recording | **R** or **Record** |
| Play / stop playback | **P** or **Play** |
| Clear message & buffer | **Clear** |
| Back to menu | **Esc** or **Back** |

Short presses are dits (right / circle branch); longer presses are dahs (left / rectangle branch). Pause to commit a letter into the decoded message.

## Project layout

```
index.html
src/
  main.js       # route pages, game menus/shop/race, Morse boot
  router.js     # hash SPA router (#/, #/game, #/morse)
  game.js       # race loop, chips, finish rules
  robot.js      # tumble / bounce / limb loss / tin-head physics
  terrain.js    # downhill polyline mountains
  levels.js     # tournament stages
  render.js     # canvas drawing
  input.js      # hold-to-stabilize controls
  upgrades.js   # localStorage save + upgrade stats
  styles.css
  assets/
    morse-card-reference.jpg   # tight crop reference for canvas card
  morse/
    tree.js     # dichotomous Morse alphabet tree
    audio.js    # Web Audio CW tone
    decoder.js  # dit/dah + letter/word gap timing
    board.js    # canvas vector PCB card + LED glow
    trainer.js  # keying, decode, record/playback
.github/workflows/deploy.yml
```

## GitHub Pages

1. Merge to `main`
2. Repo **Settings → Pages → Source: GitHub Actions**
3. The deploy workflow publishes the static site
