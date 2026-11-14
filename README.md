# Jannis Buecking — personal website

Website: **https://jannisbuecking.github.io/**

A small static website hosted on GitHub Pages. It uses plain HTML and CSS,
with no dependencies or build step.

## Edit the site

- `index.html`: page content and metadata.
- `styles.css`: layout, colors, and light/dark appearance.
- `.nojekyll`: tells GitHub Pages to serve the static files directly.

## Preview locally

From this repository, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000. Stop the server with Ctrl+C.

## Publish updates

Commit and push changes to `main`. GitHub Pages automatically publishes the
repository root from that branch. Deployment progress is available in the
repository's **Actions** tab, and hosting settings are in **Settings → Pages**.

```sh
git add index.html styles.css
git commit -m "Update website"
git push origin main
```

GitHub Pages setup reference:
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
