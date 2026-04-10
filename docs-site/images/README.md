# Image assets

This directory holds image assets referenced by `docs-site/docs.json` and the MDX content.

## Missing asset: `og-image.png`

`docs.json` references `/images/og-image.png` for both `og:image` and `twitter:image` SEO
meta tags. The binary itself is not yet in the repo, so every social share currently
renders without a preview card.

Required spec:

- **Format:** PNG
- **Dimensions:** 1200 × 630 pixels (standard Open Graph ratio)
- **Filename:** `og-image.png`
- **Location:** `docs-site/images/og-image.png`

Once the asset is added, no config changes are needed — the path in `docs.json` already
points at `/images/og-image.png`.
