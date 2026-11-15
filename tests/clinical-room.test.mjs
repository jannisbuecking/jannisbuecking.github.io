import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { monitorCaptureFrame } from '../clinical-snapshot.js';
import { createClinicalRoom, clipboardPagePose, PAGE_LENGTH, BINDING_HEIGHT, BINDING_Y, READING_STOPS, PAGE_TURN_STARTS, PAGE_TURN_DURATION, CLINICAL_FRACTION, CLINICAL_SCROLL_LENGTH, clinicalScrollOffset, clinicalScrollProgress } from '../previews/clinical-room-model.js';

test('clipboard scrolling takes 25 percent less distance without speeding up the room or phone', () => {
  const distance = progress => clinicalScrollOffset(progress) * CLINICAL_SCROLL_LENGTH;
  for (let progress = 0; progress <= 1; progress += .001) {
    assert.ok(Math.abs(clinicalScrollProgress(clinicalScrollOffset(progress)) - progress) < 1e-12, 'scroll positions and deep links round-trip without jumps');
  }
  for (let index = 1; index < READING_STOPS.length; index++) {
    const from = READING_STOPS[index - 1] * CLINICAL_FRACTION, to = READING_STOPS[index] * CLINICAL_FRACTION;
    assert.ok(Math.abs((distance(to) - distance(from)) / (to - from) - .75) < 1e-12);
  }
  assert.ok(Math.abs((distance(.3) - distance(.1)) / .2 - 1) < 1e-12);
  assert.ok(Math.abs((distance(.99) - distance(.8)) / .19 - 1) < 1e-12);
  assert.equal(clinicalScrollProgress(0), 0);
  assert.equal(clinicalScrollProgress(1), 1);
});

test('table aprons sit below and inside the worktops without overlapping side faces', () => {
  for (const variant of ['consultation', 'laboratory']) {
    const room = createClinicalRoom(variant);
    try {
      const tops = room.group.getObjectsByProperty('name', 'worktop');
      const aprons = room.group.getObjectsByProperty('name', 'table-apron');
      assert.equal(aprons.length, tops.length);
      tops.forEach((top, index) => {
        const surface = new THREE.Box3().setFromObject(top), apron = new THREE.Box3().setFromObject(aprons[index]);
        assert.ok(apron.max.y <= surface.min.y + 1e-9, 'the table layers do not intersect');
        assert.ok(apron.min.x > surface.min.x && apron.max.x < surface.max.x && apron.min.z > surface.min.z && apron.max.z < surface.max.z, 'the side faces cannot occupy the same planes');
      });
    } finally { room.dispose(); }
  }
});

test('Clinic uses one clipboard that fits the desk, with bound pages that turn in both directions', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    const board = room.clipboard.object, phone = room.phone.group;
    assert.equal(room.pages.length, 5);
    assert.ok(room.readings.every(reading => reading.object === board));
    const desk = new THREE.Box3().setFromObject(room.group.getObjectByName('worktop'));
    const bounds = new THREE.Box3().setFromObject(board);
    assert.ok(bounds.min.x > desk.min.x && bounds.max.x < desk.max.x && bounds.min.z > desk.min.z && bounds.max.z < desk.max.z);
    assert.ok(Math.abs(bounds.min.y - desk.max.y) < 1e-5, 'the clipboard rests on the tabletop');
    assert.ok(room.entrance.object.getWorldPosition(new THREE.Vector3()).x < board.position.x && board.position.x < phone.position.x, 'computer, clipboard, phone are ordered left to right');
    const anchors = room.pages.map(page => page.paper.localToWorld(new THREE.Vector3(0, .67, 0)));
    const fixed = board.matrix.clone();
    for (const progress of [0, ...READING_STOPS, ...READING_STOPS.toReversed(), 0]) {
      room.update(progress * .78); room.group.updateMatrixWorld(true);
      assert.ok(board.matrix.equals(fixed));
      room.pages.forEach((page, index) => assert.ok(page.paper.localToWorld(new THREE.Vector3(0, .67, 0)).distanceTo(anchors[index]) < 1e-6, 'the turning sheet stays attached to the clip'));
    }
    READING_STOPS.forEach((progress, index) => {
      room.update(progress * .78);
      assert.equal(room.clipboard.activePage, index);
      assert.ok(room.pages.every(page => page.hinge.visible && page.back.material.opacity === 1));
      assert.equal(room.pages.findIndex(page => page.turn === 0), index);
    });
    room.update(READING_STOPS[0] * .78); assert.equal(room.clipboard.activePage, 0);
    assert.ok(room.pages[0].hinge.visible);
  } finally { room.dispose(); }
});

test('sheets clear the board, stay bound, and land flat on a visible rear stack', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    const board = room.clipboard.object;
    const desk = new THREE.Box3().setFromObject(room.group.getObjectByName('worktop'));
    assert.equal(board.getObjectsByProperty('name', 'raised-binding-ring').length, 2);
    const cameraPose = room.pose(.56 * .78, 1.54);
    for (const turningIndex of PAGE_TURN_STARTS.keys()) for (let step = 0; step <= 100; step++) {
      const turn = step / 100;
      room.update((PAGE_TURN_STARTS[turningIndex] + turn * PAGE_TURN_DURATION) * .78); room.group.updateMatrixWorld(true);
      assert.ok(room.pages.every(page => page.hinge.visible && page.back.visible && page.back.material.opacity === 1));
      const pose = room.pose((PAGE_TURN_STARTS[turningIndex] + turn * PAGE_TURN_DURATION) * .78, 1.54);
      assert.ok(pose.position.distanceTo(cameraPose.position) < 1e-9 && pose.target.distanceTo(cameraPose.target) < 1e-9, 'the reading camera stays still during the turn');
      for (const index of room.pages.keys()) {
        const anchor = clipboardPagePose(turn, 0, 0, index);
        assert.ok(Math.abs(anchor.y - PAGE_LENGTH / 2) < 1e-9 && Math.abs(anchor.z) < 1e-9);
        for (const across of [-1, 0, 1]) for (let sample = 0; sample <= 100; sample++) {
          const along = sample / 100, point = clipboardPagePose(turn, along, across, index);
          const local = new THREE.Vector3(across * .495, BINDING_Y + point.y - PAGE_LENGTH / 2, BINDING_HEIGHT + point.z);
          if (Math.abs(local.y) <= .775) assert.ok(local.z > .055, 'the sheet clears the complete clipboard surface');
          const world = board.localToWorld(local.clone());
          assert.ok(world.y > desk.max.y + .005, 'paper never enters or drapes below the tabletop');
          assert.ok(world.x > desk.min.x && world.x < desk.max.x && world.z > desk.min.z && world.z < desk.max.z, 'the full sheet stays above its landing area');
          const next = clipboardPagePose(Math.min(1, turn + 1e-6), along, across, index);
          assert.ok(Math.hypot(point.y - next.y, point.z - next.z) < .00004, 'the sheet has no motion discontinuities');
        }
      }
      for (const aspect of [1512 / 982, 390 / 844]) {
        const view = room.pose((PAGE_TURN_STARTS[turningIndex] + turn * PAGE_TURN_DURATION) * .78, aspect), camera = new THREE.PerspectiveCamera(42, aspect, .05, 180);
        camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target); camera.updateMatrixWorld(true);
        for (const along of [0, .25, .5, .75, 1]) for (const across of [-1, 1]) {
          const point = clipboardPagePose(turn, along, across, turningIndex);
          const projected = board.localToWorld(new THREE.Vector3(across * .495, BINDING_Y + point.y - PAGE_LENGTH / 2, BINDING_HEIGHT + point.z)).project(camera);
          assert.ok(Math.abs(projected.x) < .98 && Math.abs(projected.y) < .94, 'the moving sheet stays visible in desktop and phone framing');
        }
        for (const along of [.08, .2, .5, .8, .98]) for (const across of [-.7, 0, .7]) {
          const point = clipboardPagePose(turn, along, across, turningIndex);
          const world = board.localToWorld(new THREE.Vector3(across * .495, BINDING_Y + point.y - PAGE_LENGTH / 2, BINDING_HEIGHT + point.z));
          const ray = new THREE.Raycaster(view.position, world.clone().sub(view.position).normalize());
          const hits = ray.intersectObject(room.group, true);
          assert.ok(hits.length && [room.pages[turningIndex].paper, room.pages[turningIndex].back].includes(hits[0].object), 'room fixtures cannot obscure the turning sheet or its landing stack');
        }
      }
    }
    for (const turn of [0, .2, .5, .8, 1]) {
      let length = 0, previous = clipboardPagePose(turn, 0);
      for (let sample = 1; sample <= 1000; sample++) {
        const point = clipboardPagePose(turn, sample / 1000);
        length += Math.hypot(point.y - previous.y, point.z - previous.z); previous = point;
      }
      assert.ok(Math.abs(length - PAGE_LENGTH) < .0003, 'curling preserves the physical sheet length');
    }
    for (const index of PAGE_TURN_STARTS.keys()) {
      const a = clipboardPagePose(1, .7, 0, index), b = clipboardPagePose(1, 1, 0, index);
      assert.ok(Math.abs(a.z - b.z) < 1e-9, 'finished sheets rest flat behind the binding');
      assert.ok(BINDING_Y + a.y - PAGE_LENGTH / 2 > .775, 'the stack is behind the clipboard');
    }
    room.update(.74 * .78); const folded = room.pages[0].geometry.attributes.position.array.slice();
    room.update(.56 * .78); room.update(.74 * .78);
    assert.deepEqual(room.pages[0].geometry.attributes.position.array, folded, 'reversing the turn restores the same geometry');
  } finally { room.dispose(); }
});

test('the Clinic overview stays fourteen percent closer while keeping the desktop items in frame', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    for (const aspect of [1.104, 342 / 844]) {
      const view = room.pose(.36 * .78, aspect);
      const previousDistance = new THREE.Vector3(11, 7.8, 13).length() * Math.max(1, 1.35 / aspect);
      assert.ok(Math.abs(view.position.distanceTo(view.target) / previousDistance - .86) < 1e-9);
      const camera = new THREE.PerspectiveCamera(42, aspect, .003, 180);
      camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target); camera.updateMatrixWorld(true);
      for (const object of [room.entrance.object, room.clipboard.object, room.phone.object]) {
        const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
        assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && point.z > -1 && point.z < 1);
      }
    }
  } finally { room.dispose(); }
});

for (const variant of ['laboratory', 'consultation']) {
  test(`${variant}: optical entry and clinical pages are unobstructed and fit desktop/mobile cameras`, () => {
    const room = createClinicalRoom(variant);
    try {
      assert.equal(room.readings.length, 5);
      const camera = new THREE.PerspectiveCamera(42, 1, .003, 180), ray = new THREE.Raycaster();
      function setCamera(progress, aspect) {
        const view = room.pose(progress, aspect);
        camera.aspect = aspect; camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target);
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); room.update(progress); room.group.updateMatrixWorld(true);
        return view;
      }
      for (const aspect of [1.44, 390 / 844]) {
        const source = setCamera(0, aspect);
        ray.set(source.position, source.target.clone().sub(source.position).normalize());
        assert.equal(ray.intersectObject(room.group, true)[0].object, room.entrance.object, 'the first view reaches the actual optical/screen image');
        READING_STOPS.forEach((progress, index) => {
          const view = setCamera(progress, aspect), item = room.readings[index];
          const paperCenter = item.paper.getWorldPosition(new THREE.Vector3());
          ray.set(view.position, paperCenter.clone().sub(view.position).normalize());
          assert.equal(ray.intersectObject(room.group, true)[0].object, item.paper, 'the record stays readable on the clipboard');
          for (const x of [-item.width / 2, item.width / 2]) for (const y of [-item.height / 2, item.height / 2]) {
            const point = item.object.localToWorld(new THREE.Vector3(x, y, .07)).project(camera);
            assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && point.z > -1 && point.z < 1, 'the whole record fits inside the viewport');
          }
        });
      }
    } finally { room.dispose(); }
  });
  test(`${variant}: scrolling and reversing move the camera and clipboard pages, never the furniture or clipboard`, () => {
    const room = createClinicalRoom(variant);
    try {
      const original = room.readings.map(item => item.object.matrix.clone());
      const entrance = room.entrance.object.matrixWorld.clone();
      for (const progress of [0, .34, .56, .74, .92, .74, .56, .34, 0]) {
        room.update(progress); room.group.updateMatrixWorld(true);
        room.readings.forEach((item, index) => assert.ok(item.object.matrix.equals(original[index])));
        assert.ok(room.entrance.object.matrixWorld.equals(entrance));
        const view = room.pose(progress, 1.44);
        assert.ok(view.position.distanceTo(view.target) > .01);
        assert.ok(Math.abs(view.up.length() - 1) < 1e-9);
      }
      room.pages.forEach(page => assert.ok(Math.abs(page.hinge.rotation.x) < 1e-12));
    } finally { room.dispose(); }
  });
}

test('wide monitor capture preserves the outgoing viewport crop on portrait and desktop screens', () => {
  const room = createClinicalRoom('consultation', undefined, { matchEntrance: true });
  try {
    for (const aspect of [1.104, 342 / 844, 390 / 844, 430 / 932, 414 / 718, 1.8, 2.3]) {
      const view = room.pose(0, aspect), camera = new THREE.PerspectiveCamera(42, aspect, .01, 180);
      camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target); camera.updateMatrixWorld(true);
      const width = aspect * 844, height = 844;
      const frame = monitorCaptureFrame(width, height, room.entrance.width / room.entrance.height);
      assert.ok(Math.abs(frame.width / frame.height - room.entrance.width / room.entrance.height) < 1e-12, 'the expanded scene fills the monitor without pillarboxing');
      assert.ok(frame.left <= 0 && frame.top <= 0 && frame.left + frame.width >= width && frame.top + frame.height >= height);
      for (const x of [0, width]) for (const y of [0, height]) {
        const monitorX = ((x - frame.left) / frame.width - .5) * room.entrance.width;
        const monitorY = (.5 - (y - frame.top) / frame.height) * room.entrance.height;
        const point = room.entrance.object.localToWorld(new THREE.Vector3(monitorX, monitorY, 0)).project(camera);
        assert.ok(Math.abs(point.x - (x ? 1 : -1)) < 1e-9 && Math.abs(point.y - (y ? -1 : 1)) < 1e-9, 'the central crop matches the outgoing view without shifting or stretching');
      }
    }
  } finally { room.dispose(); }
});
