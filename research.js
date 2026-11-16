import * as THREE from "./vendor/three/three.module.js";
import "./projects.js?v=green-particles";
import { createResearchBench, isPortraitBench, researchOverviewHeight } from "./research-bench.js?v=bench-bedside";
import { createCentrifuge, inspectionPose, molecularPose, sampleParticle, SAMPLE_PARTICLE_RADIUS, createOpeningSpin, OPENING_END, EXPERIENCE_SLOTS, SAMPLE_SLOT, SLOT_RADIUS, RESEARCH_STOPS } from "./research-model.js?v=portrait-bench";

(() => {
  const section = document.getElementById("research");
  if (!section) return;
  const journey = section.querySelector(".research-journey");
  const scene = section.querySelector(".research-scene");
  const heading = section.querySelector(".research-heading");
  const intro = section.querySelector(".research-intro");
  const stage = section.querySelector(".research-stage");
  const visual = section.querySelector(".research-visual");
  const articles = [...section.querySelectorAll(".research-tube")];
  const controls = section.querySelector(".research-controls");
  const projects = document.getElementById("projects");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const theme = window.matchMedia("(prefers-color-scheme: dark)");
  const sizeReference = document.createElement("div");
  sizeReference.className = "research-size-reference";
  sizeReference.setAttribute("aria-hidden", "true");
  scene.append(sizeReference);
  const stops = RESEARCH_STOPS;
  // Native scroll positions round to whole pixels near the first reading stop.
  const firstReadingReady = stops[0] - .001;
  const experiences = articles.map(article => {
    const paragraphs = [...article.querySelectorAll(".research-paper p")];
    const [role, lab] = paragraphs[0].textContent.trim().split(" · ");
    return {
      year: article.querySelector(".entry-year").textContent.trim(),
      institution: article.querySelector(".research-institution").textContent.trim(),
      role, lab, topic: paragraphs[1].textContent.trim(),
    };
  });
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  let enabled = false, unavailable = false, queued = false, layoutQueued = false, linked = false;
  let width = 0, stableHeight = 0, distance = 0, current = 0;
  let ready = false, lastTime = 0, renderer, world, camera, model;
  let canvasWidth = 0, canvasHeight = 0, bridgeProgress, labelFactory, bench;
  let baseLabels = [], sharpLabels = new Map(), labelWindow = [0], labelAnchor = 0, labelDirection = 1;
  let labelJob = null, lastScrollInput = -Infinity, labelPaints = 0;
  let readingQuality = false, qualityTimer;
  let ambientLight, keyLight, fillLight, portraitLook;
  let overviewInset = 0;
  const spin = createOpeningSpin();
  let spinState = spin.snapshot(), hasOpened = false;
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

  function palette() {
    const style = getComputedStyle(document.documentElement);
    const value = name => style.getPropertyValue(name).trim();
    return { accent: value("--accent"), paper: value("--surface"), text: value("--text"), muted: value("--muted"), metal: value("--border"), rim: value("--muted"), balance: value("--level-0"), background: value("--background") };
  }
  function textureFactory(colors) {
    return (kind, slot, index, labelScale = 1) => {
      const canvas = document.createElement("canvas");
      if (kind !== "label") return null;
      canvas.width = 1024 * labelScale;
      canvas.height = 1536 * labelScale;
      const ctx = canvas.getContext("2d");
      ctx.scale(labelScale, labelScale);
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, 1024, 1536);
      const left = 192, contentWidth = 640;
      const wrap = (text, y, font, lineHeight, color) => {
        ctx.font = font;
        ctx.fillStyle = color;
        let line = "";
        for (const word of text.split(/\s+/)) {
          const candidate = line ? `${line} ${word}` : word;
          if (line && ctx.measureText(candidate).width > contentWidth) {
            ctx.fillText(line, left, y);
            y += lineHeight;
            line = word;
          } else line = candidate;
        }
        if (line) { ctx.fillText(line, left, y); y += lineHeight; }
        return y;
      };
      if (index >= 0) {
        const item = experiences[index];
        let y = wrap(item.year, 114, "600 72px system-ui, sans-serif", 80, colors.accent);
        y = wrap(item.institution, y + 56, "650 76px system-ui, sans-serif", 90, colors.text);
        y = wrap(item.role, y + 42, "400 60px system-ui, sans-serif", 76, colors.muted);
        y = wrap(item.lab, y + 16, "500 60px system-ui, sans-serif", 76, colors.text);
        ctx.fillStyle = colors.accent;
        ctx.fillRect(left, y + 20, contentWidth, 4);
        y = wrap(item.topic, y + 106, "400 60px system-ui, sans-serif", 80, colors.text);
        if (y > 1370) throw new Error("Research text exceeds the tube label");
      } else if (slot === SAMPLE_SLOT) {
        wrap("SCIENCE", 220, "600 84px system-ui, sans-serif", 106, colors.accent);
        wrap("PROJECTS", 326, "600 84px system-ui, sans-serif", 106, colors.accent);
        wrap("From sample to discovery", 550, "400 64px system-ui, sans-serif", 84, colors.muted);
      } else {
        wrap("BALANCE", 220, "600 84px system-ui, sans-serif", 106, colors.muted);
        wrap(`Position ${slot + 1}`, 430, "400 64px system-ui, sans-serif", 84, colors.muted);
      }
      ctx.fillStyle = colors.muted;
      ctx.font = "600 56px system-ui, sans-serif";
      ctx.fillText(`TUBE ${String(slot + 1).padStart(2, "0")}`, left, 1450);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      return texture;
    };
  }
  function buildModel() {
    cancelLabelPreparation();
    if (model) { world.remove(model.assembly, model.base); model.dispose(); }
    if (bench) { world.remove(bench.group); bench.dispose(); }
    const colors = palette();
    bench = createResearchBench(colors);
    world.add(bench.group);
    labelFactory = textureFactory(colors);
    model = createCentrifuge(colors, labelFactory);
    portraitLook = undefined;
    baseLabels = EXPERIENCE_SLOTS.map(slot => model.tubeGroups[slot].getObjectByName("tube-label").material.map);
    sharpLabels = new Map(); labelWindow = [0]; labelAnchor = 0; labelDirection = 1; labelPaints = 0;
    world.add(model.assembly, model.base);
    scheduleLabelPreparation();
  }
  function cancelLabelPreparation() {
    if (!labelJob) return;
    if (labelJob.idle) window.cancelIdleCallback(labelJob.id);
    else clearTimeout(labelJob.id);
    labelJob = null;
  }
  function scheduleLabelPreparation() {
    if (!enabled || unavailable || labelJob || !model) return;
    if (!canPrepareLabels()) return;
    const wanted = new Set(labelWindow);
    if (labelWindow.every(index => sharpLabels.has(index)) && [...sharpLabels.keys()].every(index => wanted.has(index))) return;
    const wait = 180 - (performance.now() - lastScrollInput);
    if (wait > 0) {
      labelJob = { idle: false, id: setTimeout(() => { labelJob = null; scheduleLabelPreparation(); }, wait) };
      return;
    }
    const prepare = () => {
      labelJob = null;
      if (!enabled || unavailable || !canPrepareLabels()) return;
      if (performance.now() - lastScrollInput < 180) { scheduleLabelPreparation(); return; }
      const desired = new Set(labelWindow);
      for (const [index, texture] of sharpLabels) if (!desired.has(index)) {
        model.setLabelTexture(EXPERIENCE_SLOTS[index], baseLabels[index], { retainPrevious: true });
        model.releaseLabelTexture(texture); sharpLabels.delete(index);
      }
      const index = labelWindow.find(index => !sharpLabels.has(index));
      if (index !== undefined) {
        const texture = labelFactory("label", EXPERIENCE_SLOTS[index], index, 2);
        renderer.initTexture(texture);
        model.setLabelTexture(EXPERIENCE_SLOTS[index], texture, { retainPrevious: true });
        sharpLabels.set(index, texture); labelPaints++;
        request();
      }
      scheduleLabelPreparation();
    };
    labelJob = window.requestIdleCallback
      ? { idle: true, id: window.requestIdleCallback(prepare, { timeout: 1500 }) }
      : { idle: false, id: setTimeout(prepare, 32) };
  }
  function canPrepareLabels() {
    const bounds = scene.getBoundingClientRect();
    if (document.hidden || bounds.bottom <= 0 || bounds.top >= innerHeight || spinState.mode === "braking") return false;
    const progress = linked ? current : current * .56;
    return Math.abs(current - targetProgress()) < .00003 && !(progress > OPENING_END && progress < firstReadingReady);
  }
  function anticipateLabels(index) {
    if ((linked ? current : current * .56) < firstReadingReady) {
      labelWindow = [0]; labelAnchor = 0;
    } else if (index !== labelAnchor || labelWindow.length !== 3) {
      labelDirection = index > labelAnchor ? 1 : -1;
      labelAnchor = index;
      labelWindow = [index, index + labelDirection, index - labelDirection, index + 2 * labelDirection, index - 2 * labelDirection]
        .filter(candidate => candidate >= 0 && candidate < EXPERIENCE_SLOTS.length).slice(0, 3);
    }
    scheduleLabelPreparation();
  }
  function initializeRenderer() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width <= 760 ? 3 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "Six upright tubes in a clockwise centrifuge rotor, with three laboratory pipettes, a six-well plate, and bacterial colonies on the left, and neurological examination instruments on the right. Scroll through Heidelberg University, Heidelberg research, UCSF, Harvard, and Boston Children’s Hospital, then return overhead, open the Projects sample in tube 6, and zoom into its suspended green particles to enter the mRNA science projects.");
      renderer.domElement.setAttribute("aria-describedby", articles.map(article => article.id).join(" "));
      visual.append(renderer.domElement);
      world = new THREE.Scene();
      ambientLight = new THREE.HemisphereLight(0xffffff, 0x8d9a90, 2.3); world.add(ambientLight);
      keyLight = new THREE.DirectionalLight(0xffffff, 3.3); keyLight.position.set(5, 9, 7); world.add(keyLight);
      fillLight = new THREE.DirectionalLight(0xffffff, 1.2); fillLight.position.set(-6, 4, -3); world.add(fillLight);
      camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .005, 100);
      buildModel();
      renderer.domElement.addEventListener("webglcontextlost", event => { event.preventDefault(); unavailable = true; refreshAnimation(); });
      return true;
    } catch {
      renderer?.dispose();
      renderer = null;
      unavailable = true;
      return false;
    }
  }
  function targetProgress() { return distance ? clamp(-journey.getBoundingClientRect().top / distance) : 0; }
  function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  function reset() {
    cancelLabelPreparation();
    clearTimeout(qualityTimer); readingQuality = false;
    enabled = false;
    bridgeProgress = undefined;
    section.classList.remove("is-enhanced");
    journey.style.removeProperty("height");
    scene.style.removeProperty("--research-details");
    articles.forEach(article => article.classList.remove("is-current"));
    controls.hidden = true;
    heading.style.removeProperty("opacity");
    intro.style.removeProperty("opacity");
    controls.style.removeProperty("opacity");
    section.classList.remove("has-project-transition");
    projects?.classList.remove("has-lab-link", "is-bridging");
    section.style.removeProperty("--lab-viewport");
  }
  function layout() {
    const before = journey.getBoundingClientRect();
    const previous = targetProgress();
    const wasPinned = enabled && before.top <= 0 && before.top >= -distance;
    const wasAfter = enabled && before.bottom <= 0;
    reset();
    width = section.clientWidth;
    stableHeight = sizeReference.getBoundingClientRect().height;
    if (motion.matches || unavailable) { heading.style.opacity = "1"; return; }
    // Measure the title at the full animated scene width, rather than the
    // narrower static fallback where its name and tagline may wrap differently.
    section.classList.add("is-enhanced");
    const headingHeight = Math.max(heading.getBoundingClientRect().height, intro.getBoundingClientRect().height) + 24;
    overviewInset = width <= 760 ? intro.getBoundingClientRect().height + 12 : 0;
    const stageHeight = stableHeight - (width <= 760 ? 12 : headingHeight) - 76;
    if (width < 260 || stageHeight < 440 || !initializeRenderer()) { section.classList.remove("is-enhanced"); heading.style.opacity = "1"; return; }
    enabled = true;
    linked = Boolean(projects?.classList.contains("is-enhanced"));
    section.classList.toggle("has-project-transition", linked);
    projects?.classList.toggle("has-lab-link", linked);
    section.style.setProperty("--lab-viewport", `${stableHeight}px`);
    controls.hidden = false;
    scene.style.setProperty("--research-stage-top", `${headingHeight}px`);
    distance = Math.max(stableHeight * 6.8, 4500) / (linked ? .56 : 1);
    journey.style.height = `${stableHeight + distance}px`;
    canvasWidth = canvasHeight = 0;
    if (wasPinned) window.scrollTo({ top: window.scrollY + journey.getBoundingClientRect().top + previous * distance, behavior: "instant" });
    else if (wasAfter) window.scrollBy({ top: journey.getBoundingClientRect().bottom - before.bottom, behavior: "instant" });
    ready = false;
    request();
    qualityTimer = setTimeout(request, 200);
    scheduleLabelPreparation();
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
  function syncBridge(pose, origins) {
    if (!linked) return;
    // Idle rotor frames do not change the downstream molecular scene.
    if (pose.progress === bridgeProgress && !origins) return;
    bridgeProgress = pose.progress;
    const transition = molecularPose(pose.progress);
    const rect = projects.getBoundingClientRect();
    const bridging = transition.particles > 0 && rect.top > .5;
    projects.classList.toggle("is-bridging", bridging);
    projects.style.setProperty("--lab-visible", transition.particles > 0 ? "1" : "0");
    projects.style.setProperty("--lab-background", transition.background.toFixed(4));
    projects.style.setProperty("--lab-left", `${rect.left}px`);
    projects.style.setProperty("--lab-width", `${rect.width}px`);
    projects.dispatchEvent(new CustomEvent("labtransition", { detail: { ...transition, origins } }));
  }
  function draw(progress) {
    const pose = inspectionPose(linked ? progress : progress * .56);
    const { tilt, cameraAngle, rotorAngle, closeUp, readingSpread, focus, opening, dive, molecules, handoff } = pose;
    const w = visual.clientWidth, h = visual.clientHeight;
    if (!w || !h) return;
    if (pose.progress < OPENING_END) readingQuality = false;
    if (pose.progress >= firstReadingReady && spinState.mode === "settled"
      && Math.abs(current - targetProgress()) < .00003 && performance.now() - lastScrollInput > 180) readingQuality = true;
    // Phones use native density from the opening frame and keep it through the
    // camera move. Desktop allocates its sharper buffer after reading settles.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, width <= 760 || readingQuality ? 3 : 1.5);
    if (renderer.getPixelRatio() !== pixelRatio) { renderer.setPixelRatio(pixelRatio); canvasWidth = 0; }
    if (w !== canvasWidth || h !== canvasHeight) {
      renderer.setSize(w, h, false);
      canvasWidth = w; canvasHeight = h;
    }
    const aspect = w / h;
    const portrait = isPortraitBench(aspect);
    if (portraitLook !== portrait) {
      portraitLook = portrait; model.setMobilePresentation(portrait);
      ambientLight.intensity = portrait ? 1.75 : 2.3;
      keyLight.intensity = portrait ? 4.2 : 3.3; keyLight.position.set(...(portrait ? [-5, 10, -6] : [5, 9, 7]));
      fillLight.intensity = portrait ? 1 : 1.2; fillLight.position.set(...(portrait ? [5, 5, 4] : [-6, 4, -3]));
    }
    const overview = (1 - smooth(tilt / .72)) * (1 - smooth(focus / .2));
    bench.update(aspect);
    const rotorHeight = Math.max(8.4, 8.55 / aspect);
    // Reserve title space within the overhead camera, keeping one framebuffer
    // size as the camera lowers and this inset smoothly leaves the composition.
    const openingHeight = Math.max(1, h - overviewInset);
    const benchHeight = researchOverviewHeight(w / openingHeight) * h / openingHeight;
    const overviewHeight = rotorHeight + (benchHeight - rotorHeight) * overview;
    // Desktop stays at one reading distance. Narrow windows widen only enough
    // to bridge the physical gap between adjacent tubes without an empty view.
    const readingHeightAtRest = Math.max(portrait ? 2.85 : 2.55, 1.28 / aspect);
    const narrowPullback = Math.max(0, 3.93 / aspect - readingHeightAtRest);
    const labelHeight = readingHeightAtRest + narrowPullback * readingSpread;
    const readingHeight = overviewHeight + (labelHeight - overviewHeight) * closeUp;
    const tubeHeight = Math.max(1.35, 1.35 / aspect);
    const focusedHeight = readingHeight + (tubeHeight - readingHeight) * focus;
    const particleHeight = Math.max(.62, .58 / aspect);
    const viewHeight = focusedHeight * (1 - dive) + particleHeight * dive;
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.zoom = 1;
    const readingTargetY = portrait ? .22 : .02;
    const targetY = (.1 + (readingTargetY - .1) * closeUp) * (1 - dive) - .86 * dive;
    const targetZ = (SLOT_RADIUS + .487) * closeUp * (1 - focus) + SLOT_RADIUS * focus
      + (portrait ? (.45 - overviewInset * benchHeight / (2 * h)) * overview * (1 - closeUp) * (1 - focus) : 0);
    // Descend through the liquid surface and stop above its suspended particles.
    const cameraDistance = 18 * (1 - dive) + .24 * dive;
    camera.position.set(0, targetY + Math.cos(cameraAngle) * cameraDistance, targetZ + Math.sin(cameraAngle) * cameraDistance);
    // A stable camera basis throughout the vertical orbit: no roll or pole flip.
    camera.up.set(0, Math.sin(cameraAngle), -Math.cos(cameraAngle));
    camera.lookAt(0, targetY, targetZ);
    camera.updateProjectionMatrix();
    const angle = rotorAngle + spinState.renderAngle;
    model.assembly.rotation.y = angle;
    model.openSample(opening);
    world.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    let origins;
    if (linked && pose.progress > .9 && pose.progress < 1) {
      const particles = model.tubeGroups[SAMPLE_SLOT].getObjectByName("sample-particles");
      const rnaTop = Number(projects.dataset.rnaStageTop);
      origins = Array.from({ length: 100 }, (_, index) => {
        const point = sampleParticle(index);
        const center = new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(particles.matrixWorld).project(camera);
        return { x: (center.x + 1) * w / 2, y: stage.offsetTop + (1 - center.y) * h / 2 - rnaTop, r: SAMPLE_PARTICLE_RADIUS / viewHeight * h };
      });
    }
    syncBridge(pose, origins);
    // The projected particles take over at the same locations as these 3D particles.
    model.immerseSample(camera.position.y, molecularPose(pose.progress).particles);
    let nearest = 0, front = -Infinity;
    for (let index = 0; index < articles.length; index++) {
      const depth = Math.cos(angle + EXPERIENCE_SLOTS[index] * Math.PI / 3);
      if (depth > front) { front = depth; nearest = index; }
    }
    if (pose.progress < .56) anticipateLabels(pose.progress < RESEARCH_STOPS[0] ? 0 : nearest);
    // Tube transforms remain fixed. Only the Projects cap lifts off its tube.
    renderer.render(world, camera);
    renderer.domElement.style.opacity = "1";
    heading.style.opacity = (smooth((pose.progress - .1792) / .0224) * (1 - molecules)).toFixed(4);
    intro.style.opacity = (1 - smooth((pose.progress - .015) / .1)).toFixed(4);
    controls.style.opacity = (1 - molecules).toFixed(4);
    articles.forEach((article, index) => article.classList.toggle("is-current", nearest === index));
    section.dataset.phase = pose.phase;
    section.dataset.rotorAngle = angle.toFixed(5);
    section.dataset.spinSpeed = spinState.speed.toFixed(3);
    section.dataset.spinAngle = spinState.angle.toFixed(5);
    section.dataset.spinMode = spinState.mode;
    section.dataset.benchVisible = bench.group.visible ? "1" : "0";
    section.dataset.benchLayout = portrait ? "portrait" : "wide";
    section.dataset.activeTube = nearest.toString();
    section.dataset.sharpLabel = sharpLabels.has(nearest) ? nearest.toString() : "-1";
    section.dataset.labelPaints = labelPaints.toString();
    section.dataset.labelCache = sharpLabels.size.toString();
    section.dataset.viewHeight = viewHeight.toFixed(5);
    section.dataset.pixelRatio = pixelRatio.toString();
    section.dataset.tubeCount = model.tubeGroups.length.toString();
    section.dataset.closeup = closeUp.toFixed(3);
    section.dataset.opening = opening.toFixed(3);
    section.dataset.dive = dive.toFixed(3);
    section.dataset.handoff = handoff.toFixed(3);
  }
  function frame(time) {
    queued = false;
    if (!enabled) return;
    const target = targetProgress();
    const dt = lastTime ? clamp(time - lastTime, 1, 200) : 16;
    lastTime = time;
    const bounds = scene.getBoundingClientRect();
    const visible = bounds.bottom > 0 && bounds.top < window.innerHeight && !document.hidden;
    if (!visible) { spinState = spin.align(); current = target; ready = false; syncBridge(inspectionPose(linked ? target : target * .56)); return; }
    if (!hasOpened && target > .001) spinState = spin.align();
    hasOpened = true;
    spinState = spin.update(dt / 1000, target);
    if (!ready || motion.matches || target < .0005 || target > .9995) current = target;
    else current += (target - current) * (1 - Math.exp(-dt / 65));
    ready = true;
    if (spinState.mode === "braking") current = Math.min(current, OPENING_END / (linked ? 1 : .56));
    draw(current);
    if (spinState.mode !== "settled" || Math.abs(current - target) > .00003) request();
  }
  function goToTube(index, immediate = false) {
    if (!enabled) return;
    spinState = spin.align();
    const progress = stops[index] / (linked ? 1 : .56);
    if (immediate || motion.matches) { current = progress; ready = true; }
    window.scrollTo({ top: window.scrollY + journey.getBoundingClientRect().top + progress * distance, behavior: immediate || motion.matches ? "instant" : "smooth" });
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
    ready = false;
    request();
  }
  const routeHash = () => { const index = articles.findIndex(article => `#${article.id}` === location.hash); if (index >= 0) goToTube(index, true); };
  motion.addEventListener("change", refreshAnimation);
  theme.addEventListener("change", () => { if (model) { buildModel(); request(); } });
  window.addEventListener("scroll", () => {
    lastScrollInput = performance.now(); cancelLabelPreparation();
    clearTimeout(qualityTimer); qualityTimer = setTimeout(request, 200); request();
  }, { passive: true });
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("hashchange", routeHash);
  window.addEventListener("load", () => requestAnimationFrame(routeHash), { once: true });
  document.addEventListener("visibilitychange", request);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(section); observer.observe(sizeReference);
  }
  layout(); routeHash();
})();
