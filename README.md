# simonsmida.github.io

Personal website and notes archive for <https://simonsmida.github.io>.

## Structure

- `index.html` is the standalone home page.
- `notes.md`, `_posts/`, `_layouts/`, and `_includes/` power the Jekyll notes section.
- `_data/home_links.yml` controls the home page links.
- `_data/shorties.yml` controls the shorties index.
- `convolution-demo/`, `interpretability-demo/`, and `unet-demo/` are standalone demos.
- `assets/` contains shared CSS, JS, and images.

## Local Development

Install the GitHub Pages gem bundle once:

```sh
bundle install
```

Run the site locally:

```sh
bundle exec jekyll serve
```

Then open <http://localhost:4000>.

## Maintenance Notes

- Start new notes from `_templates/note.md`, then copy them to `_posts/YYYY-MM-DD-short-slug.md`.
- Add notes as dated Markdown files in `_posts/` with `categories: [notes]`.
- Put note images in `assets/notes/YYYY-MM-DD-short-slug/` so each note owns its assets.
- Keep drafts out of `_posts/`; Jekyll expects post filenames to start with `YYYY-MM-DD-`.
- Prefer editing `_data/home_links.yml` instead of changing home page markup.
- Keep one-off demos isolated in their own folder with an `index.html`.
- Run `bundle exec jekyll build` before publishing larger changes.
