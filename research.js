import * as THREE from "./vendor/three/three.module.js";
import "./projects.js?v=full-clinical";
import { createCentrifuge, inspectionPose, molecularPose, pelletComponent, openingRotation, EXPERIENCE_SLOTS, SLOT_RADIUS, RESEARCH_STOPS } from "./research-model.js?v=centrifuge-first";

(() => {
  const section = document.getElementById("research");
  if (!section) return;
  const journey = section.querySelector(".research-journey");
  const scene = section.querySelector(".research-scene");
  const heading = section.querySelector(".research-heading");
  const stage = section.querySelector(".research-stage");
  const visual = section.querySelector(".research-visual");
  const articles = [...section.querySelectorAll(".research-tube")];
  const controls = section.querySelector(".research-controls");
  const progressBar = section.querySelector(".research-progress span");
  const cue = section.querySelector(".research-scroll-cue");
  const projects = document.getElementById("projects");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const theme = window.matchMedia("(prefers-color-scheme: dark)");
  const sizeReference = document.createElement("div");
  sizeReference.className = "research-size-reference";
  sizeReference.setAttribute("aria-hidden", "true");
  scene.append(sizeReference);
  const stops = RESEARCH_STOPS;
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
  let canvasWidth = 0, canvasHeight = 0, idleAngle = 0, bridgeProgress;

  function palette() {
    const style = getComputedStyle(document.documentElement);
    const value = name => style.getPropertyValue(name).trim();
    return { accent: value("--accent"), paper: value("--surface"), text: value("--text"), muted: value("--muted"), metal: value("--border"), rim: value("--muted"), balance: value("--level-0"), background: value("--background") };
  }
  function textureFactory(colors) {
    return (kind, slot, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = kind === "cap" ? 256 : 1024;
      canvas.height = kind === "cap" ? 256 : 1536;
      const ctx = canvas.getContext("2d");
      if (kind === "cap") {
        ctx.fillStyle = index >= 0 ? colors.accent : colors.balance;
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = index >= 0 ? colors.paper : colors.muted;
        ctx.textAlign = "center";
        ctx.font = "600 90px system-ui, sans-serif";
        ctx.fillText(String(slot + 1).padStart(2, "0"), 128, 142);
        ctx.font = "500 31px system-ui, sans-serif";
        ctx.fillText(index >= 0 ? ["BOS", "UCSF", "HD", "HARVARD", "HD UNI"][index] : slot === 3 ? "PROJECTS" : "BAL", 128, 194);
      } else {
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
        } else if (slot === 3) {
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
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return texture;
    };
  }
  function buildModel() {
    if (model) { world.remove(model.assembly, model.base); model.dispose(); }
    const colors = palette();
    model = createCentrifuge(colors, textureFactory(colors));
    world.add(model.assembly, model.base);
  }
  function initializeRenderer() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "Six upright tubes in a centrifuge rotor. Scroll to read research on tubes 1, 2, and 3 and education on tubes 5 and 6, then return overhead, open tube 4, and descend into its pellet to enter the mRNA science projects.");
      renderer.domElement.setAttribute("aria-describedby", articles.map(article => article.id).join(" "));
      visual.append(renderer.domElement);
      world = new THREE.Scene();
      world.add(new THREE.HemisphereLight(0xffffff, 0x8d9a90, 2.3));
      const key = new THREE.DirectionalLight(0xffffff, 3.3);
      key.position.set(5, 9, 7);
      world.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 1.2);
      fill.position.set(-6, 4, -3);
      world.add(fill);
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
    enabled = false;
    bridgeProgress = undefined;
    section.classList.remove("is-enhanced");
    journey.style.removeProperty("height");
    scene.style.removeProperty("--research-details");
    articles.forEach(article => article.classList.remove("is-current"));
    controls.hidden = true;
    heading.style.removeProperty("opacity");
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
    if (motion.matches || unavailable) return;
    const headingHeight = heading.getBoundingClientRect().height + 24;
    const stageHeight = stableHeight - headingHeight - (width <= 760 ? 98 : 76);
    if (width < 260 || stageHeight < 440 || !initializeRenderer()) return;
    enabled = true;
    linked = Boolean(projects?.classList.contains("is-enhanced"));
    section.classList.add("is-enhanced");
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
    const { tilt, cameraAngle, rotorAngle, closeUp, focus, opening, dive, molecules, handoff } = pose;
    const w = visual.clientWidth, h = visual.clientHeight;
    if (!w || !h) return;
    if (w !== canvasWidth || h !== canvasHeight) {
      renderer.setSize(w, h, false);
      canvasWidth = w; canvasHeight = h;
    }
    const aspect = w / h;
    const overviewHeight = Math.max(8.4, 8.55 / aspect);
    const labelHeight = Math.max(2.55, 1.28 / aspect);
    const readingHeight = overviewHeight + (labelHeight - overviewHeight) * closeUp;
    const tubeHeight = Math.max(1.35, 1.35 / aspect);
    const focusedHeight = readingHeight + (tubeHeight - readingHeight) * focus;
    const viewHeight = focusedHeight * (1 - dive) + .22 * dive;
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.zoom = 1;
    const targetY = (.1 + (.02 - .1) * closeUp) * (1 - dive) - 1.57 * dive;
    const targetZ = (SLOT_RADIUS + .487) * closeUp * (1 - focus) + SLOT_RADIUS * focus;
    // Overhead descent stays on the open tube's axis and ends just above its pellet.
    const cameraDistance = 18 * (1 - dive) + .24 * dive;
    camera.position.set(0, targetY + Math.cos(cameraAngle) * cameraDistance, targetZ + Math.sin(cameraAngle) * cameraDistance);
    // A stable camera basis throughout the vertical orbit: no roll or pole flip.
    camera.up.set(0, Math.sin(cameraAngle), -Math.cos(cameraAngle));
    camera.lookAt(0, targetY, targetZ);
    camera.updateProjectionMatrix();
    const angle = rotorAngle + openingRotation(pose.progress, idleAngle);
    model.assembly.rotation.y = angle;
    model.openSample(opening);
    world.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    let origins;
    if (linked && pose.progress > .9 && pose.progress < 1) {
      const granules = model.tubeGroups[3].getObjectByName("pellet-granules");
      const rnaTop = Number(projects.dataset.rnaStageTop);
      origins = Array.from({ length: 100 }, (_, index) => {
        const point = pelletComponent(index);
        const center = new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(granules.matrixWorld).project(camera);
        return { x: (center.x + 1) * w / 2, y: stage.offsetTop + (1 - center.y) * h / 2 - rnaTop, r: .008 / viewHeight * h };
      });
    }
    syncBridge(pose, origins);
    // The projected particles take over at the same locations as these 3D grains.
    model.tubeGroups[3].getObjectByName("pellet-granules").material.opacity = 1 - molecularPose(pose.progress).particles;
    // Tube transforms remain fixed. Only the fourth cap lifts off its tube.
    renderer.render(world, camera);
    renderer.domElement.style.opacity = "1";
    heading.style.opacity = (1 - molecules).toFixed(4);
    controls.style.opacity = (1 - molecules).toFixed(4);
    let nearest = 0, front = -Infinity;
    for (let index = 0; index < articles.length; index++) {
      const depth = Math.cos(angle + EXPERIENCE_SLOTS[index] * Math.PI / 3);
      if (depth > front) { front = depth; nearest = index; }
    }
    articles.forEach((article, index) => article.classList.toggle("is-current", nearest === index));
    const transitionCues = { return: "Scroll to return overhead ↓", sample: "Tube 04 · From sample to discovery ↓", opening: "Scroll to open the tube ↓", diving: "Into the pellet ↓", molecular: "From sample to molecular scale ↓", ribosome: "Science projects · mRNA → ribosome" };
    cue.textContent = transitionCues[pose.phase] || (tilt < .98 ? "Scroll to lower the viewpoint ↓" : `${String(nearest + 1).padStart(2, "0")} / 05 · ${nearest === 4 ? "Scroll to continue" : "Scroll to the next tube"} ↓`);
    progressBar.style.transform = `scaleX(${progress})`;
    section.dataset.phase = pose.phase;
    section.dataset.rotorAngle = angle.toFixed(5);
    section.dataset.activeTube = nearest.toString();
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
    if (!visible) { current = target; ready = false; syncBridge(inspectionPose(linked ? target : target * .56)); return; }
    if (!ready || motion.matches || target < .0005 || target > .9995) current = target;
    else current += (target - current) * (1 - Math.exp(-dt / 65));
    ready = true;
    const idle = target < .0005 && current < .0005;
    if (idle) idleAngle += dt * .000055;
    draw(current);
    if (idle || Math.abs(current - target) > .00003) request();
  }
  function goToTube(index, immediate = false) {
    if (!enabled) return;
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
  window.addEventListener("scroll", request, { passive: true });
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
