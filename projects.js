// Adapted from the owner's Institute of Human Genetics Heidelberg RNA explorer.
import { molecularPose, molecularOwners, unfoldPoint, samplePolygon, circleToShape } from "./research-model.js?v=pellet-shapes";
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
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sizeReference = document.createElement("div");
  sizeReference.className = "rna-size-reference";
  sizeReference.setAttribute("aria-hidden", "true");
  scene.append(sizeReference);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let enabled = false, queued = false, layoutQueued = false;
  let width = 0, sceneHeight = 0, baseline = 0, center = 0, scale = 1;
  let startCamera = 0, travel = 0, distance = 0, camera = 0;
  let cameraReady = false, lastTime = 0, phase = 0;
  let nodes = [], phosphates = [], projectNodes = [], firstX = 0, lastX = 0;
  let bridge = molecularPose(1), origins = [];
  let grains = [];
  const owners = molecularOwners(units.length);
  const assigned = new Set(Object.values(owners).flat());
  const subunits = [...shape.querySelectorAll("path")].map(element => ({ element, original: element.getAttribute("d"), points: [] }));
  let bonds = [];
  let uiBoxes = [];
  const ui = [primeStart, primeEnd, section.querySelector(".section-heading"), section.querySelector(".rna-caption")];

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
    section.querySelectorAll("[data-morph-element]").forEach(element => element.removeAttribute("style"));
    subunits.forEach(({ element, original }) => { element.setAttribute("d", original); element.removeAttribute("style"); });
    cards.forEach(card => {
      card.removeAttribute("style");
      card.classList.remove("is-current");
    });
    section.querySelector(".section-heading").style.removeProperty("opacity");
    section.querySelector(".rna-caption").style.removeProperty("opacity");
  }
  function layout() {
    const previousProgress = progress();
    const before = journey.getBoundingClientRect();
    const wasPinned = enabled && before.top <= 0 && before.top >= -distance;
    const wasAfter = enabled && before.bottom <= 0;
    reset();
    width = section.clientWidth;
    sceneHeight = sizeReference.getBoundingClientRect().height;
    if (motion.matches) return;
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
    section.dataset.rnaBaseline = String(baseline);
    section.dataset.rnaStageTop = String(stageTop);
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
      const element = card || mark;
      element.dataset.morphElement = "base";
      element.dataset.originIndex = owners.bases[index];
      sugar.children[0].dataset.originIndex = owners.stems[index];
      sugar.children[0].dataset.morphRole = "stem";
      sugar.children[1].dataset.originIndex = owners.sugars[index];
      sugar.children[1].dataset.morphRole = "sugar";
      return { unit, card, x, sugar, element, box: { x, y: card ? cardTop + cardHeight / 2 : markerTop + markerSize / 2, width: unitWidth, height: card ? cardHeight : markerSize }, stem: card ? stemHeight : baseline - markerTop - markerSize };
    });
    projectNodes = nodes.filter(node => node.card);
    const drawing = document.createDocumentFragment();
    grains = Array.from({ length: 100 }, (_, index) => {
      const element = svg("circle", { class: "rna-pellet-grain" });
      drawing.append(element);
      return { index, element };
    });
    nodes.forEach(node => drawing.append(node.sugar));
    phosphates = nodes.slice(0, -1).map((node, index) => {
      const element = svg("circle", { r: 3.5, "data-origin-index": owners.phosphates[index], "data-morph-role": "phosphate" });
      drawing.append(element);
      return { x: (node.x + nodes[index + 1].x) / 2, element };
    });
    sugars.replaceChildren(drawing);
    bonds = owners.bonds.map(index => {
      const element = svg("path", { class: "rna-morph-bond", "data-origin-index": index, "data-morph-role": "backbone" });
      sugars.prepend(element);
      return element;
    });
    const length = nodes.at(-1).x + center;
    track.style.width = `${length}px`;
    backbone.setAttribute("viewBox", `0 0 ${length} ${stageHeight}`);
    ribosome.setAttribute("viewBox", `0 0 ${width} ${stageHeight}`);
    scale = Math.min(mobile ? 1.1 : 1.65, width * .85 / 420, (stageHeight - baseline - 12) / 145, (baseline - 12) / 218);
    subunits.forEach((subunit, index) => {
      subunit.points = Array.from({ length: 192 }, (_, step) => {
        const point = subunit.element.getPointAtLength(subunit.element.getTotalLength() * step / 192);
        return { x: point.x, y: point.y };
      });
      subunit.element.dataset.originIndex = owners.subunits[index];
      subunit.element.dataset.morphRole = "subunit";
    });
    ui.forEach((element, index) => { element.dataset.morphElement = "label"; element.dataset.originIndex = owners.labels[index]; });
    shape.setAttribute("transform", `translate(${center} ${baseline}) scale(${scale})`);
    firstX = nodes[0].x - markerSize * .65;
    lastX = nodes.at(-1).x + markerSize * .65;
    primeStart.style.top = primeEnd.style.top = `${baseline + 25}px`;
    // The middle base of AUG starts in the channel; UAA finishes there.
    startCamera = nodes[1].x - center;
    travel = nodes.at(-2).x - center - startCamera;
    distance = Math.max(travel * .8, sceneHeight * 2.6);
    journey.style.height = `${sceneHeight + distance}px`;
    primeStart.style.left = `${firstX - startCamera}px`;
    primeEnd.style.left = `${lastX - startCamera - 12}px`;
    uiBoxes = ui.map((element, index) => {
      const rect = element.getBoundingClientRect(), parent = (index < 2 ? stage : scene).getBoundingClientRect();
      return { x: rect.left - parent.left + rect.width / 2, y: rect.top - parent.top + rect.height / 2, width: rect.width, height: rect.height };
    });
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
    if (!enabled) return;
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
    const morph = section.classList.contains("has-lab-link") ? bridge : molecularPose(1);
    const { particles, unfold, bases, ribosome: forming, labels } = morph;
    section.dataset.unfold = unfold.toFixed(4);
    const source = (index, local = true) => {
      const point = origins[index] || { x: center, y: baseline * .65, r: 8 };
      return { ...point, x: point.x + (local ? camera : 0) };
    };
    const pathData = points => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(" ") + "Z";
    const fillBetween = (amount, final) => `color-mix(in srgb, var(--accent) ${(1 - amount) * 100}%, ${final})`;
    function drawShape(element, origin, target, amount, finalFill) {
      element.setAttribute("d", pathData(circleToShape(origin, target, amount)));
      element.style.fill = fillBetween(amount, finalFill);
      element.style.opacity = String(particles);
    }
    function morphElement(element, origin, box, amount, finalFill, wave = 0) {
      const point = unfoldPoint(origin, { x: box.x, y: box.y + wave }, amount);
      const w = origin.r * 2 * (1 - amount) + box.width * amount;
      const h = origin.r * 2 * (1 - amount) + box.height * amount;
      const radius = `calc(${50 * (1 - amount)}% + ${10 * amount}px)`;
      element.style.transformOrigin = "50% 50%";
      element.style.transform = `translate(${(point.x - box.x).toFixed(3)}px,${(point.y - box.y).toFixed(3)}px) scale(${w / box.width},${h / box.height})`;
      element.style.borderRadius = amount === 1 ? "" : radius;
      element.style.clipPath = amount === 1 ? "" : `inset(0 round ${radius})`;
      element.style.background = amount === 1 ? "" : fillBetween(amount, finalFill);
      element.style.opacity = String(particles);
      const ink = amount ** 3;
      element.style.setProperty("--morph-ink", ink.toFixed(4));
      if (element.classList.contains("nucleotide-mark") || element.classList.contains("rna-prime")) element.style.color = amount === 1 ? "" : `color-mix(in srgb, var(--accent) ${ink * 100}%, transparent)`;
    }
    track.style.transform = `translate3d(${-camera.toFixed(2)}px,0,0)`;
    const points = [];
    for (let x = firstX; x < lastX; x += 16) points.push(`${points.length ? "L" : "M"}${x.toFixed(2)} ${yAt(x).toFixed(2)}`);
    points.push(`L${lastX.toFixed(2)} ${yAt(lastX).toFixed(2)}`);
    strand.setAttribute("d", points.join(" "));
    strand.style.display = unfold === 1 ? "" : "none";
    strand.style.opacity = String(particles);
    const anchors = nodes.flatMap((node, index) => index < phosphates.length ? [node.x, phosphates[index].x] : [node.x]);
    bonds.forEach((element, index) => {
      element.style.display = unfold === 1 ? "none" : "";
      if (unfold === 1) return;
      const from = index === 0 ? firstX : anchors[index], to = index === bonds.length - 1 ? lastX : anchors[index + 1];
      const edge = Array.from({ length: 24 }, (_, step) => {
        const x = from + (to - from) * step / 23;
        return { x, y: yAt(x) };
      });
      const ribbon = [...edge.map(point => ({ x: point.x, y: point.y - 1.25 })), ...[...edge].reverse().map(point => ({ x: point.x, y: point.y + 1.25 }))];
      drawShape(element, source(owners.bonds[index]), ribbon, unfold, "var(--accent)");
      element.style.opacity = String(particles * (1 - .2 * unfold));
    });
    nodes.forEach((node, index) => {
      const y = yAt(node.x), wave = y - baseline;
      const polygon = samplePolygon([[-6,8],[-10,-3],[-1,-11],[10,-6],[8,7]].map(([x, dy]) => ({ x: node.x + x, y: y + dy })));
      drawShape(node.sugar.children[1], source(owners.sugars[index]), polygon, unfold, "var(--background)");
      const stem = samplePolygon([{ x: node.x - .65, y: y - 10 }, { x: node.x + .65, y: y - 10 }, { x: node.x + .65, y: y - node.stem }, { x: node.x - .65, y: y - node.stem }]);
      drawShape(node.sugar.children[0], source(owners.stems[index]), stem, bases, "var(--accent)");
      node.sugar.children[0].style.stroke = "none";
      node.sugar.children[0].style.opacity = String(particles * (1 - .45 * bases));
      morphElement(node.element, source(owners.bases[index]), node.box, node.card ? labels : bases, "var(--surface)", wave);
    });
    phosphates.forEach((node, index) => {
      const origin = source(owners.phosphates[index]);
      const point = unfoldPoint(origin, { x: node.x, y: yAt(node.x) }, unfold);
      node.element.setAttribute("cx", point.x); node.element.setAttribute("cy", point.y);
      node.element.setAttribute("r", origin.r * (1 - unfold) + 3.5 * unfold);
      node.element.style.opacity = String(particles);
    });
    grains.forEach(({ index, element }) => {
      element.style.display = assigned.has(index) ? "none" : "";
      if (assigned.has(index)) return;
      const origin = source(index);
      element.setAttribute("cx", origin.x); element.setAttribute("cy", origin.y);
      element.setAttribute("r", origin.r * (1 - unfold));
      element.style.opacity = String(particles);
    });
    // Each complete subunit is one pellet circle continuously reshaped into its contour.
    shape.setAttribute("transform", `translate(${center} ${baseline}) scale(${scale})`);
    ribosome.style.opacity = "1";
    subunits.forEach((subunit, index) => {
      const point = source(owners.subunits[index], false);
      const origin = { x: (point.x - center) / scale, y: (point.y - baseline) / scale, r: point.r / scale };
      drawShape(subunit.element, origin, subunit.points, forming, index ? "var(--level-1)" : "var(--tag)");
      subunit.element.style.opacity = String(particles * (1 - .42 * forming));
      if (forming === 1) subunit.element.setAttribute("d", subunit.original);
    });
    primeStart.style.left = `${firstX - camera}px`;
    primeEnd.style.left = `${lastX - camera - 12}px`;
    ui.forEach((element, index) => {
      const inStage = index < 2, origin = source(owners.labels[index], false);
      if (!inStage) origin.y += Number(section.dataset.rnaStageTop);
      const box = { ...uiBoxes[index], x: uiBoxes[index].x - (inStage ? camera - startCamera : 0) };
      if (box.width && box.height) morphElement(element, origin, box, labels, "transparent");
    });
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
  function refreshAnimation() {
    const before = section.getBoundingClientRect();
    const reading = before.top < window.innerHeight && before.bottom > 0;
    layout();
    if (!enabled) {
      if (reading) window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top, behavior: "instant" });
      else if (before.bottom <= 0) window.scrollBy({ top: section.getBoundingClientRect().bottom - before.bottom, behavior: "instant" });
    }
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
  window.addEventListener("scroll", request, { passive: true });
  section.addEventListener("labtransition", event => {
    bridge = event.detail;
    if (event.detail.origins) origins = event.detail.origins;
    request();
  });
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("hashchange", routeHash);
  // Run after the browser's initial fragment scroll, which otherwise shifts
  // the pinned journey after its card has already been centered.
  window.addEventListener("load", () => requestAnimationFrame(routeHash), { once: true });
  document.addEventListener("visibilitychange", request);
  motion.addEventListener("change", refreshAnimation);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(section);
    observer.observe(sizeReference);
  }
  layout();
  routeHash();
})();
