import * as THREE from '../vendor/three/three.module.js';
import { createClinicalRoom, READING_STOPS } from './clinical-room-model.js?v=five-clinical';
import { experiences } from './clinical-data.js?v=five-clinical';
import { createClinicalTextures } from './clinical-textures.js?v=five-clinical';

const variant = document.body.dataset.room;
const container = document.querySelector('.room-canvas');
const journey = document.querySelector('.room-journey');
const sceneElement = document.querySelector('.room-scene');
const heading = document.querySelector('.room-heading');
const phaseNumber = document.querySelector('.phase-number');
const phaseTitle = document.querySelector('.phase-title');
const phaseDetail = document.querySelector('.phase-detail');
const progressBar = document.querySelector('.progress span');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.max(0, Math.min(1, value));
let renderer, world, camera, room, enabled = false, unavailable = false, queued = false, current = 0, ready = false, lastTime = 0;
let textures, lastMolecular = -1;

function initialize() {
  if (renderer) return true;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor('#f6f5f0');
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(renderer.domElement);
    world = new THREE.Scene(); world.add(new THREE.HemisphereLight('#fffdf2', '#b8c2b7', 2.5));
    const sun = new THREE.DirectionalLight('#fff5dd', 3.3); sun.position.set(-3, 10, 8); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, near: .1, far: 35 });
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .035; sun.shadow.bias = -.00015; world.add(sun);
    const fill = new THREE.DirectionalLight('#dbe8ee', 1.1); fill.position.set(7, 6, -2); world.add(fill);
    camera = new THREE.PerspectiveCamera(42, 1, .05, 180);
    textures = createClinicalTextures(renderer);
    room = createClinicalRoom(variant, textures.texture); world.add(room.group);
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); unavailable = true; layout(); });
    return true;
  } catch (error) {
    renderer?.dispose(); renderer = null; unavailable = true; return false;
  }
}
function progress() { const bounds = journey.getBoundingClientRect(); return clamp(-bounds.top / Math.max(1, bounds.height - sceneElement.clientHeight)); }
function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
function layout() {
  const before = progress();
  document.body.classList.remove('is-enhanced'); enabled = false;
  if (motion.matches || unavailable || innerHeight < 520 || !initialize()) return;
  enabled = true; document.body.classList.add('is-enhanced');
  journey.style.height = `${(7.4 + Math.max(0, experiences.length - 3)) * 100}svh`;
  renderer.setSize(innerWidth, sceneElement.clientHeight, false); camera.aspect = innerWidth / sceneElement.clientHeight; camera.updateProjectionMatrix();
  current = before; ready = false; request();
}
function frame(time) {
  queued = false; if (!enabled) return;
  const target = progress(), dt = lastTime ? Math.min(200, time - lastTime) : 16; lastTime = time;
  const rect = sceneElement.getBoundingClientRect(); if (rect.bottom <= 0 || rect.top >= innerHeight || document.hidden) { current = target; ready = false; return; }
  if (!ready || target === 0 || target === 1) current = target;
  else current += (target - current) * (1 - Math.exp(-dt / 65));
  ready = true;
  const pose = room.pose(current, camera.aspect); camera.position.copy(pose.position); camera.up.copy(pose.up); camera.lookAt(pose.target);
  room.update(current);
  if (current < .36 && Math.abs(current - lastMolecular) > .005) { textures.drawMolecule(current); lastMolecular = current; }
  renderer.render(world, camera);
  const index = room.clipboard?.activePage ?? READING_STOPS.reduce((best, stop, candidate) => Math.abs(stop - current) < Math.abs(READING_STOPS[best] - current) ? candidate : best, 0);
  const phase = current < .12 ? 'molecular' : current < .34 ? 'zoomout' : current < .42 ? 'room' : 'experience';
  document.body.dataset.phase = phase; document.body.dataset.activeExperience = String(index); document.body.dataset.progress = current.toFixed(4);
  heading.style.opacity = phase === 'experience' || phase === 'molecular' ? '0' : '1';
  phaseNumber.textContent = phase === 'experience' ? `0${index + 1} / ${String(experiences.length).padStart(2, '0')} · CLINICAL EXPERIENCE` : 'FROM MOLECULE TO MEDICINE';
  phaseTitle.textContent = phase === 'experience' ? (index === experiences.length - 1 ? 'Scroll to finish ↓' : 'Scroll to the next record ↓') : phase === 'room' ? (variant === 'laboratory' ? 'A room for clinical discovery' : 'Clinic') : variant === 'laboratory' ? 'From the optical field to the whole laboratory' : 'From the screen to the Clinic';
  phaseDetail.textContent = phase === 'experience' ? '' : variant === 'laboratory' ? 'Scroll onward to approach the five workstation records.' : 'Scroll onward to turn through the clipboard’s five pages.';
  progressBar.style.transform = `scaleX(${current})`;
  if (Math.abs(current - target) > .00002) request();
}
function routeHash() {
  if (!enabled) return;
  const index = [...document.querySelectorAll('.experience-source article')].findIndex(item => `#${item.id}` === location.hash);
  if (index < 0) return;
  const bounds = journey.getBoundingClientRect(); current = READING_STOPS[index]; ready = true;
  scrollTo({ top: scrollY + bounds.top + current * (bounds.height - sceneElement.clientHeight), behavior: 'instant' }); request();
}
window.addEventListener('scroll', request, { passive: true });
window.addEventListener('resize', layout, { passive: true });
window.addEventListener('hashchange', routeHash);
window.addEventListener('load', () => requestAnimationFrame(routeHash), { once: true });
motion.addEventListener('change', layout); document.addEventListener('visibilitychange', request);
layout(); routeHash();
