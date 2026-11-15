import * as THREE from './vendor/three/three.module.js';
import { phoneTransform } from './phone-geometry.js?v=desk-phone';
import { getContributionData, contributionCalendarLayout } from './contribution-data.js?v=responsive-scroll';

export function createDeskPhone(host) {
  const screen = host.querySelector('.desk-phone');
  const calendar = host.querySelector('.phone-calendar');
  const ray = new THREE.Raycaster();
  let mounted = false;
  const parseDate = value => new Date(`${value}T00:00:00Z`);
  getContributionData().then(data => {
    const { offset, columns, months: monthLabels } = contributionCalendarLayout(data.days);
    const months = document.createElement('div'); months.className = 'phone-calendar-months';
    const grid = document.createElement('div'); grid.className = 'phone-calendar-grid';
    months.style.gridTemplateColumns = grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    const colors = ['#e8eee5', '#b4d4b4', '#72ad7d', '#3d8958', '#1f623f'];
    monthLabels.forEach(({ label: text, column, span }) => {
      const label = document.createElement('span'); label.textContent = text;
      label.style.gridColumn = `${column} / span ${span}`; months.append(label);
    });
    data.days.forEach((day, index) => {
      const date = parseDate(day.date), column = Math.floor((index + offset) / 7) + 1;
      const cell = document.createElement('span'); cell.style.gridColumn = column; cell.style.gridRow = date.getUTCDay() + 1;
      cell.style.setProperty('--day-color', colors[Math.max(0, Math.min(4, day.level))]);
      cell.title = `${day.count} contributions on ${day.date}`; grid.append(cell);
    });
    months.setAttribute('aria-hidden', 'true'); grid.setAttribute('aria-hidden', 'true');
    calendar.replaceChildren(months, grid);
    calendar.setAttribute('aria-label', `${data.total.toLocaleString()} GitHub contributions in the last 12 months`);
    host.querySelector('.phone-contribution-total').textContent = data.total.toLocaleString();
    host.querySelector('.phone-contribution-updated').textContent = `Updated ${new Date(data.updatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    screen.dataset.contributions = String(data.total); screen.dataset.contributionDays = String(data.days.length);
  }).catch(() => {
    host.querySelector('.phone-calendar-message').textContent = 'View my contributions on GitHub.';
    host.querySelector('.phone-contribution-total').textContent = 'GitHub';
    calendar.setAttribute('aria-label', 'Contribution calendar unavailable. Use the GitHub link to view activity.');
  });
  function hide() {
    screen.classList.remove('is-phone-visible', 'is-phone-interactive');
    if (mounted) { screen.inert = true; host.setAttribute('aria-hidden', 'true'); }
  }
  function mount(scene) { mounted = true; scene.append(host); hide(); }
  function reset(records) {
    mounted = false; records.after(host); screen.style.removeProperty('transform');
    screen.classList.remove('is-phone-visible', 'is-phone-interactive'); screen.inert = false; host.removeAttribute('aria-hidden');
  }
  function update(room, camera, width, height, progress, visible) {
    if (!visible || !room.phone) { hide(); return; }
    const phone = room.phone;
    camera.updateMatrixWorld(true); room.group.updateMatrixWorld(true);
    const center = phone.object.getWorldPosition(new THREE.Vector3());
    const rotation = phone.object.getWorldQuaternion(new THREE.Quaternion());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
    if (normal.dot(camera.position.clone().sub(center)) <= 0) { hide(); return; }
    const local = [[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]];
    const points = local.map(([x,y]) => phone.object.localToWorld(new THREE.Vector3(x * phone.width, y * phone.height, 0)).project(camera));
    if (points.some(point => point.z <= -1 || point.z >= 1) || points.every(point => point.x < -1) || points.every(point => point.x > 1) || points.every(point => point.y < -1) || points.every(point => point.y > 1)) { hide(); return; }
    // HTML must never paint through a page, lamp, or other foreground object.
    for (const [x,y] of [[0,0],[-.34,.34],[.34,.34],[.34,-.34],[-.34,-.34]]) {
      const point = phone.object.localToWorld(new THREE.Vector3(x * phone.width, y * phone.height, 0));
      ray.set(camera.position, point.sub(camera.position).normalize());
      if (ray.intersectObject(room.group, true)[0]?.object !== phone.object) { hide(); return; }
    }
    const quad = points.map(point => ({ x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 }));
    const matrix = phoneTransform(quad, 360, 780);
    if (!matrix) { hide(); return; }
    screen.style.transform = `matrix3d(${matrix.join(',')})`; screen.classList.add('is-phone-visible');
    const interactive = progress >= .90;
    screen.classList.toggle('is-phone-interactive', interactive); screen.inert = !interactive;
    host.setAttribute('aria-hidden', String(!interactive));
  }
  return { mount, reset, update, hide };
}
