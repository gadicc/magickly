# Roboto

The interface font, loaded by `../roboto.ts` through `next/font/local`. These
are the files Google Fonts served on 18 October 2026 for the request
`next/font/google` used to make,
<https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap>,
with the user agent Turbopack sends (`USER_AGENT_FOR_GOOGLE_FONTS` in
[`crates/next-core/src/next_font/google/mod.rs`](https://github.com/vercel/next.js/blob/v16.3.5/crates/next-core/src/next_font/google/mod.rs)
at v16.3.5, Chrome 104 on macOS): Roboto v51, one font variable in weight
only (wght 100–900) cut into nine subsets. Their hashes matched the files a
webpack build emitted from Google that day. `../roboto.ts` copies each
subset's unicode-range and the four weight faces from the same response.

They are committed because `next/font/google` fails the build on Next 16.3
whenever Google answers with extensionless `/l/font?kit=…&skey=…&v=v51` URLs
([vercel/next.js#99114](https://github.com/vercel/next.js/issues/99114)):
Turbopack splits the font query at each `&`, and webpack finds no extension.
Turbopack's build cache then keeps the bad response, so the failure repeats.
The fix ([vercel/next.js#100158](https://github.com/vercel/next.js/pull/100158))
is only in 16.5 canaries so far.

| File | Subset (source URL) | Bytes | SHA-256 |
| --- | --- | --- | --- |
| Roboto-latin.woff2 | [latin](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3yUBHMdazQ.woff2) | 37520 | 0a44e0bb6ba5c8537e8814c148ef7755f1bce12112361231f595ecc584a18d7a |
| Roboto-latin-ext.woff2 | [latin-ext](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3KUBHMdazTgWw.woff2) | 24444 | cdd53dc5576a79f35cf280dfbd9c1cb2a5dd2f0ede30afba9b9ccdc7fe12e7d0 |
| Roboto-vietnamese.woff2 | [vietnamese](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3OUBHMdazTgWw.woff2) | 10572 | 2071148c26bd0430cad316373c26db399e0cf8f6275b9e1a2c1b831f05ee7dc3 |
| Roboto-greek.woff2 | [greek](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3-UBHMdazTgWw.woff2) | 13984 | 4813e3dfbbb23708c817ef7fd3fd9c82cd0d33c778def0897f0447f1c364ce64 |
| Roboto-greek-ext.woff2 | [greek-ext](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3CUBHMdazTgWw.woff2) | 1632 | 5fdfeaf926cac990770dfa66011bdb87d6b69f43c42aa759dcdcf0a7a197c19a |
| Roboto-cyrillic.woff2 | [cyrillic](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3iUBHMdazTgWw.woff2) | 19624 | 32886c5ec61a0d06e5677a98c5ed78a5f1c788c18c5e8d7dcd931c4b6dc19830 |
| Roboto-cyrillic-ext.woff2 | [cyrillic-ext](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMa3GUBHMdazTgWw.woff2) | 31472 | e44224eb71a96cb33bd046ded16a4e22bb441b170bdfbcba0268a754141b97c8 |
| Roboto-math.woff2 | [math](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMawCUBHMdazTgWw.woff2) | 36292 | 297193369eea600161f4b5219bd7b08850180fcfe0752f1a2eaa436575cd03b7 |
| Roboto-symbols.woff2 | [symbols](https://fonts.gstatic.com/s/roboto/v51/KFO7CnqEu92Fr1ME7kSn66aGLdTylUAMaxKUBHMdazTgWw.woff2) | 16692 | fab8a0056d92fdd8d64fed4b049744144e1d24d08762c513bff78265299ed7a3 |

`OFL.txt` is the family's SIL Open Font License 1.1 notice, from
[`ofl/roboto/OFL.txt`](https://raw.githubusercontent.com/google/fonts/1c627bfa375fc51cf86fabeca4f6e08a95f0aa5c/ofl/roboto/OFL.txt)
at google/fonts commit `1c627bfa375fc51cf86fabeca4f6e08a95f0aa5c`
(SHA-256 061402327a96aadb0bfb694a960ed289ecd38d383e396243831ab81feb109c41):
Copyright 2011 The Roboto Project Authors, with no Reserved Font Name.
