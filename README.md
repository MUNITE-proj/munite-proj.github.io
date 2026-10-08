# MUNITE

Project website for **Unified Multimodal Latent Inference for Any-to-Any Multimodal Generation**.

Kyeongmin Yeo and Minhyuk Sung · KAIST

## Development

Requires Node.js 20 or later.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Open <http://127.0.0.1:4173/>.

## Build and deployment

```sh
npm run check
npm run build
npm run preview
```

The static site is built into `dist/`. To publish it, run the **Deploy MUNITE to GitHub Pages** workflow in GitHub Actions.

Font and math licenses are included in `assets/fonts/`. The arXiv icon is from [Simple Icons](https://simpleicons.org/) ([CC0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md)).
