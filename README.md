# RookieZ · ルーキー

The portfolio of **Sarthak Sinha** (RookieZ), GenAI engineer and builder of [Orion Store](https://github.com/RookieEnough/Orion-Store),
an open-source app store with 1.26M+ downloads, zero servers and 96 automated builds a day.

**Live:** https://rookiez.pages.dev

Built with React, a little Three.js and too much anime. The whole site is driven by the files in [`content/`](content/README.md):
new résumé, new project or new song means dropping a file in, not editing code.

## What's on it

- **Sakura gate.** A falling-petal intro. Visitors pick whether they come in with sound or without.
- **3D tool keyboard.** Every skill is a keycap on a mechanical keyboard that flies through the page as you scroll.
  Type the real letter and that key goes down. The skills come from `content/skills.json`.
- **Discman deck.** A spinning CD in the corner plays the songs in `content/music/`, or a lo-fi loop generated in the browser if the folder is empty.
  Tap the disc and the player slides out of it; leave it alone for 10 seconds and the disc draws it back in.
  Drag it to any edge of the screen and it stays there. Songs can have their own disc art (an image with the same name).
  The volume starts at 35% and is remembered.
- **Work.** Project cards with split-flap counters. The GitHub star counts are refreshed on every build.
- **Systems.** The Orion Store data pipeline as a diagram. Hovering a design-decision card lights up the box it is about.
- **Hire me.** A pull request, *Add Sarthak to your team*, whose CI checks pass one by one, plus a TL;DR table for recruiters.
- **Log, trading card, model card.** Experience timeline, a trading card that tilts under the cursor and flips, and a "model card" for me.
- **Contact.** Meishi (business) cards over an ink background you can stir with the cursor.
- **Extras.** Dark and light themes (with a view transition), a custom cursor on mouse devices,
  synthesized UI sounds, and a one-click résumé download.

## Stack

| | |
| --- | --- |
| App | React 19, TypeScript, Vite 8 |
| 3D | three.js, React Three Fiber, drei |
| Motion | GSAP + ScrollTrigger, Lenis smooth scroll |
| Styles | Tailwind CSS v4 |
| Sound | Web Audio API (every effect is synthesized, files optional) |
| Hosting | Cloudflare Pages, deployed by GitHub Actions |

No backend, no analytics, no trackers. It builds to a static folder.

## Run it locally

You need [Node.js](https://nodejs.org) 20.19+ or 22.12+.

- **Windows:** double-click `start.bat`. It installs dependencies on the first run and opens the site in your browser.
- **Anywhere:**

  ```sh
  npm install
  npm run dev
  ```

| command | what it does |
| --- | --- |
| `npm run dev` | dev server with instant reload, opens the browser |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serves the built `dist/` to check it before publishing |
| `npm run check` | type-checks the project |
| `npm run stats` | fetches the current GitHub star counts into the project cards (`-- --dry` only prints them) |

## Editing the content

Everything visitors see is in [`content/`](content/): profile, projects, skills, experience, the résumé PDF, the photo, songs and sound effects.
**[`content/README.md`](content/README.md)** explains every file. While `npm run dev` is running, saved changes show up in the browser instantly.

## Project layout

```
.
├── content/                  everything on the site (see content/README.md)
├── src/
│   ├── App.tsx               page shell: gate, nav, hero, toolkit, scroll wiring
│   ├── sections.tsx          Work, Systems, Hire, Log, Model card, Contact, Footer
│   ├── ui.tsx                cursor, music deck, split-flap, text reveals
│   ├── Keyboard.tsx          the 3D keyboard
│   ├── Disc.tsx              the 3D CD and its cover art
│   ├── Sakura.tsx            the petal gate
│   ├── Fluid.tsx             the ink simulation behind the contact cards
│   ├── audio.ts              music player and synthesized sound effects
│   ├── content.ts            loads content/ at build time
│   └── styles.css
├── scripts/refresh-stats.mjs GitHub star counts, run before every build in CI
├── docs/orion-website-deploy.yml   the workflow that rebuilds this site daily (lives in Orion-Website)
├── .github/workflows/deploy.yml    build on every PR, publish main to Cloudflare Pages
├── index.html                page title, SEO description, social previews
└── start.bat                 double-click to run locally on Windows
```

## Deploy

`main` is published to Cloudflare Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
Pull requests are type-checked and built, but not published.

One-time setup:

1. In Cloudflare, create an API token with the **Cloudflare Pages: Edit** permission
   (My Profile → API Tokens → Create Token → Custom token), and copy your **Account ID** from the Cloudflare dashboard.
2. In this repo on GitHub, add both under Settings → Secrets and variables → Actions:
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
   They are the same values the Orion-Website repo already uses.
3. Push to `main`, or run the workflow from the Actions tab. The first run creates the Pages project
   (`PAGES_PROJECT` in the workflow, `rookiez`, so the site is `rookiez.pages.dev`) and later runs update it.

Without the secrets the build still runs and the publish step is skipped with a warning, so forks don't fail.

The build uses relative asset paths, so `dist/` also works as-is on Netlify, Vercel, GitHub Pages or any static host, including under a sub-path.

## Daily rebuild

The star counts on the project cards are fetched from GitHub when the site is built (`npm run stats`).
They only change in that build: nothing is committed back, so the repo history stays clean.

To keep them fresh without a second scheduled workflow, this repo has no cron of its own. The deploy workflow in
[RookieEnough/Orion-Website](https://github.com/RookieEnough/Orion-Website) already runs on a schedule to refresh the Orion Store
site, so it rebuilds this portfolio too. It checks out this repo, refreshes the stats, builds and publishes it with its own Cloudflare secrets.
One action keeps both sites up to date. A copy of that workflow is in [`docs/orion-website-deploy.yml`](docs/orion-website-deploy.yml).

- Every day at 02:43 UTC (08:13 IST), and whenever *Run workflow* is pressed in Orion-Website's Actions tab.
- This repo must be public, and named as `PORTFOLIO_REPO` says in that workflow (`RookieEnough/My-Portfolio`).
  If it is renamed, update that line.
- `PORTFOLIO_PAGES_PROJECT` there must match `PAGES_PROJECT` here.
- GitHub pauses scheduled workflows in a public repo after 60 days without a commit.
  If the counts stop updating, re-enable the workflow in Orion-Website's Actions tab.

## Performance and accessibility

- The heavy parts (the 3D keyboard, the 3D disc, the petal gate) load as separate chunks after the page itself,
  and the 3D scenes only render a frame when something on them moves.
- Without WebGL 2, the keyboard becomes a plain skill list and the disc a flat CD. Nothing is lost.
- With *reduce motion* turned on in the OS, smooth scrolling, the keyboard's flight and the entrance animations are switched off.
- The custom cursor only appears with a mouse. On phones the keyboard sits in the page instead of flying over it.
- Icon buttons have accessible labels, the skill list is always there for screen readers, and the theme is set before the first paint so there is no flash.

## License

The code is licensed under [GPL-3.0](LICENSE), like everything else I ship.
The personal content (the résumé, photo, project write-ups and other files in `content/`) is mine. Please don't reuse it as your own.
If you fork the site for yourself, swap in your own `content/` folder.
