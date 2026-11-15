# Jannis Buecking — personal website

Website: **https://jannisbuecking.github.io/**

A small static website hosted on GitHub Pages, showcasing the MAGEL2 multi-omics
atlas, MAMMOTH, and the Institute of Human Genetics Heidelberg database and tool
portal. It uses static HTML, CSS, and JavaScript, with no installation or build
step. The research and clinical-room illustrations use a locally vendored Three.js renderer.

The page also includes concise research and education entries,
clinical electives, and Google Scholar, LinkedIn, and
GitHub profile links.

## Edit the site

- `index.html`: page content and metadata.
- `styles.css`: layout, colors, and light/dark appearance.
- `projects.css` and `projects.js`: the scroll-driven mRNA and ribosome project explorer.
- `research.css`, `research.js`, `research-model.js`, and `research-bench.js`: the six-tube 3D rotor, scroll-driven inspection camera, and research/education descriptions.
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

## Background details

Research, education, and clinical entries are condensed from the
owner-provided CV screenshots. Edit these entries in `index.html`; only the
GitHub contribution calendar updates automatically. Month labels stay in one
row, aligned to their week columns; partial months without room for a label are omitted. The publication list is
available through the Google Scholar app on the contact phone.

## Animated science projects

The section is titled **Selected work**. All scenes use the same centered cue:
“Scroll down to continue ↓”. There are no bottom progress bars. The website ends
at the contact phone, without a footer.
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

The page opens directly on the centrifuge at `#research`, above the science
projects. The centrifuge, RNA, and Clinic scenes fill the browser window width
and height; headings and centered scroll cues retain a responsive inset.
Static fallback content keeps a readable centered column.
The rigid six-position rotor has equal tubes spaced 60° apart.
Tube order is Heidelberg University, Heidelberg research, UCSF, Harvard,
Boston Children’s Hospital, and Projects. Position 6 holds the project sample.
Tube transforms and dimensions remain fixed relative to the rotor throughout.
“Education and Research Experiences” fades in once the camera reaches the side view; the
opening view shows the instruments and rotor without its heading.

The camera starts exactly overhead using an orthographic projection, showing
only the six plain circular caps. On the left are three micropipettes, a six-well
culture plate with visible media, and a bacterial agar plate with 64 raised cream
colonies. On the right are a ring-headed reflex hammer, tuning fork, penlight, and
stethoscope. All equipment stays fixed on the work surface at its original
opacity throughout scrolling. The camera naturally moves past it; no tools fade
or disappear. Compact screens place them diagonally left and right to keep all
six tubes visible.
The opening rotor spins clockwise at 3 radians per second (about one revolution
every 2.1 seconds). The first scroll applies constant deceleration, finishing at
the next equivalent 60° arrangement without reversing or accelerating. All six
caps match, so this rebase preserves the overhead image exactly and reduces
the settling wait to 0.2–0.9 seconds. The camera stays
overhead while it slows, then moves along a vertical arc to the side. Subsequent scrolling turns the entire assembly
around its vertical axis through the five research and education entries in
the same order as the physical tubes. The side view zooms into the
front tube, with the full institution, dates, role, lab, and research summary
printed on its curved label. The desktop reading camera holds its distance
while the rotor turns continuously between labels, easing only at the beginning
and end of the reading sequence. Narrow viewports widen just enough to keep
adjacent tubes visible during the handover. There is no separate
description panel. The same source text remains available to screen readers
and in the automatic static fallback. Reading labels use 2048 × 3072 textures
and up to the display’s native 3× pixel density. Framebuffer resolution stays
fixed during the first camera tilt and becomes sharper after the first reading
settles. Label preparation pauses during camera motion and when offscreen.
The opening prepares just the first sharp label. In the side view, up to three
reading textures are prepared and uploaded ahead of time during idle periods,
after scrolling pauses. Tube changes do not paint labels or upload replacement textures inside
the animation frame. Eviction releases both GPU textures and their large canvas
buffers while retaining the lightweight fallback labels. The 32 ridges on each
cap are instanced together to reduce draw calls without changing their shape.
The overhead view uses lighter rendering and solid, unlettered caps.
After the fifth research/education label, the camera pulls back and returns overhead before the rotor
indexes to the project sample. Tube six, labeled **Projects**, opens: only its
cap lifts and moves aside. All six tubes use the same green cap, translucent
liquid filling, and cloud of 100 green particles suspended inside the liquid.
There is no pellet. The camera centers over the opening and descends through
the lightly tinted liquid surface, whose reflection softens continuously as
the lens enters. The suspended particles are projected
through the current camera into the actual RNA renderer. Those same particles
are assigned one-to-one to 81 visible components: sugars, phosphates, bases/cards,
stems, backbone segments, both complete ribosome subunits, and the four scene
labels. Each SVG contour starts as its assigned circle and continuously reshapes
into its destination. HTML bases, cards, and labels likewise transform from circles
into their final containers, revealing their text as they open. Remaining grains
shrink into the background. The 3D particles stay solid until their projected
counterparts cover them at matching locations; reshaping starts only after
that transfer, avoiding dimming or duplicate trails. No molecular component is independently faded or scaled in;
there is no intermediate strand scene or whole-scene dissolve.
The two sections overlap by one viewport, so the formed strand continues directly
into native project scrolling without an empty screen. Both renderers share one
scroll-driven morph state; reversing the scroll folds the components back into
their original positions within the liquid.

The camera and inspection sequence reverse with upward scrolling; the opening
spinner resumes clockwise on returning to the top. Research rendering stops
while still or offscreen, except for the opening rotation and braking. The transition is enabled only when both animated
sections fit the viewport; otherwise the existing independent sections remain.

This is an illustrative inspection view of a loaded rotor, with a clockwise opening
rotation and scroll-driven indexing. See the manufacturer's explanation
of [swinging-bucket rotor positions](https://www.beckman.com/centrifuges/rotors/swinging-bucket).

Direct links include `#research-boston`, `#research-ucsf`, and
`#research-heidelberg`, `#education-harvard`, and `#education-heidelberg`. There are no view toggles or tube-selection controls;
native page scrolling drives the sequence. An automatic static layout preserves
all research and education text for reduced motion, short screens,
when JavaScript is disabled, or when WebGL is unavailable. The renderer is
Three.js 0.187.0, sourced from its npm release with the upstream MIT license.

Run the geometry regression checks with:

```sh
node --test tests/*.test.mjs
```

The checks cover the six-slot geometry and opposing pairs, rigid tube poses
throughout camera movement and indexing, overhead ray occlusion by the caps,
the ordering of overhead alignment, cap opening, descent, and scene handoff,
consistency between suspended particle coordinates and the molecular morph endpoints,
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
a smaller iPhone on the right. Its rear surface provides a landing area for the
turned sheets while its front edge stays in place. All items and pages fit on it.
The tabletop and inset wooden apron meet without overlapping faces to prevent
flickering; the camera also uses a larger near plane for better depth precision.
The Clinic overview stays 14% closer to the desk. Scrolling holds the camera on
the clipboard and turns its five sheets over the top clip: UT Southwestern,
Great Ormond Street, Zomba (Pediatrics), University Medicine Oldenburg (Neurology),
then John Radcliffe Hospital, Oxford University (Neurology). Two raised binding
rings hold a fixed pivot above the clipboard. Each opaque sheet lifts with a gentle curl, clears the top edge, turns
over, and lands flat on a visible stack behind the board. The sheet follows two
joined circular arcs that preserve its physical length. It never drapes over the
desk edge or passes through the board. Subtle outlines and shadows keep its blank
back visible. The stationary reading camera frames both the active page and rear
stack, with larger document text for readability. The ceiling fixture sits over
the examination area, clear of these sight lines. The complete turn is reversible
and leaves the next record unobstructed. The clipboard passage requires 25%
less scrolling; the room entrance and phone approach retain their original
physical scroll distances. Deep links and resizing use the same reversible mapping.
Their text comes directly from the clinical entries in `index.html`, which also
serve as the accessible static fallback. Clinical experience is no longer repeated
in a separate background section. Upward scrolling turns the sheets back in order and returns through the monitor
into the live RNA sequence.

The final scroll chapter approaches the smaller iPhone lying on
the same desk. A real HTML screen follows the phone glass through a perspective
transform; GitHub, Google Scholar, Email, and LinkedIn are native links with
keyboard focus and mobile tap targets. The email is `jannis.buecking@gmail.com`,
as listed on the owner's public GitHub profile. The closer final camera view looks directly down onto the glass, with an upright
rectangular screen and level edges. The phone stays fixed on the table throughout.

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

- [Microscope → clinical laboratory](https://jannisbuecking.github.io/previews/clinical-laboratory.html): pull back from the optical field into a cutaway laboratory, then approach five workstation clipboards.
- [Monitor → Clinic](https://jannisbuecking.github.io/previews/clinical-consultation.html): pull back from the molecular image on a monitor, then turn through five pages on one clipboard.

Both use the same five revised clinical entries as the main website. The facts are in `previews/clinical-data.js`; each page also
contains an accessible static copy. These independent concept pages remain
available for comparison alongside the integrated Clinic. Scroll upward
to reverse either sequence.
Direct links `#zomba`, `#london`, and `#dallas` approach the respective records.
Reduced motion, disabled JavaScript, short windows, and unavailable WebGL use the
static entries. The room checks verify optical visibility, legible camera framing,
unobstructed open records, and rigid furniture throughout forward/reverse movement.
