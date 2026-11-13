# magick.li

_Open-source magick reference PWA_

Copyright (c) 2020-2026 Gadi Cohen.

- The **app** is [AGPL-3.0-or-later](./LICENSE.txt): use it, change it and run
  it, but whoever you serve it to must be able to get its source.
- The **data** in [`packages/magick-data/`](./packages/magick-data) is
  [CC BY 4.0](./packages/magick-data/LICENSE-DATA.txt): use it anywhere, with
  credit. That package is licensed by its own files: its code is MIT, and its
  [LICENSE.txt](./packages/magick-data/LICENSE.txt) says which file is which.
- The **components** in [`src/components/`](./src/components) are
  [MIT](./src/components/LICENSE.txt), and import no app code. MIT covers
  the drawings they make: where a component's code is the drawing, its path
  data is code too.
- **Images the site draws or makes itself**, such as the Tree of Life, sigils,
  tablets, lamens and temple halls, and its hand-drawn images, are CC BY 4.0
  as magick.ly serves them, with credit to Magick.ly. Work by other people
  that the app shows keeps its own licence; the credits are at
  [magick.ly/about#credits](https://magick.ly/about#credits).

[magick.ly/open-source](https://magick.ly/open-source) says the same, with the
fonts' licences and the packages.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Development

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Written for [Next.js](https://nextjs.org/) and deployed on [Vercel](https://vercel.com/).
