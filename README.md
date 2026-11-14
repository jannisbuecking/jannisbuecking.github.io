# Jannis Buecking — personal website

Website: **https://jannisbuecking.github.io/**

A small static website hosted on GitHub Pages, showcasing the MAGEL2 multi-omics
atlas, MAMMOTH, and the Institute of Human Genetics Heidelberg database and tool
portal. It uses static HTML, CSS, and JavaScript, with no installation or build
step. The research illustration uses a locally vendored Three.js renderer.

The page also includes publications, concise research and education entries,
clinical electives, teaching experience, and Google Scholar, LinkedIn, and
GitHub profile links.

## Edit the site

- `index.html`: page content and metadata.
- `styles.css`: layout, colors, and light/dark appearance.
- `projects.css` and `projects.js`: the scroll-driven mRNA and ribosome project explorer.
- `research.css`, `research.js`, and `research-model.js`: the six-tube 3D rotor, scroll-driven inspection camera, and research descriptions.
- `vendor/three/`: Three.js 0.187.0 and its MIT license; served locally with the site.
- `contributions.js`: interactive contribution calendar with day tooltips and arrow-key navigation.
- `data/contributions.json`: saved public GitHub contribution data for local preview and fallback.
- `scripts/update_contributions.py`: refreshes contribution data using Python's standard library.
- `.github/workflows/deploy.yml`: publishes the site on pushes and refreshes activity daily.
- `.nojekyll`: tells GitHub Pages to serve the static files directly.

## Preview locally

From this repository, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000. Stop the server with Ctrl+C.

## Publish updates

Commit and push changes to `main`. The **Deploy website** GitHub Actions workflow
refreshes the contribution calendar and publishes the static site. GitHub Pages
uses **GitHub Actions** as its publishing source. Deployment progress is available
in **Actions**, and hosting settings are in **Settings → Pages**.

```sh
git add index.html styles.css contributions.js
git commit -m "Update website"
git push origin main
```

GitHub Pages setup reference:
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Contribution calendar

The workflow also runs daily at 04:23 UTC and can be started manually from
**Actions → Deploy website → Run workflow**. GitHub can delay scheduled runs and
disables schedules in public repositories after 60 days without repository activity.

The refresh reads the public contribution calendar at
https://github.com/users/jannisbuecking/contributions. No personal access token,
third-party chart service, or browser request to GitHub is needed. Only information
already visible on the public profile is included. The total and day intensities
come from GitHub's rolling calendar, including its week boundary dates.

Updated JSON is included in the deployment artifact without automated repository
commits. If GitHub cannot be reached or changes its calendar markup, the workflow
reports a warning and deploys the saved snapshot. The page displays the snapshot's
actual update date and links to GitHub if its local JSON cannot be loaded.

To refresh the saved snapshot locally:

```sh
python3 scripts/update_contributions.py
```

## Background and publication details

Research, education, clinical, and teaching entries are condensed from the
owner-provided CV screenshots. The publication list was checked against the
owner's [Google Scholar profile](https://scholar.google.com/citations?hl=en&user=bZB3VLoAAAAJ)
on 14 November 2026. Each entry links to its DOI or Scholar record, with
preprints and the conference abstract labeled separately. These entries are
edited in `index.html`; only the GitHub contribution calendar updates automatically.

## Animated science projects

The project explorer adapts the mRNA strand, sugar-phosphate backbone, and two-part
ribosome schematic from the owner's
[Institute of Human Genetics Heidelberg portal](https://github.com/jannisbuecking/human-genetics-heidelberg-tools).
Native page scrolling moves the three project cards through the ribosome, from
the AUG start codon to the UAA stop codon. The scene animates only while visible.

The **List** control shows all projects without animation. Visitors who prefer
reduced motion start in List view; JavaScript-disabled browsers and short windows
also retain the ordinary project list. In Explore view, focus the display and use
Left/Right or Home/End to navigate. Project links remain reachable by Tab, and
direct links such as `#project-mammoth` bring the relevant card into view.

## Research centrifuge

The research section at `#research` uses a rigid six-position rotor with equal
tubes spaced 60° apart. Research tubes occupy positions 1, 3, and 5; balancing
tubes occupy positions 2, 4, and 6, giving three opposed pairs. Tube transforms,
dimensions, and fill levels remain fixed relative to the rotor throughout.

The camera starts exactly overhead using an orthographic projection, showing
only the six circular caps. It moves along a vertical arc to the side while the
rotor stays still. Subsequent scrolling indexes the entire assembly around its
vertical axis to bring each research tube forward. Labels are curved surfaces
attached to the tubes, with full descriptions shown alongside for readability.
Upward scrolling reverses this sequence. Rendering stops while still or offscreen.

This is an inspection view of a loaded rotor with the tubes at rest, not a
simulation of operating-speed centrifugation. See the manufacturer's explanation
of [swinging-bucket rotor positions](https://www.beckman.com/centrifuges/rotors/swinging-bucket).

The three labeled navigation buttons and research tubes jump to a research role.
Direct links include `#research-boston`, `#research-ucsf`, and
`#research-heidelberg`. List view preserves all research text without animation;
it is also the default for reduced motion and the fallback on short screens,
when JavaScript is disabled, or when WebGL is unavailable. The renderer is
Three.js 0.187.0, sourced from its npm release with the upstream MIT license.

Run the geometry regression checks with:

```sh
node --test tests/research-model.test.mjs
```

The checks cover the six-slot geometry and opposing pairs, rigid tube poses
throughout camera movement and indexing, and overhead ray occlusion by the caps.
They also run before each deployment.
