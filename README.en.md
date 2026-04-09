# TryBuddy

Static landing page for **TryBuddy**, built with **Gulp + Tailwind CSS**.

## Overview

- GitHub Pages: `https://adrielzimbril.github.io/trybuddy/`
- Source files: `src/`
- Production output: `dist/`

![TryBuddy Preview Light](screenshots/preview-light.png)
![TryBuddy Preview Dark](screenshots/preview-dark.png)

## Tech stack

- Gulp 4
- Tailwind CSS 3
- Sass
- Vanilla JS + UI plugins

## Local development

```bash
npm install
npm run dev
```

`dev` runs compilation and BrowserSync.

## Production build

```bash
npm run build
```

Optimized files are generated in `dist/`.

## Deployment

GitHub Pages deployment is automated from `dist/` using:

- `.github/workflows/pages.yml`

## Cleanup performed

- `src/assets/js/app.js` refactored and simplified
- `src/assets/js/plugins.init.js` modularized and hardened
- `src/assets/js/liquid.js` cleaned from unused helpers (`liquidThrottle`, `liquidNow`)
- HTML metadata normalized in `src/partials/title-meta.html`

## License

MIT — see [LICENSE](./LICENSE)

## Maintainer

- Website: `https://www.adrielzimbril.com/`
- GitHub: `https://github.com/adrielzimbril`
