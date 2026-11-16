# magick.li

_Open-source magick reference PWA_

Copyright (c) 2020-2026 Gadi Cohen.

- The **app** is [AGPL-3.0-or-later](./LICENSE.txt): use it, change it and run
  it, but whoever you serve it to must be able to get its source.
- The **data** in [`packages/magick-data/`](./packages/magick-data) is
  [CC BY 4.0](./packages/magick-data/LICENSE-DATA.txt): use it anywhere, with
  credit. That package is licensed by its own files: its code is MIT, and its
  [LICENSE.txt](./packages/magick-data/LICENSE.txt) says which file is which.
- The **components** in
  [`packages/magick-components/`](./packages/magick-components) are
  [MIT](./packages/magick-components/LICENSE.txt), and import no app code.
  MIT covers the drawings they make: where a component's code is the
  drawing, its path data is code too. The Moon's two modules adapt code
  from [moon-phase](https://github.com/tingletech/moon-phase), Copyright ©
  2012, Regents of the University of California, and are also under its
  BSD 3-Clause License, whose notice that LICENSE.txt carries.
- **Images the site draws or makes itself**, such as the Tree of Life, sigils,
  tablets, lamens and temple halls, and its hand-drawn images, are CC BY 4.0
  as magick.ly serves them, with credit to Magick.ly. Work by other people
  that the app shows keeps its own licence; the credits are at
  [magick.ly/about#credits](https://magick.ly/about#credits).

[magick.ly/open-source](https://magick.ly/open-source) says the same, with the
fonts' licences and the packages.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Development

`pnpm test` runs the complete suite after its data and search prerequisites.
For a focused legacy file-import planning loop, run:

```bash
pnpm exec vitest run src/migration/planLegacyFileImport.test.ts
```

These planning cases use synthetic values and reject runtime database imports.
The retained SQL/provenance cases live in
`src/migration/planLegacyFileImport.sql.test.ts`; run that file when changing
storage behavior. Both files remain part of the complete suite. The focused
command retains Vitest's existing data-generation setup.

`pnpm test:local` adds Loom's optional local worker/core controls after the same
data and search preparation. It preserves the existing Vitest pool and config;
file filters can be passed as arguments. `auto` is a CPU/quota ceiling rather
than a tuned worker count, and an unknown local quota falls back to one worker.
CI ignores local worker requests and exclusion while retaining available
capacity and deliberate runner limits. This does not coordinate an aggregate
worker budget across projects. The existing test and watch tasks remain available.

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Written for [Next.js](https://nextjs.org/) and deployed on [Vercel](https://vercel.com/).
