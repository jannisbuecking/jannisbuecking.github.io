# Jannis Buecking — personal website

Website: **https://jannisbuecking.github.io/**

A small static website hosted on GitHub Pages, showcasing the MAGEL2 multi-omics
atlas, MAMMOTH, and the Institute of Human Genetics Heidelberg database and tool
portal. It uses static HTML, CSS, and JavaScript, with no installation or build
step. The research and clinical-room illustrations use a locally vendored Three.js renderer.

The page also includes publications, concise research and education entries,
clinical electives, teaching experience, and Google Scholar, LinkedIn, and
GitHub profile links.

## Edit the site

- `index.html`: page content and metadata.
- `styles.css`: layout, colors, and light/dark appearance.
- `projects.css` and `projects.js`: the scroll-driven mRNA and ribosome project explorer.
- `research.css`, `research.js`, and `research-model.js`: the six-tube 3D rotor, scroll-driven inspection camera, and research descriptions.
- `clinical.css`, `clinical.js`, and `clinical-snapshot.js`: the live RNA-to-monitor handoff and Clinic experience.
- `desk-phone.css`, `desk-phone.js`, and `phone-geometry.js`: the desk iPhone, interactive projected HTML screen, and contact links.
- `previews/clinical-room-model.js` and `previews/clinical-textures.js`: shared room geometry and document textures for the integrated room and concept previews.
- `vendor/three/`: Three.js 0.187.0 and its MIT license; served locally with the site.
- `contribution-data.js`: cached daily contribution data for the iPhone widget.
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
git add index.html styles.css clinical.js
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

The project animation starts automatically as the page scrolls, without a view
toggle. Reduced-motion preferences, disabled JavaScript, and short windows
automatically use the ordinary project cards. Focus the display and use
Left/Right or Home/End to navigate. Project links remain reachable by Tab, and
direct links such as `#project-mammoth` bring the relevant card into view.

## Research centrifuge

The research section at `#research`, immediately after the introduction and
above the science projects, uses a rigid six-position rotor with equal
tubes spaced 60° apart. The research tubes are adjacent in positions 1, 2, and 3;
the other three tubes occupy positions 4, 5, and 6, giving three opposed pairs.
Tube transforms and dimensions remain fixed relative to the rotor throughout.

The camera starts exactly overhead using an orthographic projection, showing
only the six circular caps. It moves along a vertical arc to the side while the
rotor stays still. Subsequent scrolling continuously turns the entire assembly
around its vertical axis from Boston to UCSF to Heidelberg, without intermediate
stops or balancing tubes passing between the research roles. The side view zooms into the
front tube, with the full institution, dates, role, lab, and research summary
printed on its curved label. The camera gently pulls back while passing between
neighboring labels. There is no separate
description panel. The same source text remains available to screen readers
and in the automatic static fallback.
After the third role, the camera pulls back and returns overhead before the rotor
indexes one additional position. Tube four, labeled **Projects**, opens: only its
cap lifts and moves aside. The camera centers over its opening and descends toward
a modeled pellet in the conical tip. Liquid is hidden during this illustrative
scale change so the pellet remains visible. Its 100 modeled grains are projected
through the current camera into the actual RNA renderer. Those same particles
are assigned one-to-one to 81 visible components: sugars, phosphates, bases/cards,
stems, backbone segments, both complete ribosome subunits, and the four scene
labels. Each SVG contour starts as its assigned circle and continuously reshapes
into its destination. HTML bases, cards, and labels likewise transform from circles
into their final containers, revealing their text as they open. Remaining grains
shrink into the background. The 3D grains yield to their projected counterparts
at matching locations. No molecular component is independently faded or scaled in;
there is no intermediate strand scene or whole-scene dissolve.
The two sections overlap by one viewport, so the formed strand continues directly
into native project scrolling without an empty screen. Both renderers share one
scroll-driven morph state; reversing the scroll folds the components back into
their original pellet positions.

The complete sequence reverses with upward scrolling. Research rendering stops
while still or offscreen. The transition is enabled only when both animated
sections fit the viewport; otherwise the existing independent sections remain.

This is an inspection view of a loaded rotor with the tubes at rest, not a
simulation of operating-speed centrifugation. See the manufacturer's explanation
of [swinging-bucket rotor positions](https://www.beckman.com/centrifuges/rotors/swinging-bucket).

Direct links include `#research-boston`, `#research-ucsf`, and
`#research-heidelberg`. There are no view toggles or tube-selection controls;
native page scrolling drives the sequence. An automatic static layout preserves
all research text for reduced motion, short screens,
when JavaScript is disabled, or when WebGL is unavailable. The renderer is
Three.js 0.187.0, sourced from its npm release with the upstream MIT license.

Run the geometry regression checks with:

```sh
node --test tests/*.test.mjs
```

The checks cover the six-slot geometry and opposing pairs, rigid tube poses
throughout camera movement and indexing, overhead ray occlusion by the caps,
the ordering of overhead alignment, cap opening, descent, and scene handoff,
consistency between pellet grain coordinates and the molecular morph endpoints,
unique ownership for all 81 components, and continuous circle-to-contour geometry.
They also run before each deployment.

## Clinic

The Clinic is integrated immediately after the science
projects. The RNA renderer settles at its stop codon and freezes its current
geometry. `clinical-snapshot.js` paints the actual SVG, bases, project card, and
scene text into a canvas used by the room's monitor. The monitor camera and image
padding match the outgoing viewport, including portrait screens. A short overlap
holds that frame steady before the camera pulls back to reveal the room.

The desk has the computer on the left, one small clipboard in the middle, and
a smaller iPhone on the right. All three items fit inside the tabletop edges.
Scrolling holds the camera on the clipboard and turns its sheets over the top
clip: Zomba, Great Ormond Street, then UT Southwestern.
Their text comes directly from the clinical entries in `index.html`, which also
serve as the accessible static fallback. Clinical experience is no longer repeated
in the later education/teaching grid. Upward scrolling turns the sheets back in order and returns through the monitor
into the live RNA sequence.

The final scroll chapter approaches the smaller iPhone lying on
the same desk. A real HTML screen follows the phone glass through a perspective
transform; GitHub, Google Scholar, Email, and LinkedIn are native links with
keyboard focus and mobile tap targets. The email is `jannis.buecking@gmail.com`,
as listed on the owner's public GitHub profile. The closer final camera view keeps the screen and app links legible.

Contributions appear only in the phone widget, using the daily snapshot through
one cached browser request. Its detail link opens the public GitHub profile. The screen is hidden behind foreground objects,
and links become interactive when the camera approaches. Reduced-motion, no-JS,
short-screen, and unavailable-WebGL layouts retain the phone contact links as a
normal HTML card. `#contact` approaches the phone directly.

`#clinical` opens the room overview. `#clinical-zomba`, `#clinical-london`, and
`#clinical-dallas` open the respective records. The scene falls back to normal
clinical entries for reduced motion, short windows, disabled JavaScript, unavailable
WebGL, or when the RNA layout cannot be enhanced. Geometry checks include exact
monitor-to-viewport projection and unobstructed document views on desktop/mobile.

## Clinical room concept previews

Two separate scrollable prototypes are published alongside the main website:

- [Microscope → clinical laboratory](https://jannisbuecking.github.io/previews/clinical-laboratory.html): pull back from the optical field into a cutaway laboratory, then approach three workstation clipboards.
- [Monitor → Clinic](https://jannisbuecking.github.io/previews/clinical-consultation.html): pull back from the molecular image on a monitor, then turn through three pages on one clipboard.

Both use the site's existing Zomba, Great Ormond Street, and UT Southwestern
clinical entries. The facts are in `previews/clinical-data.js`; each page also
contains an accessible static copy. These independent concept pages remain
available for comparison alongside the integrated Clinic. Scroll upward
to reverse either sequence.
Direct links `#zomba`, `#london`, and `#dallas` approach the respective records.
Reduced motion, disabled JavaScript, short windows, and unavailable WebGL use the
static entries. The room checks verify optical visibility, legible camera framing,
unobstructed open records, and rigid furniture throughout forward/reverse movement.
