import * as THREE from '../vendor/three/three.module.js';
import { createClinicalRoom, READING_STOPS } from './clinical-room-model.js?v=rooms-1';
import { experiences, molecularPaths } from './clinical-data.js';

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
let molecularCanvas, molecularTexture, lastMolecular = -1;

function texture(kind, index) {
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'molecular' ? 2048 : 1024;
  canvas.height = kind === 'molecular' ? 1400 : kind.includes('sign') ? 190 : 1400;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = kind === 'cover' ? experiences[index].color : '#fdfcf8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (kind === 'molecular') { molecularCanvas = canvas; molecularTexture = map; drawMolecule(0); return map; }
  function wrap(text, y, font, color, lineHeight, maxWidth = 820) {
    ctx.font = font; ctx.fillStyle = color; let line = '';
    for (const word of text.split(/\s+/)) {
      if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) { ctx.fillText(line, 100, y); y += lineHeight; line = word; }
      else line += `${line ? ' ' : ''}${word}`;
    }
    if (line) ctx.fillText(line, 100, y);
    return y + lineHeight;
  }
  if (kind.includes('sign')) {
    ctx.fillStyle = '#28694b'; ctx.fillRect(25, 30, 13, 130);
    wrap(kind === 'lab-sign' ? 'CLINICAL LABORATORY' : 'CONSULTATION ROOM', 113, '600 58px system-ui', '#28694b', 70, 870);
  } else {
    const item = experiences[index], cover = kind === 'cover';
    const ink = cover ? '#fdfcf8' : '#202923', muted = cover ? '#e4eadf' : '#586359';
    let y = wrap(cover ? `CLINICAL EXPERIENCE  /  0${index + 1}` : item.year, 135, cover ? '500 36px system-ui' : '650 70px system-ui', cover ? muted : item.color, 90);
    y = wrap(item.institution, y + (cover ? 190 : 55), '650 76px system-ui', ink, 92);
    y = wrap(item.role, y + 65, '500 53px system-ui', muted, 72);
    y = wrap(item.location, y + 5, '400 51px system-ui', muted, 72);
    ctx.fillStyle = cover ? '#fdfcf855' : '#d9ded5'; ctx.fillRect(100, y + 30, 824, 3);
    if (!cover) wrap(item.topic, y + 130, '400 57px system-ui', ink, 80);
    ctx.font = '600 35px system-ui'; ctx.fillStyle = muted; ctx.fillText(cover ? 'JANNIS BUECKING' : `CLINICAL EXPERIENCE  /  0${index + 1}`, 100, 1290);
  }
  return map;
}
function drawMolecule(progress) {
  const ctx = molecularCanvas.getContext('2d'), w = 1024, h = 700;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.fillStyle = '#f6f5f0'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(w / 2, h * .61); ctx.scale(1.75, 1.75);
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#28694b88';
  molecularPaths.forEach((path, index) => { ctx.fillStyle = index ? '#b4d4b4' : '#e9eee5'; ctx.fill(new Path2D(path)); ctx.stroke(new Path2D(path)); });
  ctx.restore();
  const baseline = h * .61;
  ctx.strokeStyle = '#28694b'; ctx.lineWidth = 3; ctx.beginPath();
  for (let x = 0; x <= w; x += 6) {
    const y = baseline + Math.sin(x / 190 + progress * 5) * 8;
    if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ['A', 'U', 'G', 'C', 'U', 'A', 'A'].forEach((letter, index) => {
    const x = 85 + index * 143, y = baseline + Math.sin(x / 190 + progress * 5) * 8;
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y - 93); ctx.strokeStyle = '#28694b88'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fdfcf8'; ctx.strokeStyle = '#28694b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - 40, y - 178, 80, 80, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#28694b'; ctx.font = '500 42px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText(letter, x, y - 123);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  });
  ctx.textAlign = 'left'; ctx.font = '500 22px system-ui'; ctx.fillStyle = '#586359'; ctx.fillText('mRNA  ·  5′ → 3′', 55, h - 36);
  molecularTexture.needsUpdate = true;
}
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
    camera = new THREE.PerspectiveCamera(42, 1, .01, 180);
    room = createClinicalRoom(variant, texture); world.add(room.group);
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
  if (current < .36 && Math.abs(current - lastMolecular) > .005) { drawMolecule(current); lastMolecular = current; }
  renderer.render(world, camera);
  const index = current < .66 ? 0 : current < .83 ? 1 : 2;
  const phase = current < .12 ? 'molecular' : current < .34 ? 'zoomout' : current < .42 ? 'room' : 'experience';
  document.body.dataset.phase = phase; document.body.dataset.activeExperience = String(index); document.body.dataset.progress = current.toFixed(4);
  heading.style.opacity = phase === 'experience' || phase === 'molecular' ? '0' : '1';
  phaseNumber.textContent = phase === 'experience' ? `0${index + 1} / 03 · CLINICAL EXPERIENCE` : 'FROM MOLECULE TO MEDICINE';
  phaseTitle.textContent = phase === 'experience' ? (index === 2 ? 'Scroll to finish ↓' : 'Scroll to the next record ↓') : phase === 'room' ? (variant === 'laboratory' ? 'A room for clinical discovery' : 'The clinical consultation room') : variant === 'laboratory' ? 'From the optical field to the whole laboratory' : 'From the screen to the whole consultation room';
  phaseDetail.textContent = phase === 'experience' ? '' : variant === 'laboratory' ? 'Scroll onward to approach the three workstation records.' : 'Scroll onward to open the three clinical folders.';
  progressBar.style.transform = `scaleX(${current})`;
  if (Math.abs(current - target) > .00002) request();
}
function routeHash() {
  if (!enabled) return;
  const index = ['#zomba', '#london', '#dallas'].indexOf(location.hash);
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
