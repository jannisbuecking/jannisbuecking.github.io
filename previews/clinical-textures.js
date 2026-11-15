import * as THREE from '../vendor/three/three.module.js';
import { experiences as defaultExperiences, molecularPaths } from './clinical-data.js?v=five-clinical';

export function createClinicalTextures(renderer, experiences = defaultExperiences) {
let molecularCanvas, molecularTexture;
function texture(kind, index) {
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'molecular' ? 2048 : 1024;
  canvas.height = kind === 'molecular' ? 1400 : kind.includes('sign') ? 190 : 1400;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fdfcf8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    wrap(kind === 'lab-sign' ? 'CLINICAL LABORATORY' : 'CLINIC', 113, '600 58px system-ui', '#28694b', 70, 870);
  } else {
    const item = experiences[index];
    const ink = '#202923', muted = '#586359';
    let y = wrap(item.year, 135, '650 76px system-ui', item.color, 94);
    y = wrap(item.institution, y + 55, '650 82px system-ui', ink, 98);
    y = wrap(item.role, y + 65, '500 58px system-ui', muted, 78);
    y = wrap(item.location, y + 5, '400 56px system-ui', muted, 76);
    ctx.fillStyle = '#d9ded5'; ctx.fillRect(100, y + 30, 824, 3);
    wrap(item.topic, y + 130, '400 64px system-ui', ink, 88);
    ctx.font = '600 35px system-ui'; ctx.fillStyle = muted; ctx.fillText(`CLINICAL EXPERIENCE  /  0${index + 1}`, 100, 1290);
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
function setScreen(source, background = '#f6f5f0') {
  molecularCanvas.width = 2048;
  molecularCanvas.height = Math.round(2048 * 1.18 / 1.86);
  const ctx = molecularCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = background; ctx.fillRect(0, 0, molecularCanvas.width, molecularCanvas.height);
  const ratio = Math.min(molecularCanvas.width / source.width, molecularCanvas.height / source.height);
  const w = source.width * ratio, h = source.height * ratio;
  ctx.drawImage(source, (molecularCanvas.width - w) / 2, (molecularCanvas.height - h) / 2, w, h);
  molecularTexture.needsUpdate = true;
}
return { texture, drawMolecule, setScreen };
}
