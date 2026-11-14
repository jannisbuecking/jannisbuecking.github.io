// Adapted from the owner's Institute of Human Genetics Heidelberg RNA explorer.
(() => {
  "use strict";
  const section = document.querySelector(".rna-projects");
  if (!section) return;
  const journey = section.querySelector(".rna-journey");
  const scene = section.querySelector(".rna-scene");
  const stage = section.querySelector(".rna-stage");
  const viewport = section.querySelector(".rna-viewport");
  const track = section.querySelector(".rna-track");
  const units = [...track.querySelectorAll(".rna-unit")];
  const cards = [...track.querySelectorAll(".project")];
  const backbone = section.querySelector(".rna-backbone");
  const strand = section.querySelector(".rna-strand");
  const sugars = section.querySelector(".rna-sugars");
  const ribosome = section.querySelector(".rna-ribosome");
  const shape = section.querySelector(".rna-ribosome-shape");
  const primeStart = section.querySelector(".rna-start");
  const primeEnd = section.querySelector(".rna-end");
  const controls = section.querySelector(".project-view-switch");
  const buttons = [...controls.querySelectorAll("button")];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sizeReference = document.createElement("div");
  sizeReference.className = "rna-size-reference";
  sizeReference.setAttribute("aria-hidden", "true");
  scene.append(sizeReference);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let enabled = false, queued = false, layoutQueued = false;
  let width = 0, sceneHeight = 0, baseline = 0, center = 0, scale = 1;
  let startCamera = 0, travel = 0, distance = 0, camera = 0;
  let cameraReady = false, lastTime = 0, phase = 0, savedProgress = 0;
  let nodes = [], phosphates = [], projectNodes = [], firstX = 0, lastX = 0;

  function svg(tag, attributes) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  }
  function request() {
    if (!queued) { queued = true; requestAnimationFrame(frame); }
  }
  function progress() {
    return distance ? clamp(-journey.getBoundingClientRect().top / distance, 0, 1) : 0;
  }
  function reset() {
    enabled = false;
    section.classList.remove("is-enhanced");
    journey.style.removeProperty("height");
    track.removeAttribute("style");
    scene.style.removeProperty("--rna-card-height");
    units.forEach(unit => unit.removeAttribute("style"));
    cards.forEach(card => {
      card.removeAttribute("style");
      card.classList.remove("is-current");
    });
  }
  function layout() {
    const previousProgress = progress();
    const before = journey.getBoundingClientRect();
    const wasPinned = enabled && before.top <= 0 && before.top >= -distance;
    const wasAfter = enabled && before.bottom <= 0;
    reset();
    width = section.clientWidth;
    sceneHeight = sizeReference.getBoundingClientRect().height;
    if (section.dataset.view !== "rna") return;
    const mobile = width <= 700;
    const cardWidth = mobile ? Math.max(230, width - 40) : Math.min(500, Math.max(330, width * .44));
    // Measure actual wrapped content before deciding whether the scene fits.
    cards.forEach(card => { card.style.width = `${cardWidth}px`; });
    const cardHeight = Math.ceil(Math.max(...cards.map(card => card.getBoundingClientRect().height)));
    const stageTop = section.querySelector(".section-heading").getBoundingClientRect().height + 32;
    if (width < 300 || sceneHeight < stageTop + cardHeight + 180) {
      cards.forEach(card => card.removeAttribute("style"));
      return;
    }
    enabled = true;
    scene.style.setProperty("--rna-card-height", `${cardHeight}px`);
    scene.style.setProperty("--rna-stage-top", `${stageTop}px`);
    section.classList.add("is-enhanced");
    const stageHeight = stage.getBoundingClientRect().height;
    const markerSize = mobile ? 72 : 104;
    const gap = mobile ? 24 : 32;
    const stemHeight = 44;
    baseline = Math.max(cardHeight + stemHeight + 28, stageHeight - Math.min(mobile ? 180 : 240, stageHeight * .32));
    center = width / 2;
    const cardTop = baseline - stemHeight - cardHeight;
    const markerTop = cardTop + (cardHeight - markerSize) / 2;
    let previousX = center, previousWidth = markerSize;
    nodes = units.map((unit, index) => {
      const card = unit.querySelector(".project");
      const unitWidth = card ? cardWidth : markerSize;
      const x = index ? previousX + previousWidth / 2 + gap + unitWidth / 2 : center;
      previousX = x;
      previousWidth = unitWidth;
      unit.style.width = `${unitWidth}px`;
      unit.style.left = `${x - unitWidth / 2}px`;
      if (card) card.style.top = `${cardTop}px`;
      const mark = unit.querySelector(".nucleotide-mark");
      if (mark) mark.style.top = `${markerTop}px`;
      const sugar = svg("g", {});
      sugar.append(
        svg("path", { d: `M0 -10V${-(card ? stemHeight : baseline - markerTop - markerSize)}`, class: "rna-stem" }),
        svg("path", { d: "M-6 8L-10 -3L-1 -11L10 -6L8 7Z" })
      );
      return { unit, card, x, sugar };
    });
    projectNodes = nodes.filter(node => node.card);
    const drawing = document.createDocumentFragment();
    nodes.forEach(node => drawing.append(node.sugar));
    phosphates = nodes.slice(0, -1).map((node, index) => {
      const element = svg("circle", { r: 3.5 });
      drawing.append(element);
      return { x: (node.x + nodes[index + 1].x) / 2, element };
    });
    sugars.replaceChildren(drawing);
    const length = nodes.at(-1).x + center;
    track.style.width = `${length}px`;
    backbone.setAttribute("viewBox", `0 0 ${length} ${stageHeight}`);
    ribosome.setAttribute("viewBox", `0 0 ${width} ${stageHeight}`);
    scale = Math.min(mobile ? 1.1 : 1.65, width * .85 / 420, (stageHeight - baseline - 12) / 145, (baseline - 12) / 218);
    shape.setAttribute("transform", `translate(${center} ${baseline}) scale(${scale})`);
    firstX = nodes[0].x - markerSize * .65;
    lastX = nodes.at(-1).x + markerSize * .65;
    primeStart.style.top = primeEnd.style.top = `${baseline + 25}px`;
    // The middle base of AUG starts in the channel; UAA finishes there.
    startCamera = nodes[1].x - center;
    travel = nodes.at(-2).x - center - startCamera;
    distance = Math.max(travel * .8, sceneHeight * 2.6);
    journey.style.height = `${sceneHeight + distance}px`;
    if (wasPinned) window.scrollTo({ top: window.scrollY + journey.getBoundingClientRect().top + previousProgress * distance, behavior: "instant" });
    else if (wasAfter) window.scrollBy({ top: journey.getBoundingClientRect().bottom - before.bottom, behavior: "instant" });
    cameraReady = false;
    lastTime = 0;
    request();
  }
  function scheduleLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      if (Math.abs(section.clientWidth - width) > 1 || Math.abs(sizeReference.getBoundingClientRect().height - sceneHeight) > 1) layout();
      else request();
    });
  }
  function yAt(x) {
    if (motion.matches) return baseline;
    const flexibility = clamp((Math.abs(x - camera - center) - 55 * scale) / (150 * scale), 0, 1);
    return baseline + flexibility * (Math.sin(x / 250 - camera / 720 + phase) * 9 + Math.sin(x / 570 - phase * .6) * 3);
  }
  function frame(time) {
    queued = false;
    if (!enabled || section.dataset.view !== "rna") return;
    const p = progress();
    const bounds = scene.getBoundingClientRect();
    const visible = bounds.bottom > 0 && bounds.top < window.innerHeight && !document.hidden;
    const dt = lastTime ? clamp(time - lastTime, 8, 40) : 16;
    lastTime = time;
    const target = startCamera + p * travel;
    if (!cameraReady || motion.matches || !visible || p === 0 || p === 1) camera = target;
    else camera += (target - camera) * (1 - Math.exp(-dt / 65));
    cameraReady = true;
    phase = time / 1900;
    track.style.transform = `translate3d(${-camera.toFixed(2)}px,0,0)`;
    const points = [];
    for (let x = firstX; x < lastX; x += 16) points.push(`${points.length ? "L" : "M"}${x.toFixed(2)} ${yAt(x).toFixed(2)}`);
    points.push(`L${lastX.toFixed(2)} ${yAt(lastX).toFixed(2)}`);
    strand.setAttribute("d", points.join(" "));
    nodes.forEach(node => {
      const y = yAt(node.x);
      node.unit.style.transform = `translate3d(0,${(y - baseline).toFixed(2)}px,0)`;
      node.sugar.setAttribute("transform", `translate(${node.x} ${y.toFixed(2)})`);
    });
    phosphates.forEach(node => {
      node.element.setAttribute("cx", node.x);
      node.element.setAttribute("cy", yAt(node.x).toFixed(2));
    });
    primeStart.style.left = `${firstX - camera}px`;
    primeEnd.style.left = `${lastX - camera - 12}px`;
    const nearest = projectNodes.reduce((best, node) => Math.abs(node.x - camera - center) < Math.abs(best.x - camera - center) ? node : best);
    cards.forEach(card => card.classList.toggle("is-current", nearest.card === card));
    if (visible && !motion.matches) request();
  }
  function goToCard(id, immediate = false) {
    const node = projectNodes.find(node => node.card.id === id);
    if (!enabled || !node) return;
    const fraction = clamp((node.x - center - startCamera) / travel, 0, 1);
    if (immediate || motion.matches) { camera = startCamera + fraction * travel; cameraReady = true; }
    window.scrollTo({ top: journey.getBoundingClientRect().top + window.scrollY + fraction * distance, behavior: immediate || motion.matches ? "instant" : "smooth" });
    request();
  }
  function setView(view) {
    if (section.dataset.view === view) return;
    const before = section.getBoundingClientRect();
    const readingProjects = before.top < window.innerHeight && before.bottom > 0;
    if (enabled) savedProgress = progress();
    section.dataset.view = view;
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.projectView === view)));
    reset();
    layout();
    if (readingProjects) window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY + (enabled ? savedProgress * distance : 0), behavior: "instant" });
    else if (before.bottom <= 0) window.scrollBy({ top: section.getBoundingClientRect().bottom - before.bottom, behavior: "instant" });
    cameraReady = false;
    request();
  }
  viewport.addEventListener("focusin", event => {
    const card = event.target.closest(".project");
    if (card) goToCard(card.id, true);
  });
  viewport.addEventListener("keydown", event => {
    if (!enabled || event.target !== viewport) return;
    const current = projectNodes.reduce((best, node, index) => Math.abs(node.x - camera - center) < Math.abs(projectNodes[best].x - camera - center) ? index : best, 0);
    const destinations = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: cards.length - 1 };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    goToCard(cards[clamp(destinations[event.key], 0, cards.length - 1)].id);
  });
  const routeHash = () => { if (location.hash.startsWith("#project-")) goToCard(location.hash.slice(1), true); };
  buttons.forEach(button => button.addEventListener("click", () => setView(button.dataset.projectView)));
  if (motion.matches) {
    section.dataset.view = "list";
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.projectView === "list")));
  }
  controls.hidden = false;
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("hashchange", routeHash);
  // Run after the browser's initial fragment scroll, which otherwise shifts
  // the pinned journey after its card has already been centered.
  window.addEventListener("load", () => requestAnimationFrame(routeHash), { once: true });
  document.addEventListener("visibilitychange", request);
  motion.addEventListener("change", () => { if (motion.matches) setView("list"); else request(); });
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(section);
    observer.observe(sizeReference);
  }
  layout();
  routeHash();
})();
