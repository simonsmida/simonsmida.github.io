# Personal site

A build-free static site for GitHub Pages. Every page is plain HTML, CSS, and
JavaScript.

## Structure

```text
redesign-prototype/
├── index.html                 About
├── research.html              Research list
├── writing.html               Writing list
├── projects.html              Interactive projects
├── assets/
│   ├── css/site.css           Themes, layout, cards, articles
│   ├── icons/favicon.svg
│   └── js/
│       ├── site.js            Theme, lists, navigation
│       └── ascii-field.js     Animated background
└── content/
    └── template/              Copy this folder for a new article
        ├── index.html
        └── media/
```

## Add research or writing

Open `research.html` or `writing.html` and copy one complete
`<article class="content-card">` block. Change:

1. Its unique `id` and links.
2. The thumbnail and useful `alt` text.
3. The date or status.
4. The title and short summary.

The first three cards appear immediately. Additional cards are handled by the
existing **View more** button; no JavaScript change is needed.

## Add an article

1. Copy `content/template/` to `content/your-article-slug/`.
2. Edit its `index.html` title, description, date, introduction, and content.
3. Put that article's images and SVGs in its `media/` folder.
4. Add a card in `writing.html` or `research.html` that links to
   `./content/your-article-slug/`.

### Images and SVG

Use a `<figure class="article-figure">` for normal-width visuals. Add
`article-wide` when a visual needs more horizontal room. Always include useful
alternative text and a short caption when the visual needs explanation.

### D3 or other interactive visuals

Keep article-specific code inside the article folder:

```text
content/your-article-slug/
├── index.html
├── interactive.js
└── media/
```

Add an `.interactive-figure` container in the article, then load only that
article's module:

```html
<script type="module" src="./interactive.js"></script>
```

This keeps large libraries and interactive code away from pages that do not
need them. Prefer a local module import or a pinned D3 version.

## Add a project

Copy a `.project-card` block in `projects.html`, then update its link, symbol,
title, status, and summary. Local demos can live beside the existing
`convolution-demo/`, `interpretability-demo/`, and `unet-demo/` folders.

## Change colors

The Slate Blue and Midnight Navy palettes are at the top of
`assets/css/site.css`. Layout measurements are shared by both themes so a theme
change never moves content.

## Test ASCII backgrounds

Use the **Field** control in the header to compare the prototype backgrounds:
manifolds, topography, activation fields, transformer attention, point clouds,
computational pathology, a loss landscape, feature cubes, information flow,
neural networks, latent space, orbit fields, and a cosmic neural web. The
choice is saved in the browser. Edit the field functions in
`assets/js/ascii-field.js` after choosing the final direction.

## Preview locally

Serve the repository root and open `/redesign-prototype/`. The current local
preview is available at:

`http://127.0.0.1:4173/redesign-prototype/`

The `?v=12` asset suffix is a simple Safari cache key. Increment it in each HTML
page after changing shared CSS or JavaScript.
