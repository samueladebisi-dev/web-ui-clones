# Web UI Clones

Front-end study clones of three well-known sites, written in plain HTML, CSS and JavaScript with no framework and no build step. A gallery page (`index.html`) links to all three, and a headless-browser test suite checks that each page loads cleanly and that its interactive parts work.

These are study projects. They are not affiliated with or endorsed by Amazon, Meta (Instagram) or Netflix, and they use no images or logos from those companies: every picture is a drawing made for this repository.

## Clones

| Clone | What it shows |
|---|---|
| [Amazon](amazon/) | A shopping site home page: header with search, category bar, banner, a grid of twelve category boxes and a footer. HTML and CSS only. |
| [Instagram](instagram/) | A feed with a scrollable stories strip, posts with several images and dot indicators, suggestions sidebar, and a light/dark theme that is remembered between visits. |
| [Netflix](netflix/) | A streaming service landing page: hero with email sign-up, four feature sections and an FAQ accordion. |

## Running locally

The pages work when opened straight from disk, but serving the folder matches how they run on a web host:

```bash
npm start            # serves this folder on http://127.0.0.1:8080/
PORT=3000 npm start  # or pick another port
```

`npm start` uses a small static server in `tests/serve.mjs` that needs only Node.js (18 or later), so it works before `npm install`. The Instagram and Netflix pages load their fonts from Google Fonts; everything else is local.

## Tests

The tests drive the pages in headless Chromium through [Playwright](https://playwright.dev/).

```bash
npm install
npx playwright install chromium   # first time only
npm test
```

`npm test` runs two scripts:

- **Smoke test** (`tests/smoke.mjs`): opens the gallery and each clone, and fails on uncaught errors, console errors, or a reference to a local file that doesn't exist. It lists every outside host a page contacts, so a hotlinked image would show up, and checks that the gallery links to every clone.
- **Interaction checks** (`tests/interactions.mjs`):
  - Amazon: no sideways scrolling at 1280, 800 and 390 pixels wide, with four, two and one category boxes per row.
  - Instagram: dark mode survives a reload (and so does switching back), and the stories arrows scroll the strip and appear only when there is somewhere to scroll.
  - Netflix: an FAQ answer opens and closes, its plus icon turns into a cross, and the other answers stay closed.

To run either one for selected clones:

```bash
npm run test:smoke -- netflix
npm run test:interactions -- instagram
```

If you already have a Chromium build, you can point the tests at it instead of installing one: `CHROMIUM_PATH=/path/to/chrome npm test`.

## What changed in this version

The clones began as existing study projects. This version reworks them into a tested collection:

- **Own artwork instead of brand images.** The Netflix clone hotlinked its pictures and videos from Netflix's servers, and the Amazon clone shipped Amazon's logo and product photos. Both now use SVG drawings in their `assets/` folders, as does Instagram in place of its logo image. The logos are styled text.
- **Inline icons.** Netflix loaded a paid Font Awesome kit and Amazon loaded Font Awesome from a CDN; both now use small inline SVG icons.
- **Responsive Amazon page.** It had no small-screen styles. It now has tablet and phone layouts, square category images, and "See more" links that are no longer cut off under two-line headings.
- **Netflix FAQ.** The accordion script was rewritten to use `aria-expanded`, so screen readers know whether an answer is open, and the icon is animated in CSS.
- **Cleanup.**
  - Copied copyright lines for Amazon and Instagram were replaced with a not-affiliated note.
  - A real customer-service phone number and a real show title were removed.
  - Page titles were fixed, along with a duplicate element id and a few CSS typos.
- **Tests and tooling.** The smoke test, interaction checks, static server and gallery page are new.

## License

The Netflix and Instagram clones are MIT-licensed by their original authors; their license files are kept in [netflix/LICENSE](netflix/LICENSE) and [instagram/LICENSE](instagram/LICENSE). Everything else is MIT, see [LICENSE](LICENSE).
