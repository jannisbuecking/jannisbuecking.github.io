import * as THREE from './vendor/three/three.module.js';
import './projects.js?v=clean-scenes';
import { createClinicalRoom, READING_STOPS, CLINICAL_FRACTION, PHONE_STOP, smooth } from './previews/clinical-room-model.js?v=lift-turn-stack';
import { createClinicalTextures } from './previews/clinical-textures.js?v=lift-turn-stack';
import { captureRNAScene } from './clinical-snapshot.js?v=full-clinical';
import { experiences } from './previews/clinical-data.js';
import { createDeskPhone } from './desk-phone.js?v=desk-phone';

const section = document.getElementById('clinical');
const projects = document.getElementById('projects');
const sourceScene = projects.querySelector('.rna-scene');
const journey = section.querySelector('.clinical-journey');
const scene = section.querySelector('.clinical-scene');
const container = section.querySelector('.clinical-canvas');
const heading = section.querySelector('.clinical-heading');
const caption = section.querySelector('.clinical-caption');
const counter = section.querySelector('.clinical-counter');
const cue = section.querySelector('.clinical-cue');
const bar = section.querySelector('.clinical-progress span');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const phone = createDeskPhone(document.getElementById('contact'));
const entries = [...section.querySelectorAll('.clinical-records .experience-list > li')].map((item, index) => {
  const [role, location] = item.querySelector('.entry-role').textContent.trim().split(' · ');
  return { ...experiences[index], year: item.querySelector('.entry-year').textContent.trim(), institution: item.querySelector('h4').textContent.trim(), role, location, topic: item.querySelector('p:last-child').textContent.trim() };
});
const sizeReference = document.createElement('div'); sizeReference.className = 'clinical-size-reference'; scene.append(sizeReference);
const clamp = value => Math.max(0, Math.min(1, value));
let enabled = false, unavailable = false, queued = false, layoutQueued = false;
let renderer, world, camera, room, textures;
let width = 0, height = 0, distance = 0, current = 0, lastTime = 0, ready = false;
let snapshotReady = false, capturePending = false, frozen = false;
let resizeProgress = null;

function freeze(active) {
  if (frozen === active) return;
  frozen = active; projects.dispatchEvent(new CustomEvent('clinicalfreeze', { detail: active }));
}
function initialize() {
  if (renderer) return true;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(renderer.domElement);
    world = new THREE.Scene(); world.add(new THREE.HemisphereLight('#fffdf2', '#b8c2b7', 2.5));
    const sun = new THREE.DirectionalLight('#fff5dd', 3.3); sun.position.set(-3, 10, 8); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, near: .1, far: 35 });
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .035; sun.shadow.bias = -.00015; world.add(sun);
    const fill = new THREE.DirectionalLight('#dbe8ee', 1.1); fill.position.set(7, 6, -2); world.add(fill);
    camera = new THREE.PerspectiveCamera(42, 1, .05, 180);
    textures = createClinicalTextures(renderer, entries);
    room = createClinicalRoom('consultation', textures.texture, { matchEntrance: true, includePhone: true }); world.add(room.group);
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); unavailable = true; refresh(); });
    return true;
  } catch {
    renderer?.dispose(); renderer = null; unavailable = true; return false;
  }
}
function progress() { return distance ? clamp(-journey.getBoundingClientRect().top / distance) : 0; }
function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
function reset() {
  enabled = false; freeze(false);
  section.classList.remove('is-enhanced'); projects.classList.remove('has-clinical-link', 'is-clinical-handoff');
  journey.style.removeProperty('height'); heading.style.removeProperty('opacity'); caption.style.removeProperty('opacity');
  projects.style.removeProperty('--clinical-viewport');
  phone.reset(section.querySelector('.clinical-records'));
  snapshotReady = false; section.dataset.snapshot = 'pending'; ready = false;
}
function layout() {
  const before = journey.getBoundingClientRect(), previous = resizeProgress ?? (ready ? current : progress());
  resizeProgress = null;
  const wasPinned = enabled && before.top <= 0 && before.top >= -distance;
  const wasAfter = enabled && before.bottom <= 0;
  reset(); width = section.clientWidth; height = sizeReference.getBoundingClientRect().height;
  if (motion.matches || height < 520 || !projects.classList.contains('is-enhanced') || unavailable || !initialize()) return;
  enabled = true; section.classList.add('is-enhanced'); projects.classList.add('has-clinical-link');
  phone.mount(scene);
  projects.style.setProperty('--clinical-viewport', `${height}px`);
  distance = Math.max(3600, height * 6.4) / CLINICAL_FRACTION; journey.style.height = `${height + distance}px`;
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim(); renderer.setClearColor(background);
  if (wasPinned) scrollTo({ top: scrollY + journey.getBoundingClientRect().top + previous * distance, behavior: 'instant' });
  else if (wasAfter) scrollBy({ top: journey.getBoundingClientRect().bottom - before.bottom, behavior: 'instant' });
  request();
}
function scheduleLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    if (Math.abs(width - section.clientWidth) > 1 || Math.abs(height - sizeReference.getBoundingClientRect().height) > 1) layout();
    else request();
  });
}
function ensureSnapshot() {
  if (snapshotReady || capturePending) return;
  capturePending = true; freeze(true);
  // The RNA renderer completes its final frame before this canvas is painted.
  requestAnimationFrame(() => {
    capturePending = false;
    if (!enabled || journey.getBoundingClientRect().top > 1) return;
    try {
      const snapshot = captureRNAScene(sourceScene);
      textures.setScreen(snapshot, getComputedStyle(document.documentElement).getPropertyValue('--background').trim());
      snapshotReady = true; section.dataset.snapshot = 'ready'; request();
    } catch {
      unavailable = true; refresh();
    }
  });
}
function handoff(progress, top) {
  const entering = top <= 1;
  const reveal = snapshotReady && entering ? smooth(progress / .025) : 0;
  const rect = projects.getBoundingClientRect();
  section.style.setProperty('--clinical-reveal', String(reveal));
  projects.classList.toggle('is-clinical-handoff', entering && progress < .035);
  projects.style.setProperty('--clinical-left', `${rect.left}px`); projects.style.setProperty('--clinical-width', `${rect.width}px`);
  projects.style.setProperty('--clinical-source-opacity', String(1 - reveal));
  if (!entering) { freeze(false); snapshotReady = false; section.dataset.snapshot = 'pending'; }
}
function frame(time) {
  queued = false; if (!enabled) return;
  const bounds = journey.getBoundingClientRect(), target = progress();
  const dt = lastTime ? Math.min(200, time - lastTime) : 16; lastTime = time;
  if (bounds.top > 1) { current = 0; ready = false; handoff(0, bounds.top); phone.hide(); return; }
  freeze(true);
  if (!ready || target === 0 || target === 1) current = target;
  else current += (target - current) * (1 - Math.exp(-dt / 65));
  ready = true;
  const clinicalProgress = Math.min(1, current / CLINICAL_FRACTION);
  ensureSnapshot(); handoff(clinicalProgress, bounds.top);
  const visible = bounds.bottom > 0 && !document.hidden;
  if (!visible) { current = target; ready = false; phone.hide(); return; }
  if (snapshotReady) {
    const pose = room.pose(current, camera.aspect); camera.position.copy(pose.position); camera.up.copy(pose.up); camera.lookAt(pose.target);
    room.update(current); renderer.render(world, camera);
    phone.update(room, camera, width, height, current, visible);
  }
  const phase = current > CLINICAL_FRACTION ? 'phone' : clinicalProgress < .035 ? 'handoff' : clinicalProgress < .34 ? 'zoomout' : clinicalProgress < .42 ? 'room' : 'experience';
  const index = room?.clipboard?.activePage ?? (clinicalProgress < .675 ? 0 : clinicalProgress < .855 ? 1 : 2);
  heading.style.opacity = String(smooth((clinicalProgress - .10) / .15) * (1 - smooth((clinicalProgress - .40) / .04)));
  caption.style.opacity = String(smooth((clinicalProgress - .07) / .12));
  bar.parentElement.style.opacity = String(smooth((clinicalProgress - .035) / .065));
  counter.textContent = phase === 'phone' ? 'LET’S CONNECT' : phase === 'experience' ? `PAGE 0${index + 1} / 03 · CLINICAL EXPERIENCE` : 'CLINIC';
  cue.textContent = phase === 'phone' ? 'Tap an app to connect · scroll to continue ↓' : phase === 'experience' ? (index === 2 ? 'Scroll to the iPhone ↓' : 'Scroll to turn the page ↓') : 'Scroll to reveal the Clinic and approach the clipboard ↓';
  bar.style.transform = `scaleX(${current})`;
  section.dataset.phase = phase; section.dataset.progress = current.toFixed(4); section.dataset.activeExperience = String(index);
  if (Math.abs(current - target) > .00002) request();
}
function refresh() {
  const before = section.getBoundingClientRect(), reading = before.top < innerHeight && before.bottom > 0;
  layout();
  if (!enabled) {
    if (reading) scrollTo({ top: scrollY + section.getBoundingClientRect().top, behavior: 'instant' });
    else if (before.bottom <= 0) scrollBy({ top: section.getBoundingClientRect().bottom - before.bottom, behavior: 'instant' });
  }
}
function routeHash() {
  if (!enabled) return;
  const index = ['#clinical-zomba', '#clinical-london', '#clinical-dallas'].indexOf(location.hash);
  const overview = ['#clinical', '#clinical-title'].includes(location.hash);
  const contact = ['#contact', '#phone-title'].includes(location.hash);
  if (index < 0 && !overview && !contact) return;
  current = contact ? PHONE_STOP : (overview ? .36 : READING_STOPS[index]) * CLINICAL_FRACTION; ready = true;
  scrollTo({ top: scrollY + journey.getBoundingClientRect().top + current * distance, behavior: 'instant' }); request();
}
window.addEventListener('scroll', request, { passive: true });
window.addEventListener('resize', () => { if (enabled && ready && resizeProgress === null) resizeProgress = current; scheduleLayout(); }, { passive: true });
window.addEventListener('hashchange', routeHash); window.addEventListener('load', () => requestAnimationFrame(routeHash), { once: true });
motion.addEventListener('change', refresh); document.addEventListener('visibilitychange', request);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (enabled) { snapshotReady = false; renderer.setClearColor(getComputedStyle(document.documentElement).getPropertyValue('--background').trim()); request(); } });
if (window.ResizeObserver) { const observer = new ResizeObserver(scheduleLayout); observer.observe(section); observer.observe(sizeReference); }
layout(); routeHash();
