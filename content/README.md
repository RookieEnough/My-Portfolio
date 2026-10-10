# content/: everything on the site lives here

Drop files in, save, and the site updates. No code edits needed.
While `npm run dev` (or `start.bat`) is running, changes show up in the browser instantly.

```
content/
├── resume.pdf          the résumé visitors download (any single .pdf in this folder)
├── avatar.jpg          your photo on the trading card (.png .jpg .webp .gif .avif)
├── profile.json        name, hero text, "hire me" section, socials, model card
├── skills.json         the 3D keyboard: one key per skill
├── experience.json     the experience timeline
├── systems.json        the Orion architecture diagram + design decisions
├── projects/           one folder per project
│   └── 01-orion-store/
│       ├── project.json
│       └── cover.png   (optional)
├── music/              songs for the Discman player
└── sfx/                your own sound effects (optional)
```

---

## Résumé

Replace `resume.pdf` with your new one. Any file name works, as long as it is the **only** `.pdf` in `content/`.
Visitors always download it as `Sarthak_Sinha_Resume.pdf` (built from `name` in `profile.json`).
The nav "Résumé" button, the hero button and the contact card all use it.

## Music

Drop audio files into `music/`: `.mp3 .ogg .wav .m4a .flac .aac .opus .webm`.

- Tracks play in file-name order. Prefix with numbers to set the order: `01-midnight.mp3`, `02-rain.mp3`.
- The LCD shows the file name as the title. Dashes and underscores become spaces.
- With more than one track, the prev/next buttons appear and tracks auto-advance.
- With the folder empty, the player generates a lo-fi loop live in the browser.

**Disc covers.** Drop an image next to a song with the same name and it is printed on the 3D disc while that song plays:
`02-rain.mp3` + `02-rain.jpg` (`.png .jpg .webp .avif .gif`). Matching ignores case, spaces, dashes and underscores,
so `Night Drive.mp3` pairs with `night_drive.png`. Square images work best; the middle is cropped around the hub hole.
Songs without a cover keep the default red label. A GIF shows its first frame only.

**How it behaves.** Folded away, the player is just the disc. Visitors can drag it to any edge of the screen,
and it remembers the spot. A tap slides the player out; it folds back into the disc after 10 seconds untouched.
Volume starts at 35%, is remembered per visitor, and only affects the music (not the sound effects).
The Music fader in the sound mixer moves the same level.

## Sound effects

Every sound is synthesized by default. To replace one, drop a file into `sfx/` named after it:

| file name        | when it plays                                     | mixer fader |
| ---------------- | ------------------------------------------------- | ----------- |
| `key`            | a key on the 3D keyboard goes down                | Keys        |
| `key-space`      | the space bar goes down (falls back to `key`)     | Keys        |
| `key-mod`        | shift / tab / ctrl / enter… (falls back to `key`) | Keys        |
| `keyup`          | a key comes back up                               | Keys        |
| `click`          | clicking any button or link                       | Clicks      |
| `tick`           | hovering a button or link                         | Clicks      |
| `scroll`         | a soft notch every so often while you scroll      | Scroll      |
| `toggle`         | dark / light switch                               | FX          |
| `whoosh`         | entering the site, flipping the trading card      | FX          |
| `flap`           | the split-flap counters rolling                   | FX          |
| `drop`           | stirring the ink in the contact section           | FX          |
| `pass`           | each CI check passing in the "hire me" PR         | FX          |
| `chime`          | all checks passed, email copied                   | FX          |

**The sound mixer.** The speaker button in the nav opens a small desk: an on/off switch and one fader each for
Keys, Clicks, Scroll, FX and Music. Moving a fader plays a sample of that channel. The effect faders start at 70%,
the level the sounds were made at (the top of a fader is about 1.7x louder, the bottom silent), and every level is
remembered per visitor. Reset puts them all back.

Any audio extension works (`key.wav`, `click.mp3`…). For variety, add numbered takes, `key-1.wav`, `key-2.wav`, `key-3.wav`, and one is picked at random on each press.
Keep them short and trimmed: no silence at the start, or they will feel laggy.

## Projects

Each folder in `projects/` is one project card. Folders are sorted by name, so the number prefix sets the order.

- **Add one:** copy a folder, rename it (`07-my-thing`), edit its `project.json`.
- **Remove one:** delete the folder.
- **Cover image:** drop `cover.png` (or `.jpg .webp .gif .avif`) into the folder. Optional.

```json
{
  "title": "Orion Store",
  "tagline": "The app store with nothing to hide.",
  "description": "One or two sentences on what it is and why it matters.",
  "year": "2022 → now",
  "tags": ["TypeScript", "React"],
  "featured": true,
  "stats": [{ "value": "1,260,000", "label": "downloads" }],
  "links": [{ "label": "Source", "url": "https://github.com/..." }]
}
```

Only `title`, `tagline` and `description` are required. `featured: true` gives the project the big card.
Numbers in `stats` roll in on a split-flap display.

## Keyboard (skills.json)

The 3D keyboard has 26 skill keys, the letters Q to M. The list fills them **in order**, in QWERTY order:

```
 Q  W  E  R  T  Y  U  I  O  P      entries  1–10
  A  S  D  F  G  H  J  K  L        entries 11–19
   Z  X  C  V  B  N  M             entries 20–26
```

Each entry is `{ "name": "Ollama", "note": "shown when the key is hovered or pressed" }`.
So the 1st entry sits on Q, the 11th on A, the 26th on M. Visitors can type the real letter to press that key.
Swap entries to move a skill to a different key. Keep names short (around 12 characters fits a keycap).
The modifier keys (tab, shift, "say hi" Enter, "ship it" space bar) are fixed.

## profile.json

| key            | what it controls                                                                    |
| -------------- | ----------------------------------------------------------------------------------- |
| `name`, `alias`, `nameJapanese` | hero name, nav logo, the vertical katakana                         |
| `roles`        | the `GenAI Engineer / LLM Systems Architect / …` line in the hero                   |
| `status`       | "status:" line at the bottom of the hero                                            |
| `hero.lead`    | the paragraph that streams in under your name                                       |
| `hero.availability` | the line under the contact headline                                            |
| `hire.badge`, `hire.looking` | the red "Open to work" pill and the text next to it                  |
| `hire.title`, `hire.summary` | the pull request header in the Hire section                           |
| `hire.checks`  | the CI checks that pass one by one (`value`, `title`, `note`)                       |
| `hire.roles`   | role chips in the Hire section                                                      |
| `hire.facts`   | the TL;DR table for recruiters (work mode, stack, education…)                       |
| `hire.subject` | the email subject line when someone clicks "Hire me"                                |
| `socials`      | the contact cards (`label`, `handle`, `url`, `jp` watermark, `verb` on the button, `tone` = card colour: `green`, `indigo`, `silver`, `violet`, `red`, `ink` or `paper`) |
| `modelCard`    | the "model card" joke table                                                         |
| `education`    | education list                                                                      |
| `email`, `location`, `timezone` | contact card, local clock, hire facts                              |

Also update the `<title>` and description in `/index.html` if your headline changes. That's what Google and link previews show.

## experience.json

A list of `{ "role", "org", "period", "points": [ ... ] }`, newest first. Order in the file is the order on the page.

## systems.json

The architecture section.

- `pipeline`: the boxes, left to right. Each has an `id`, `label` and `sub`.
- `side`: an extra box feeding into the pipeline node named in `into`.
- `decisions`: the design-decision cards. Each card's `node` must match a pipeline `id`; hovering the card lights that box up.

Wrap a word in `*stars*` in `title` to ink it red.

---

## Run it

- **Windows:** double-click `start.bat` in the project root.
- **Anywhere:** `npm install`, then `npm run dev`.
- **Publish:** `npm run build`, then upload the `dist/` folder to any static host (Cloudflare Pages, Netlify, Vercel, GitHub Pages).
