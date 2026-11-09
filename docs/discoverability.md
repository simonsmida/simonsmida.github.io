# Search discoverability

The site keeps its existing visible copy and design. Shared metadata is in
`_includes/seo.html`; `_includes/head.html` uses it for the main site. The
standalone tools and Shorties include the metadata without inheriting the main
site's CSS or JavaScript.

## Publishing future content

- Notes in `_posts` inherit the article layout, author identity, metadata,
  structured data, canonical URL, and sitemap entry automatically. Existing
  `tldr` text supplies the description; Markdown is removed from metadata.
- Keep `published: false` while drafting. Drafts are not included in production.
- Standalone HTML needs Jekyll front matter (`layout: null`, `title`, and a
  `description` reflecting the existing content) and `{% include seo.html %}`
  inside its head, after charset and viewport. Keep its original CSS and body.
- Link new published content from its relevant index. Project and research cards
  are shared between their index pages and the homepage's existing mobile view.
- Keep the existing `.html` and tool URLs stable. Hashes represent views of the
  homepage; standalone section URLs are the independently indexable pages.
- Do not add keywords or text hidden only for crawlers, artificial publication
  dates, or structured data claiming content or authorship that is not present.

## Verify a production build

Use the Ruby version in `.ruby-version`, then run:

```sh
bundle exec jekyll build
python3 script/check-seo
```

The check reads every sitemap entry and verifies its generated page's unique
title, description, canonical/social URLs, indexability, and JSON-LD. `script/`,
this documentation, and development dependency manifests are excluded from the
published site.

## Search Console

Use the URL-prefix property `https://simonsmida.github.io/`. Its HTML verification
token is configured in `_config.yml` and emitted on the homepage; retain it after
verification. Submit `https://simonsmida.github.io/sitemap.xml` once. Jekyll keeps
the sitemap up to date as content is published.

After deploying substantive changes, use URL Inspection to check a representative
page from each content type and request indexing where appropriate. Monitor Page
Indexing for exclusion reasons and Performance for queries and impressions.
Search Console data takes time to populate; sitemap submission and valid
metadata do not guarantee indexing or ranking.
