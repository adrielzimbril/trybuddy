# TryBuddy

Landing page statique pour **TryBuddy**, construite avec **Gulp + Tailwind CSS**.

## Aperçu

- Démo GitHub Pages: `https://adrielzimbril.github.io/trybuddy/`
- Source: `src/`
- Build de production: `dist/`

![TryBuddy Preview Light](screenshots/preview-light.png)
![TryBuddy Preview Dark](screenshots/preview-dark.png)

## Stack

- Gulp 4
- Tailwind CSS 3
- Sass
- JS Vanilla + plugins UI

## Démarrage local

```bash
npm install
npm run dev
```

Le mode `dev` lance la compilation et BrowserSync.

## Build production

```bash
npm run build
```

Les fichiers optimisés sont générés dans `dist/`.

## Déploiement

Le repo est configuré pour déployer automatiquement `dist/` sur **GitHub Pages** via le workflow:

- `.github/workflows/pages.yml`

## Qualité / nettoyage appliqués

- `src/assets/js/app.js` simplifié et nettoyé
- `src/assets/js/plugins.init.js` restructuré en modules d’init plus robustes
- `src/assets/js/liquid.js` nettoyé des helpers inutilisés (`liquidThrottle` + `liquidNow`)
- métadonnées HTML harmonisées (`src/partials/title-meta.html`)

## Structure rapide

```text
src/
  assets/
  partials/
dist/                # généré
gulpfile.js
tailwind.config.js
```

## Licence

MIT — voir [LICENSE](./LICENSE)

## Maintainer

- Site: `https://www.adrielzimbril.com/`
- GitHub: `https://github.com/adrielzimbril`
