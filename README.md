# simonsmida.github.io

Personal site for Šimon Šmída. The main pages are plain HTML with shared
Jekyll includes; writing is kept in Markdown and rendered by GitHub Pages with
the article layout.

## Structure

- `index.html` — About, with the section panel and the compact stacked view.
- `research.html`, `writing.html`, `projects.html` — Card lists.
- `_posts/` — Article source files in Markdown.
- `_layouts/article.html` — Article page structure.
- `_includes/` — Shared head, header, footer, and script tags.
- `_templates/note.md` — Starting point for a new article.
- `assets/css/site.css` — Layout, themes, cards, and article typography.
- `assets/js/site.js` — Theme, field picker, card lists, and client-side navigation.
- `assets/js/fields.js` — The background field variants (pure sampling functions).
- `assets/js/field.js` — The field renderer: glyph atlas, dithering, readability zones, card streams.
- `archive/` — Historical drafts and prototype snapshots; excluded from the build.
- `experiments/` — Local visual studies; excluded from the build.
- `script/serve` — Local preview with the right Ruby and locale.
- `assets/**/_originals/` — Full-resolution masters. Jekyll skips any directory
  starting with `_`, so these stay in Git without being deployed.

## Background field

`fields.js` defines each variant as a `sample(x, y, t, out, i, aspect)` function
writing an ink `value` and a `relief` height per cell. `field.js` samples the
active variant on a grid every frame, shades it from the relief gradient,
dithers it into glyphs, and blits the glyphs from a pre-rendered atlas. Text and
cards are protected by readability zones, and small particle streams flow into
each card (faster while the card is hovered).

To add a variant, add an entry to `SITE_FIELDS` in `fields.js`; the picker
lists it automatically.

## Add an article

1. Copy `_templates/note.md` to `_posts/YYYY-MM-DD-article-slug.md`.
2. Update its title, date, last updated date, read time, TL;DR, card excerpt, thumbnail, and content.
3. Put local visuals in `assets/notes/YYYY-MM-DD-article-slug/` (see Images).
4. Preview the generated writing card locally; writing posts are listed automatically.

Writing cards are generated from the posts automatically. Set `thumbnail`,
`thumbnail_alt`, `thumbnail_width`/`thumbnail_height`, and `card_excerpt` in the
post front matter; no card markup is needed for a writing post. `tldr` is the
canonical article summary shown beneath the title and used for metadata/social
descriptions. `card_excerpt` is used only on the Writing card, so it can be
shorter and more index-friendly. Posts are listed newest first.

## Images

Ship images at roughly twice the size they render at, in WebP; anything larger
is downloaded and thrown away. Keep the full-resolution master beside it in an
`_originals/` folder — Jekyll skips any directory starting with `_`, so masters
stay in Git without being deployed.

| Front matter   | Renders at | Ship            |
| -------------- | ---------- | --------------- |
| `thumbnail`    | 86px box   | 256px short edge, `.webp` |
| `hero_art`     | ≤860px     | 1720px wide, `.webp` |
| in-article     | ≤780px     | 1560px wide, `.webp` |
| `social_image` | —          | exactly 1200×630, `.jpg` |

```sh
cwebp -q 82 -resize 1720 0 _originals/hero.png -o hero.webp
```

`social_image` is the Open Graph card used when the page is shared. Pages
without one fall back to `assets/icons/social-default.jpg`.

## Add research or a project

Copy one complete `content-card` block in `research.html` or `projects.html`,
then update its link, thumbnail or symbol, metadata, title, and summary.

## Deploy

Bump `version` in `_config.yml` when CSS, scripts, or icons change so browsers
fetch the new files, then push to `main`.

## Local preview

```sh
./script/serve
```

Open `http://127.0.0.1:4000/`. The page reloads on save.

The script exists because two things have to be set before Jekyll will run:
the Ruby named in `.ruby-version` (macOS puts its own 2.6 first on `PATH`, and
bundler refuses to load against it) and a UTF-8 locale (under a POSIX one
Jekyll reads the theme SCSS as US-ASCII and dies on the first non-ASCII byte).
Running `bundle exec jekyll serve` directly will fail on both counts unless
your shell already handles them.

To install the gems the first time, or after changing the `Gemfile`:

```sh
PATH="/opt/homebrew/opt/ruby@3.1/bin:$PATH" bundle install
```

The previous site is preserved in Git at the tag `legacy-site-2026-08-25`.
