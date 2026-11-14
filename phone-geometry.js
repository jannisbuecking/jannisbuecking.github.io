// Project a real HTML screen onto the four corners of the phone's 3D glass.
export function phoneTransform(quad, width, height) {
  const [a, b, c, d] = quad;
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-8 || width <= 0 || height <= 0) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const matrix = [(b.x - a.x + g * b.x) / width, (b.y - a.y + g * b.y) / width, 0, g / width,
    (d.x - a.x + h * d.x) / height, (d.y - a.y + h * d.y) / height, 0, h / height,
    0, 0, 1, 0, a.x, a.y, 0, 1];
  return matrix.every(Number.isFinite) ? matrix : null;
}
