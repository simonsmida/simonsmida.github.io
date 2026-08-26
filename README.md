# simonsmida.github.io

Personal site for Šimon Šmída. The main pages are plain HTML; writing is kept in
Markdown and rendered by GitHub Pages with the shared article layout.

## Structure

- `index.html` — About and the compact desktop tab view.
- `research.html` — Research cards.
- `writing.html` — Writing cards.
- `projects.html` — Interactive projects.
- `_posts/` — Article source files in Markdown.
- `_layouts/article.html` — Shared article page structure.
- `_templates/note.md` — Starting point for a new article.
- `assets/css/site.css` — Layout, themes, cards, and article typography.
- `assets/js/site.js` — Theme, navigation, and card behavior.
- `assets/js/ascii-field.js` — Animated ASCII backgrounds.
- `archive/` — Local historical drafts and prototype snapshots; excluded from the build.

## Add an article

1. Copy `_templates/note.md` to `_posts/YYYY-MM-DD-article-slug.md`.
2. Update its title, date, read time, excerpt, and content.
3. Put local visuals in `assets/notes/YYYY-MM-DD-article-slug/`.
4. Add one matching card to `writing.html`.

Markdown images automatically use the wider article visual treatment. For a
custom SVG, Canvas, or D3 interaction, copy `_templates/article/` and keep its
article-specific media and JavaScript inside that folder.

## Add research or a project

Copy one complete `content-card` block in `research.html` or `projects.html`,
then update its link, thumbnail or symbol, metadata, title, and summary.

## Local preview

```sh
bundle install
bundle exec jekyll serve
```

Open `http://127.0.0.1:4000/`.

The previous site is preserved in Git at the tag `legacy-site-2026-08-25`.
