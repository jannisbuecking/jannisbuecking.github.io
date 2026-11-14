(() => {
  "use strict";
  const section = document.getElementById("research");
  if (!section) return;
  const journey = section.querySelector(".research-journey");
  const scene = section.querySelector(".research-scene");
  const heading = section.querySelector(".research-heading");
  const stage = section.querySelector(".research-stage");
  const tubes = [...section.querySelectorAll(".research-tube")];
  const rotor = section.querySelector(".research-rotor");
  const disc = section.querySelector(".research-rotor-disc");
  const machine = section.querySelector(".research-machine");
  const shadow = section.querySelector(".research-floor-shadow");
  const progressBar = section.querySelector(".research-progress span");
  const controls = section.querySelector(".research-controls");
  const cue = section.querySelector(".research-scroll-cue");
  const nav = [...section.querySelectorAll("[data-research-index]")];
  const viewSwitch = section.querySelector(".research-view-switch");
  const viewButtons = [...viewSwitch.querySelectorAll("button")];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sizeReference = document.createElement("div");
  sizeReference.className = "research-size-reference";
  sizeReference.setAttribute("aria-hidden", "true");
  scene.append(sizeReference);
  const stops = [.38, .65, .92];
  const tau = Math.PI * 2;
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const mix = (start, end, value) => start + (end - start) * value;
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  let enabled = false, queued = false, layoutQueued = false;
  let width = 0, stableHeight = 0, distance = 0, current = 0, savedProgress = 0;
  let geometry = null, ready = false, lastTime = 0;

  function targetProgress() {
    return distance ? clamp(-journey.getBoundingClientRect().top / distance) : 0;
  }
  function request() {
    if (!queued) { queued = true; requestAnimationFrame(frame); }
  }
  function reset() {
    enabled = false;
    section.classList.remove("is-enhanced");
    journey.style.removeProperty("height");
    scene.style.removeProperty("--research-details");
    tubes.forEach(tube => { tube.removeAttribute("style"); tube.classList.remove("is-current"); });
    controls.hidden = true;
  }
  function layout() {
    const before = journey.getBoundingClientRect();
    const previous = targetProgress();
    const wasPinned = enabled && before.top <= 0 && before.top >= -distance;
    const wasAfter = enabled && before.bottom <= 0;
    reset();
    width = section.clientWidth;
    stableHeight = sizeReference.getBoundingClientRect().height;
    if (section.dataset.view !== "explore") return;
    const headingHeight = heading.getBoundingClientRect().height + 28;
    const stageHeight = stableHeight - headingHeight - (width <= 760 ? 98 : 76);
    const endWidth = Math.min(300, width - 40);
    if (width < 260 || stageHeight < 440) return;
    // Measure the longest real tube label before sizing the illustration.
    tubes.forEach(tube => { tube.style.width = `${endWidth}px`; });
    const labelHeight = Math.max(...tubes.map(tube => tube.querySelector(".research-paper").getBoundingClientRect().height));
    const endHeight = Math.max(360, labelHeight + 180);
    tubes.forEach(tube => tube.removeAttribute("style"));
    if (endHeight > stageHeight - 55) return;
    scene.style.setProperty("--research-stage-top", `${headingHeight}px`);
    const diameter = Math.min(width * .92, stageHeight * .88, 650);
    const startWidth = Math.min(136, Math.max(92, width * .27));
    const startHeight = Math.min(240, Math.max(180, width * .54), stageHeight * .42);
    const radialLimit = Math.sqrt(Math.max(0, (width / 2 - 10) ** 2 - (startWidth / 2) ** 2)) - startHeight / 2;
    geometry = {
      height: stageHeight, diameter, startWidth, startHeight, endWidth, endHeight,
      topRadius: Math.min(diameter * .23, Math.max(20, radialLimit)),
      sideRadius: Math.min(330, Math.max(155, width * .31)),
    };
    enabled = true;
    section.classList.add("is-enhanced");
    controls.hidden = false;
    scene.style.setProperty("--research-diameter", `${diameter}px`);
    distance = Math.max(stableHeight * 4.2, 2800);
    journey.style.height = `${stableHeight + distance}px`;
    if (wasPinned) window.scrollTo({ top: window.scrollY + journey.getBoundingClientRect().top + previous * distance, behavior: "instant" });
    else if (wasAfter) window.scrollBy({ top: journey.getBoundingClientRect().bottom - before.bottom, behavior: "instant" });
    ready = false;
    request();
  }
  function scheduleLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      if (Math.abs(width - section.clientWidth) > 1 || Math.abs(stableHeight - sizeReference.getBoundingClientRect().height) > 1) layout();
      else request();
    });
  }
  function draw(p) {
    const g = geometry;
    const tilt = ease((p - .1) / .22);
    const rotation = p < .32
      ? mix(-Math.PI / 2, Math.PI / 2, ease(p / .32))
      : Math.PI / 2 - tau / 3 * (ease((p - .44) / .14) + ease((p - .7) / .14));
    const flatness = mix(1, .26, tilt);
    const centerX = width / 2;
    const rotorY = g.height * mix(.49, .71, tilt);
    const tubeWidth = mix(g.startWidth, g.endWidth, tilt);
    const tubeHeight = mix(g.startHeight, g.endHeight, tilt);
    scene.style.setProperty("--research-tube-width", `${tubeWidth}px`);
    scene.style.setProperty("--research-tube-height", `${tubeHeight}px`);
    scene.style.setProperty("--research-details", ease((tilt - .48) / .45));
    rotor.style.transform = `translate(${centerX - g.diameter / 2}px, ${rotorY - g.diameter / 2}px) scaleY(${flatness})`;
    rotor.style.zIndex = tilt > .7 ? "10" : "1";
    disc.style.transform = `rotate(${rotation * 180 / Math.PI}deg)`;
    const machineY = rotorY + g.diameter / 2 * flatness - 12;
    machine.style.width = `${g.diameter * .92}px`;
    machine.style.transform = `translate(${centerX - g.diameter * .46}px,${machineY}px) scaleY(${tilt})`;
    machine.style.opacity = tilt;
    shadow.style.width = `${g.diameter}px`;
    shadow.style.transform = `translate(${centerX - g.diameter / 2}px,${machineY + 68 * tilt}px)`;
    shadow.style.opacity = mix(.2, .8, tilt);
    let nearest = 0, bestDepth = -1;
    tubes.forEach((tube, index) => {
      const theta = rotation + index * tau / 3;
      const depth = (Math.sin(theta) + 1) / 2;
      if (depth > bestDepth) { bestDepth = depth; nearest = index; }
      const topX = centerX + Math.cos(theta) * g.topRadius;
      const topY = rotorY + Math.sin(theta) * g.topRadius;
      const sideX = centerX + Math.cos(theta) * g.sideRadius;
      const sideY = rotorY + Math.sin(theta) * g.sideRadius * .26 - tubeHeight * .38 - depth * 46;
      const x = mix(topX, sideX, tilt);
      const y = mix(topY, sideY, tilt);
      const angle = (theta * 180 / Math.PI + 90) * (1 - tilt);
      const scale = mix(1, .83 + depth * .17, tilt);
      tube.style.transform = `translate(${x - tubeWidth / 2}px,${y - tubeHeight / 2}px) rotate(${angle}deg) scale(${scale})`;
      tube.style.zIndex = tilt < .5 ? (index + 3).toString() : (depth > .65 ? 30 : 5).toString();
      tube.style.opacity = mix(1, .42 + depth * .58, tilt);
    });
    tubes.forEach((tube, index) => tube.classList.toggle("is-current", tilt > .8 && nearest === index));
    nav.forEach((button, index) => button.setAttribute("aria-pressed", String(tilt > .8 && nearest === index)));
    cue.textContent = tilt < .98 ? "Scroll to change your perspective ↓" : `${String(nearest + 1).padStart(2, "0")} / 03 · ${nearest === 2 ? "Scroll to continue" : "Scroll to the next tube"} ↓`;
    progressBar.style.transform = `scaleX(${p})`;
    section.dataset.phase = tilt < .02 ? "top" : tilt < .98 ? "turning" : "side";
    section.dataset.activeTube = nearest.toString();
  }
  function frame(time) {
    queued = false;
    if (!enabled) return;
    const target = targetProgress();
    const dt = lastTime ? clamp(time - lastTime, 8, 40) : 16;
    lastTime = time;
    const bounds = scene.getBoundingClientRect();
    const visible = bounds.bottom > 0 && bounds.top < window.innerHeight && !document.hidden;
    if (!visible) { current = target; ready = false; return; }
    if (!ready || !visible || motion.matches || target === 0 || target === 1) current = target;
    else current += (target - current) * (1 - Math.exp(-dt / 65));
    ready = true;
    draw(current);
    if (visible && Math.abs(current - target) > .00003) request();
  }
  function goToTube(index, immediate = false) {
    if (!enabled) return;
    const progress = stops[index];
    if (immediate || motion.matches) { current = progress; ready = true; }
    window.scrollTo({ top: window.scrollY + journey.getBoundingClientRect().top + progress * distance, behavior: immediate || motion.matches ? "instant" : "smooth" });
    request();
  }
  function setView(view) {
    if (view === section.dataset.view) return;
    const before = section.getBoundingClientRect();
    const reading = before.top < window.innerHeight && before.bottom > 0;
    if (enabled) savedProgress = targetProgress();
    section.dataset.view = view;
    viewButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.researchView === view)));
    reset();
    layout();
    if (reading) window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top + (enabled ? savedProgress * distance : 0), behavior: "instant" });
    else if (before.bottom <= 0) window.scrollBy({ top: section.getBoundingClientRect().bottom - before.bottom, behavior: "instant" });
    ready = false;
    request();
  }
  viewButtons.forEach(button => button.addEventListener("click", () => setView(button.dataset.researchView)));
  nav.forEach((button, index) => button.addEventListener("click", () => goToTube(index)));
  tubes.forEach((tube, index) => {
    tube.querySelector(".research-cap").addEventListener("click", () => goToTube(index));
    tube.querySelector(".research-cap").addEventListener("focus", () => goToTube(index, true));
  });
  const routeHash = () => { const index = tubes.findIndex(tube => `#${tube.id}` === location.hash); if (index >= 0) goToTube(index, true); };
  if (motion.matches) {
    section.dataset.view = "list";
    viewButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.researchView === "list")));
  }
  viewSwitch.hidden = false;
  motion.addEventListener("change", () => { if (motion.matches) setView("list"); });
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("hashchange", routeHash);
  window.addEventListener("load", () => requestAnimationFrame(routeHash), { once: true });
  document.addEventListener("visibilitychange", request);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(section);
    observer.observe(sizeReference);
  }
  layout();
  routeHash();
})();
