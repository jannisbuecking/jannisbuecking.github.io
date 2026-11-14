// Paint the live SVG/HTML RNA scene directly into a canvas. No external images,
// HTML screenshots, or network resources are needed for the monitor handoff.
export function captureRNAScene(scene) {
  const bounds = scene.getBoundingClientRect();
  const canvas = document.createElement('canvas'), ratio = 2;
  canvas.width = Math.round(bounds.width * ratio); canvas.height = Math.round(bounds.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  ctx.fillStyle = background; ctx.fillRect(0, 0, bounds.width, bounds.height);
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
    ctx.beginPath(); ctx.rect(rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height); ctx.clip();
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
