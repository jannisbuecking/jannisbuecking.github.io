// Paint the live SVG/HTML RNA scene directly into a canvas. No external images,
// HTML screenshots, or network resources are needed for the monitor handoff.
export function monitorCaptureFrame(width, height, aspect = width / height) {
  const expandedWidth = Math.max(width, height * aspect);
  const expandedHeight = Math.max(height, width / aspect);
  return { width: expandedWidth, height: expandedHeight, left: (width - expandedWidth) / 2, top: (height - expandedHeight) / 2 };
}

export function captureRNAScene(scene, { aspect } = {}) {
  const viewport = scene.getBoundingClientRect();
  const frame = monitorCaptureFrame(viewport.width, viewport.height, aspect);
  const bounds = { width: frame.width, height: frame.height, left: viewport.left + frame.left, top: viewport.top + frame.top };
  bounds.right = bounds.left + bounds.width; bounds.bottom = bounds.top + bounds.height;
  // Match the monitor texture's resolution without allocating a huge portrait
  // screenshot. The original viewport remains exactly centred in the image.
  const canvas = document.createElement('canvas'), ratio = aspect ? Math.min(2, 2048 / bounds.width) : 2;
  canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  ctx.fillStyle = background; ctx.fillRect(0, 0, bounds.width, bounds.height);
  let stageLeft = aspect ? bounds.left : viewport.left;
  let stageRight = aspect ? bounds.right : viewport.right;
  if (aspect) for (const element of scene.querySelectorAll('.project,.nucleotide-mark')) {
    const rect = element.getBoundingClientRect();
    // Newly revealed margins end between complete bases/cards. Never trim the
    // original viewport: it must remain identical at the start of the handoff.
    if (rect.left < stageLeft && rect.right > stageLeft && rect.right <= viewport.left) stageLeft = Math.min(viewport.left, rect.right + 12);
    if (rect.left < stageRight && rect.right > stageRight && rect.left >= viewport.right) stageRight = Math.max(viewport.right, rect.left - 12);
  }
  function opacity(element) {
    let alpha = 1;
    for (let node = element; node && node !== scene.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return 0;
      alpha *= Number(style.opacity);
    }
    return alpha;
  }
  function stageClip() {
    const rect = scene.querySelector('.rna-stage').getBoundingClientRect();
    // Once pulled back, reveal the scene beyond the phone's horizontal crop.
    ctx.beginPath(); ctx.rect(aspect ? stageLeft - bounds.left : rect.left - bounds.left, rect.top - bounds.top, aspect ? stageRight - stageLeft : rect.width, rect.height); ctx.clip();
  }
  function drawSVG(svg) {
    ctx.save(); stageClip();
    for (const element of svg.querySelectorAll('path,circle')) {
      const alpha = opacity(element), matrix = element.getScreenCTM();
      if (!alpha || !matrix) continue;
      const style = getComputedStyle(element), path = element.tagName === 'path' ? new Path2D(element.getAttribute('d') || '') : new Path2D();
      if (element.tagName === 'circle') {
        const radius = Number(element.getAttribute('r'));
        if (!radius) continue;
        path.arc(Number(element.getAttribute('cx') || 0), Number(element.getAttribute('cy') || 0), radius, 0, Math.PI * 2);
      }
      ctx.save(); ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e - bounds.left, matrix.f - bounds.top);
      if (style.fill !== 'none') { ctx.globalAlpha = alpha * Number(style.fillOpacity); ctx.fillStyle = style.fill; ctx.fill(path); }
      if (style.stroke !== 'none') {
        ctx.globalAlpha = alpha * Number(style.strokeOpacity); ctx.strokeStyle = style.stroke;
        const scale = style.vectorEffect === 'non-scaling-stroke' ? Math.hypot(matrix.a, matrix.b) : 1;
        ctx.lineWidth = parseFloat(style.strokeWidth) / scale; ctx.lineCap = style.strokeLinecap; ctx.lineJoin = style.strokeLinejoin;
        ctx.stroke(path);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function drawHTML(root, clipped) {
    ctx.save(); if (clipped) stageClip();
    for (const element of [root, ...root.querySelectorAll('*')]) {
      const alpha = opacity(element); if (!alpha) continue;
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (rect.right < bounds.left || rect.left > bounds.right || rect.bottom < bounds.top || rect.top > bounds.bottom) continue;
      const x = rect.left - bounds.left, y = rect.top - bounds.top, radius = parseFloat(style.borderRadius) || 0;
      ctx.globalAlpha = alpha;
      if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        ctx.fillStyle = style.backgroundColor; ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, radius); ctx.fill();
      }
      const widths = ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(style[`border${side}Width`]) || 0);
      if (widths.every(width => width === widths[0]) && widths[0]) {
        ctx.strokeStyle = style.borderTopColor; ctx.lineWidth = widths[0]; ctx.beginPath(); ctx.roundRect(x + widths[0] / 2, y + widths[0] / 2, Math.max(0, rect.width - widths[0]), Math.max(0, rect.height - widths[0]), radius); ctx.stroke();
      } else {
        const edges = [[x,y,x+rect.width,y], [x+rect.width,y,x+rect.width,y+rect.height], [x,y+rect.height,x+rect.width,y+rect.height], [x,y,x,y+rect.height]];
        widths.forEach((width, index) => { if (width) { ctx.strokeStyle = style[`border${['Top','Right','Bottom','Left'][index]}Color`]; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(edges[index][0],edges[index][1]); ctx.lineTo(edges[index][2],edges[index][3]); ctx.stroke(); } });
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, alpha = opacity(node.parentElement); if (!alpha) continue;
      const style = getComputedStyle(node.parentElement), range = document.createRange();
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = style.color; ctx.globalAlpha = alpha;
      for (const match of node.textContent.matchAll(/\S+/g)) {
        range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        if (!rect.width || rect.right < bounds.left || rect.left > bounds.right || rect.bottom < bounds.top || rect.top > bounds.bottom) continue;
        const text = style.textTransform === 'uppercase' ? match[0].toUpperCase() : style.textTransform === 'lowercase' ? match[0].toLowerCase() : match[0];
        const metrics = ctx.measureText(text);
        ctx.fillText(text, rect.left - bounds.left, rect.top - bounds.top + (metrics.fontBoundingBoxAscent || parseFloat(style.fontSize) * .8));
      }
    }
    ctx.restore();
  }
  drawSVG(scene.querySelector('.rna-ribosome'));
  drawSVG(scene.querySelector('.rna-backbone'));
  scene.querySelectorAll('.project,.nucleotide-mark,.rna-prime').forEach(element => drawHTML(element, true));
  drawHTML(scene.querySelector('.section-heading'), false); drawHTML(scene.querySelector('.rna-caption'), false);
  return canvas;
}
