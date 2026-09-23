import * as THREE from 'three';
import { ProceduralTextures } from '../game/TextureFactory';
import type { DestructibleBarricade, RappelWall, ColliderAABB } from '../game/HouseMap';

export interface BuiltMap {
  colliders: ColliderAABB[];
  barricades: DestructibleBarricade[];
  rappelWalls: RappelWall[];
  objectivePos: THREE.Vector3;
  spawnsAtk: [number, number][];
  spawnsDef: [number, number][];
  animatedLights: THREE.PointLight[];
}

// Shared helper: a solid box wall/prop that also registers a collider.
function addWall(
  scene: THREE.Scene,
  colliders: ColliderAABB[],
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  mat: THREE.Material,
  addCol = true,
  name?: string
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (addCol) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2, h: y + h, name });
  }
  return mesh;
}

// Decoration has no ColliderAABB: visual detail must not change tactical routing.
function addVisualBox(scene: THREE.Scene, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addCeilingLight(scene: THREE.Scene, x: number, y: number, z: number, color: number, intensity = 1.2) {
  const fixture = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, .08, 12), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: .65, roughness: .3 }));
  fixture.position.set(x, y, z); scene.add(fixture);
  const light = new THREE.PointLight(color, intensity, 11, 2); light.position.set(x, y - .12, z); scene.add(light);
  return light;
}

// Shared helper: a breachable barricade (roll-up door, plywood window, etc.)
function addBarricade(
  scene: THREE.Scene,
  colliders: ColliderAABB[],
  barricades: DestructibleBarricade[],
  id: string, x: number, y: number, z: number, w: number, h: number,
  isWindow: boolean, normal: THREE.Vector3, floorNum: number, hp = 120
) {
  const group = new THREE.Group();
  group.position.set(x, y + h / 2, z);
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x6b5540, roughness: 0.85 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
  const isXAxis = Math.abs(normal.x) > 0.5;

  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.14), frameMat);
  frameTop.position.set(0, h / 2 - 0.06, 0);
  group.add(frameTop);

  const bottomGap = isWindow ? 0.0 : 0.30;
  const numPlanks = Math.max(1, Math.floor((h - bottomGap) / 0.24));
  for (let i = 0; i < numPlanks; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.2, 0.05), plankMat);
    plank.position.set(0, -h / 2 + bottomGap + 0.12 + i * 0.24, (i % 2 === 0 ? 0.015 : -0.015));
    plank.castShadow = true;
    group.add(plank);
  }
  if (isXAxis) group.rotation.y = Math.PI / 2;
  scene.add(group);

  const barricade: DestructibleBarricade = {
    id, mesh: group, position: new THREE.Vector3(x, y + h / 2, z),
    width: w, height: h, isBreached: false, hp, normal, isWindow, floor: floorNum
  };
  barricades.push(barricade);

  colliders.push({
    minX: isXAxis ? x - 0.15 : x - w / 2,
    maxX: isXAxis ? x + 0.15 : x + w / 2,
    minY: isWindow ? y : y + 0.30,
    maxY: y + h,
    minZ: isXAxis ? z - w / 2 : z - 0.15,
    maxZ: isXAxis ? z + w / 2 : z + 0.15,
    h: y + h,
    name: id
  });
  return barricade;
}

function addSoftWall(
  scene: THREE.Scene,
  colliders: ColliderAABB[],
  barricades: DestructibleBarricade[],
  id: string,
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  normal: THREE.Vector3,
  floorNum: number,
  hexColor = 0xece5d8
) {
  const group = new THREE.Group();
  group.position.set(x, y + h / 2, z);

  const isXAxis = Math.abs(normal.x) > 0.5;
  const wallTex = ProceduralTextures.createSoftWallDrywallTexture(hexColor, Math.max(1, Math.round((isXAxis ? d : w) / 1.5)), 2);
  const drywallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.9,
    metalness: 0.05
  });
  const studMat = new THREE.MeshStandardMaterial({ color: 0x825b39, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.7 });

  const drywall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), drywallMat);
  drywall.castShadow = true;
  drywall.receiveShadow = true;
  group.add(drywall);

  const trimB = new THREE.Mesh(new THREE.BoxGeometry(w + (isXAxis ? 0.02 : 0), 0.14, d + (isXAxis ? 0 : 0.02)), trimMat);
  trimB.position.set(0, -h / 2 + 0.07, 0);
  group.add(trimB);

  const studSpan = isXAxis ? d : w;
  const numStuds = Math.max(2, Math.floor(studSpan / 0.8));
  for (let i = 0; i < numStuds; i++) {
    const offset = -studSpan / 2 + (i + 0.5) * (studSpan / numStuds);
    const stud = new THREE.Mesh(
      isXAxis ? new THREE.BoxGeometry(w * 0.7, h * 0.96, 0.08) : new THREE.BoxGeometry(0.08, h * 0.96, d * 0.7),
      studMat
    );
    if (isXAxis) stud.position.set(0, 0, offset);
    else stud.position.set(offset, 0, 0);
    group.add(stud);
  }

  scene.add(group);

  const barricade: DestructibleBarricade = {
    id,
    mesh: group,
    position: new THREE.Vector3(x, y + h / 2, z),
    width: isXAxis ? d : w,
    height: h,
    depth: isXAxis ? w : d,
    isBreached: false,
    hp: 85,
    normal,
    isWindow: false,
    floor: floorNum,
    isSoftWall: true,
    isReinforced: false,
    label: 'Soft Wall'
  };
  barricades.push(barricade);

  colliders.push({
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: y,
    maxY: y + h,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    h: y + h,
    name: id
  });

  return barricade;
}

// Builds a straight exterior wall as real segments with true gaps wherever a door/window
// sits in it. A continuous solid box with a barricade merely drawn on top of it does NOT
// actually open when breached — the barricade's own collider is separate and much smaller
// than the wall's, so the wall behind it stays solid forever. This is how the original
// house map's exterior walls are built; the newer maps need the same treatment.
function addWallWithOpenings(
  scene: THREE.Scene, colliders: ColliderAABB[],
  axis: 'x' | 'z',
  fixedCoord: number,
  center: number, length: number,
  y: number, h: number, thickness: number,
  mat: THREE.Material,
  openings: { at: number; width: number; sillH?: number; openH?: number }[],
  namePrefix: string
) {
  const start = center - length / 2;
  const end = center + length / 2;
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  let cursor = start;
  let seg = 0;
  const buildSeg = (segCenter: number, segLen: number, segY: number, segH: number, suffix: string) => {
    if (segLen <= 0.01 || segH <= 0.01) return;
    if (axis === 'x') addWall(scene, colliders, segCenter, segY, fixedCoord, segLen, segH, thickness, mat, true, `${namePrefix}_${suffix}`);
    else addWall(scene, colliders, fixedCoord, segY, segCenter, thickness, segH, segLen, mat, true, `${namePrefix}_${suffix}`);
  };
  for (const op of sorted) {
    const opStart = op.at - op.width / 2;
    const opEnd = op.at + op.width / 2;
    // Wall segment before this opening (full height)
    if (opStart > cursor) buildSeg(cursor + (opStart - cursor) / 2, opStart - cursor, y, h, `seg${seg++}`);
    // Sill: solid wall below a window opening that doesn't start at the floor.
    const sillH = op.sillH ?? 0;
    if (sillH > 0) buildSeg(op.at, op.width, y, sillH, `sill${seg}`);
    // Header: solid wall above the opening, if it doesn't reach the full wall height.
    const openH = op.openH ?? (h - sillH);
    const headH = h - sillH - openH;
    if (headH > 0.01) buildSeg(op.at, op.width, y + sillH + openH, headH, `head${seg}`);
    cursor = Math.max(cursor, opEnd);
  }
  if (cursor < end) buildSeg(cursor + (end - cursor) / 2, end - cursor, y, h, `seg${seg++}`);
}

// -------------------------------------------------------------------------
// SHARED EXTERIOR DRESSING — grass grounds, trees, and a parking lot with
// cars. Every map below builds its interior on a small paved footprint but
// previously left the rest of the compound as either bare asphalt or, on
// Harbor Villa, nothing at all past the building walls (spawns sat over an
// empty void). These helpers give every map real, walkable ground out to
// its spawn points, plus greenery and a lot so the exterior isn't dead air.
// -------------------------------------------------------------------------

// Big grass field under/around the paved building footprint. Placed at a hair
// below y=0 so it never z-fights with the paved lot/plaza planes on top of it.
function addGrassGrounds(scene: THREE.Scene, size = 200) {
  const grassTex = ProceduralTextures.createGrassTexture(size / 6, size / 6);
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(size, size), grassMat);
  field.rotation.x = -Math.PI / 2;
  field.position.y = -0.03;
  field.receiveShadow = true;
  scene.add(field);
  return field;
}

// A single low-poly, non-branded car. Registers a collider so it doubles as
// cover, the way a parked car would in a real tactical map.
function addSimpleCar(scene: THREE.Scene, colliders: ColliderAABB[], x: number, z: number, rotY: number, color: number, idx: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.2, metalness: 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff7e0 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 4.1), bodyMat);
  body.position.set(0, 0.5, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 2.1), glassMat);
  cabin.position.set(0, 0.98, -0.15);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 10);
  const wheelOffsets: [number, number][] = [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]];
  for (const [wx, wz] of wheelOffsets) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.32, wz);
    group.add(wheel);
  }

  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), lightMat);
  headlightL.position.set(-0.6, 0.5, 2.03);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.6;
  group.add(headlightL, headlightR);

  scene.add(group);
  colliders.push({
    minX: x - 2.1, maxX: x + 2.1,
    minY: 0, maxY: 1.25,
    minZ: z - 2.1, maxZ: z + 2.1,
    h: 1.25,
    name: `parked_car_${idx}`
  });
  return group;
}

// A paved parking lot: asphalt slab, painted stall stripes, and a handful of
// parked cars (with a couple of empty stalls left open for sightlines/cover
// variety). `angle` is the facing direction of the row (radians).
function addParkingLot(
  scene: THREE.Scene, colliders: ColliderAABB[],
  cx: number, cz: number, angle: number, stallCount: number,
  filledStalls: number[] = []
) {
  const roadTex = ProceduralTextures.createRoadAsphaltTexture(2, Math.max(2, Math.round(stallCount / 2)));
  const lotMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92 });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });

  const stallW = 2.6, lotDepth = 5.6;
  const lotWidth = stallW * stallCount;

  const lot = new THREE.Group();
  lot.position.set(cx, 0, cz);
  lot.rotation.y = angle;

  const pad = new THREE.Mesh(new THREE.PlaneGeometry(lotWidth + 1.5, lotDepth + 2), lotMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.005;
  pad.receiveShadow = true;
  lot.add(pad);

  for (let i = 0; i <= stallCount; i++) {
    const stripeX = -lotWidth / 2 + i * stallW;
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.12, lotDepth - 0.6), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(stripeX, 0.012, 0);
    lot.add(stripe);
  }

  scene.add(lot);

  const carColors = [0xb91c1c, 0x1d4ed8, 0x525252, 0xca8a04, 0x15803d, 0xe5e7eb];
  const carsToPlace = filledStalls.length > 0
    ? filledStalls
    : Array.from({ length: stallCount }, (_, i) => i).filter(i => i % 2 === 0);

  carsToPlace.forEach((stallIdx, n) => {
    if (stallIdx < 0 || stallIdx >= stallCount) return;
    const localX = -lotWidth / 2 + stallW * stallIdx + stallW / 2;
    const localZ = 0;
    // Rotate the local stall position by the lot's facing angle to get world coords.
    const worldX = cx + localX * Math.cos(angle) - localZ * Math.sin(angle);
    const worldZ = cz + localX * Math.sin(angle) + localZ * Math.cos(angle);
    addSimpleCar(scene, colliders, worldX, worldZ, angle, carColors[n % carColors.length], n);
  });

  return lot;
}

// Broad-leaf deciduous tree with a real collider, for temperate maps.
function addLeafyTree(scene: THREE.Scene, colliders: ColliderAABB[], tx: number, tz: number, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(tx, 0, tz);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * scale, 0.48 * scale, 3.4 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 })
  );
  trunk.position.set(0, 1.7 * scale, 0);
  trunk.castShadow = true;
  tree.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x244a1e, roughness: 0.85 });
  for (let l = 0; l < 3; l++) {
    const rad = (2.1 - l * 0.42) * scale;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(rad, 2.4 * scale, 7), foliageMat);
    leaves.position.set(0, (3.1 + l * 1.4) * scale, 0);
    leaves.castShadow = true;
    tree.add(leaves);
  }

  scene.add(tree);
  colliders.push({ minX: tx - 0.5 * scale, maxX: tx + 0.5 * scale, minY: 0, maxY: 5.8 * scale, minZ: tz - 0.5 * scale, maxZ: tz + 0.5 * scale, h: 5.8 * scale });
}

// -------------------------------------------------------------------------
// MAP: WAREHOUSE DISTRICT — single-floor open industrial layout.
// No upper floor, no rappel points; instead a wide-open shipping floor with
// container-stack cover lanes converging on a central vault cage. Totally
// different flow from the house maps: long sightlines, flanking routes.
// -------------------------------------------------------------------------
export function buildWarehouseDistrict(scene: THREE.Scene): BuiltMap {
  const colliders: ColliderAABB[] = [];
  const barricades: DestructibleBarricade[] = [];
  const rappelWalls: RappelWall[] = [];
  const animatedLights: THREE.PointLight[] = [];

  const concreteTex = ProceduralTextures.createConcreteTexture(10, 10);
  const roadTex = ProceduralTextures.createRoadAsphaltTexture(1, 8);

  const floorMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9, metalness: 0.1, color: 0x8a8f94 });
  const lotMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2f3844, roughness: 0.7, metalness: 0.4 });
  const trussMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5, metalness: 0.6 });
  const containerColors = [0xb91c1c, 0x1d4ed8, 0x15803d, 0xca8a04, 0x525252];

  // Exterior lot
  // Grass grounds fill the compound out past the paved lot, so the area around
  // spawns and the perimeter fence line isn't bare void or a single flat texture.
  addGrassGrounds(scene, 220);

  const lot = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), lotMat);
  lot.rotation.x = -Math.PI / 2;
  lot.receiveShadow = true;
  scene.add(lot);

  // Treeline along the compound edges, kept clear of the attacker approach lane and doorways.
  addLeafyTree(scene, colliders, -34, -30, 1.2);
  addLeafyTree(scene, colliders, 34, -30, 1.1);
  addLeafyTree(scene, colliders, -40, 6, 1.3);
  addLeafyTree(scene, colliders, 40, 10, 1.15);
  addLeafyTree(scene, colliders, -30, 34, 1.2);
  addLeafyTree(scene, colliders, 22, 34, 1.25);

  // Employee parking lot, off to the side of the attacker approach lane so it doesn't block spawns.
  addParkingLot(scene, colliders, 30, -22, -Math.PI / 2, 6, [0, 1, 3, 5]);

  // Loading-yard dumpsters + a low perimeter security wall section — extra exterior
  // cover/dressing so the compound outside the building isn't just empty asphalt.
  const dumpsterMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.8, metalness: 0.3 });
  const addDumpster = (x: number, z: number) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.5), dumpsterMat);
    d.position.set(x, 0.65, z);
    d.castShadow = true; d.receiveShadow = true;
    scene.add(d);
    colliders.push({ minX: x - 1.1, maxX: x + 1.1, minY: 0, maxY: 1.3, minZ: z - 0.75, maxZ: z + 0.75, h: 1.3, name: 'dumpster' });
  };
  addDumpster(-20, -20);
  addDumpster(-17.5, -20);

  const checkpointMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.6 });
  const checkpoint = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.1, 2.0), checkpointMat);
  checkpoint.position.set(0, 1.05, -30);
  checkpoint.castShadow = true; checkpoint.receiveShadow = true;
  scene.add(checkpoint);
  colliders.push({ minX: -1, maxX: 1, minY: 0, maxY: 2.1, minZ: -31, maxZ: -29, h: 2.1, name: 'checkpoint_booth' });

  // Building footprint: 44 x 30, single floor, height 7
  const BW = 44, BD = 30, H = 7;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // Roof (flat, high, mostly for skybox occlusion — leaves room for tall interior cover)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.3, BD), wallMat);
  roof.position.set(0, H, 0);
  scene.add(roof);

  const hazardTex = ProceduralTextures.createHazardTapeTexture();
  const officeFloorTex = ProceduralTextures.createTileTexture(4, 4);
  const officeFloorMat = new THREE.MeshStandardMaterial({ map: officeFloorTex, roughness: 0.6 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.8 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.6, metalness: 0.3 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.4 });
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.6 });

  // Perimeter walls — each side is built as real segments with true gaps at every
  // door/window, so breaching one actually opens a path (see addWallWithOpenings above).
  addWallWithOpenings(scene, colliders, 'x', -BD / 2, 0, BW, 0, H, 0.4, wallMat,
    [{ at: -12, width: 5.5, sillH: 0, openH: 5.0 }, { at: 12, width: 5.5, sillH: 0, openH: 5.0 }], 'ext_south');
  addWallWithOpenings(scene, colliders, 'z', -BW / 2, 0, BD, 0, H, 0.4, wallMat,
    [{ at: 4, width: 3.0, sillH: 1.0, openH: 2.2 }], 'ext_west');
  addWallWithOpenings(scene, colliders, 'z', BW / 2, 0, BD, 0, H, 0.4, wallMat,
    [{ at: 4, width: 3.0, sillH: 1.0, openH: 2.2 }], 'ext_east');
  addWallWithOpenings(scene, colliders, 'x', BD / 2, 0, BW, 0, H, 0.4, wallMat,
    [{ at: 6, width: 3.0, sillH: 0, openH: 3.2 }], 'ext_north');

  addBarricade(scene, colliders, barricades, 'door_rollup_west', -12, 0, -BD / 2, 5.5, 5.0, false, new THREE.Vector3(0, 0, -1), 0, 160);
  addBarricade(scene, colliders, barricades, 'door_rollup_east', 12, 0, -BD / 2, 5.5, 5.0, false, new THREE.Vector3(0, 0, -1), 0, 160);
  addBarricade(scene, colliders, barricades, 'win_west_side', -BW / 2, 1.0, 4, 3.0, 2.2, true, new THREE.Vector3(-1, 0, 0), 0, 60);
  addBarricade(scene, colliders, barricades, 'win_east_side', BW / 2, 1.0, 4, 3.0, 2.2, true, new THREE.Vector3(1, 0, 0), 0, 60);
  addBarricade(scene, colliders, barricades, 'door_north_office', 6, 0, BD / 2, 3.0, 3.2, false, new THREE.Vector3(0, 0, 1), 0, 120);

  // Back-office annex behind the north door — previously that door led to nothing but
  // open exterior lot, which didn't make sense for a "north office door". Now it's a
  // real small room, plus a side window for an extra flanking approach into it.
  const annexX0 = 1.5, annexX1 = 10.5, annexZ0 = BD / 2, annexZ1 = BD / 2 + 6, annexH = 3.4;
  addWall(scene, colliders, (annexX0 + annexX1) / 2, 0, annexZ1, annexX1 - annexX0, annexH, 0.3, wallMat, true, 'annex_back');
  addWallWithOpenings(scene, colliders, 'z', annexX1, (annexZ0 + annexZ1) / 2, annexZ1 - annexZ0, 0, annexH, 0.3, wallMat,
    [{ at: annexZ0 + 3, width: 2.4, sillH: 1.0, openH: 1.8 }], 'annex_side_e');
  addWall(scene, colliders, annexX0, 0, (annexZ0 + annexZ1) / 2, 0.3, annexH, annexZ1 - annexZ0, wallMat, true, 'annex_side_w');
  addWall(scene, colliders, (annexX0 + annexX1) / 2, annexH, (annexZ0 + annexZ1) / 2, annexX1 - annexX0, 0.25, annexZ1 - annexZ0, wallMat, false);
  addBarricade(scene, colliders, barricades, 'annex_window', annexX1, 1.0, annexZ0 + 3, 2.4, 1.8, true, new THREE.Vector3(1, 0, 0), 0, 55);
  const annexFloor = new THREE.Mesh(new THREE.PlaneGeometry(annexX1 - annexX0, annexZ1 - annexZ0), officeFloorMat);
  annexFloor.rotation.x = -Math.PI / 2;
  annexFloor.position.set((annexX0 + annexX1) / 2, 0.02, (annexZ0 + annexZ1) / 2);
  annexFloor.receiveShadow = true;
  scene.add(annexFloor);
  addVisualBox(scene, annexX0 + 1.5, 0, annexZ0 + 4.5, 1.6, 0.8, 0.7, deskMat);
  addVisualBox(scene, annexX1 - 1.2, 0, annexZ0 + 1.2, 0.7, 1.4, 0.5, new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7 }));
  addCeilingLight(scene, (annexX0 + annexX1) / 2, annexH - 0.15, (annexZ0 + annexZ1) / 2, 0xfff2cc, 1.3);

  // Roof trusses purely visual
  for (let x = -BW / 2 + 4; x <= BW / 2 - 4; x += 8) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, BD - 2), trussMat);
    truss.position.set(x, H - 0.6, 0);
    scene.add(truss);
  }

  // Shipping container stacks forming a cover-heavy maze around the vault
  const containerDims: [number, number, number][] = [
    [-14, -8, 0], [-14, 2, 0], [-6, -10, 90], [6, -10, 90], [14, -8, 0], [14, 2, 0],
    [-8, 8, 0], [8, 8, 0], [16, 10, 90]
  ];
  containerDims.forEach(([x, z, rotDeg], i) => {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.6, 2.4),
      new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.7, metalness: 0.3 })
    );
    c.rotation.y = (rotDeg * Math.PI) / 180;
    c.position.set(x, 1.3, z);
    c.castShadow = true;
    c.receiveShadow = true;
    scene.add(c);
    const w = rotDeg === 90 ? 2.4 : 6;
    const d = rotDeg === 90 ? 6 : 2.4;
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minY: 0, maxY: 2.6, minZ: z - d / 2, maxZ: z + d / 2, h: 2.6 });
  });

  // Loose pallet/crate/barrel clutter — smaller, varied cover to break up the container
  // maze's monotony and give some low-profile peek spots between the big stacks.
  const clutter: [number, number, 'crate' | 'barrel'][] = [
    [-18, -4, 'crate'], [-18, -2.4, 'crate'], [18, -4, 'crate'], [18, -2.4, 'crate'],
    [-2, -13, 'barrel'], [2.5, -13, 'barrel'], [-10, 12, 'barrel'], [10, 12, 'barrel'],
    [0, -6, 'crate'], [-4, 6, 'barrel'], [4, 6, 'barrel']
  ];
  clutter.forEach(([x, z, kind]) => {
    if (kind === 'crate') {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), crateMat);
      crate.position.set(x, 0.45, z);
      crate.rotation.y = Math.random() * Math.PI;
      crate.castShadow = true; crate.receiveShadow = true;
      scene.add(crate);
      colliders.push({ minX: x - 0.45, maxX: x + 0.45, minY: 0, maxY: 0.9, minZ: z - 0.45, maxZ: z + 0.45, h: 0.9 });
    } else {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 12), barrelMat);
      barrel.position.set(x, 0.5, z);
      barrel.castShadow = true; barrel.receiveShadow = true;
      scene.add(barrel);
      colliders.push({ minX: x - 0.35, maxX: x + 0.35, minY: 0, maxY: 1.0, minZ: z - 0.35, maxZ: z + 0.35, h: 1.0 });
    }
  });

  // Hazard floor striping around the vault — decorative only, no collider.
  const stripe = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.6, 4, 1), hazardMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.rotation.z = Math.PI / 4;
  stripe.position.set(0, 0.015, 0);
  scene.add(stripe);

  // West-wall mezzanine — a small overwatch deck reachable by a stair ramp, giving the
  // map some verticality instead of being completely flat. It's interior only (no
  // rooftop exit), so the map's "no rappel" design intent is unchanged.
  const MEZZ_Y = 3.0, MEZZ_X0 = -21, MEZZ_X1 = -15, MEZZ_Z0 = -8, MEZZ_Z1 = 8;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(MEZZ_X1 - MEZZ_X0, 0.2, MEZZ_Z1 - MEZZ_Z0), deckMat);

  // Security Office Destructible Soft Drywall Partitions (Defenders can reinforce!)
  addSoftWall(scene, colliders, barricades, 'soft_wh_office_front', 14, 0, 4, 0.25, 3.2, 6.0, new THREE.Vector3(-1, 0, 0), 0);
  addSoftWall(scene, colliders, barricades, 'soft_wh_office_side', 17, 0, 1, 6.0, 3.2, 0.25, new THREE.Vector3(0, 0, -1), 0);
  deck.position.set((MEZZ_X0 + MEZZ_X1) / 2, MEZZ_Y, (MEZZ_Z0 + MEZZ_Z1) / 2);
  deck.receiveShadow = true; deck.castShadow = true;
  scene.add(deck);
  // Guard rail along the deck's inner (east) edge
  const railMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.6 });
  addVisualBox(scene, MEZZ_X1, MEZZ_Y + 0.5, (MEZZ_Z0 + MEZZ_Z1) / 2, 0.08, 0.9, MEZZ_Z1 - MEZZ_Z0, railMat);
  // Stair ramp up the south end of the deck
  const rampSteps = 10, rampStepH = MEZZ_Y / rampSteps, rampStepD = (MEZZ_Z0 - (-11)) / rampSteps;
  for (let i = 0; i < rampSteps; i++) {
    const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(MEZZ_X1 - MEZZ_X0, rampStepH * (i + 1), rampStepD), deckMat);
    stepMesh.position.set((MEZZ_X0 + MEZZ_X1) / 2, (rampStepH * (i + 1)) / 2, -11 + i * rampStepD + rampStepD / 2);
    scene.add(stepMesh);
  }

  // Central vault cage — the objective — caged in chainlink-style bars
  const vaultMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6, roughness: 0.4 });
  const cageMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3, wireframe: true });
  const vaultBox = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), vaultMat);
  vaultBox.position.set(0, 0.8, 0);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.0, 4.5), cageMat);
  cage.position.set(0, 1.5, 0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  beacon.position.set(0, 2.0, 0);
  const beaconLight = new THREE.PointLight(0xf59e0b, 2.4, 10, 2);
  beaconLight.position.set(0, 2.2, 0);
  scene.add(vaultBox, cage, beacon, beaconLight);
  animatedLights.push(beaconLight);
  colliders.push({ minX: -1.1, maxX: 1.1, minY: 0, maxY: 1.6, minZ: -1.1, maxZ: 1.1, h: 1.6, name: 'warehouse_vault' });

  // Overhead sodium work-lights, plus a cooler task light over the mezzanine for contrast
  const lampCoords: [number, number][] = [[-16, -8], [16, -8], [-16, 8], [16, 8], [0, 0]];
  for (const [x, z] of lampCoords) {
    const light = new THREE.PointLight(0xffd9a0, 1.6, 20, 2);
    light.position.set(x, H - 1.0, z);
    scene.add(light);
  }
  const mezzLight = new THREE.PointLight(0x9fd8ff, 1.3, 14, 2);
  mezzLight.position.set((MEZZ_X0 + MEZZ_X1) / 2, MEZZ_Y + 2.0, (MEZZ_Z0 + MEZZ_Z1) / 2);
  scene.add(mezzLight);

  return {
    colliders,
    barricades,
    rappelWalls, // none — single storey, no rooftop entry on this map
    objectivePos: new THREE.Vector3(0, 0.4, 0),
    spawnsAtk: [
      [0, -28],    // South Main Gate
      [-26, 0],    // West Container Yard Flank
      [26, 0],     // East Security Gate
      [0, 28],     // North Loading Bay
      [-18, -22],  // South-West Approach
      [18, -22]    // South-East Approach
    ],
    spawnsDef: [
      [0, 2],      // Central Vault Cage Anchor
      [-10, 10],   // North-West Mezzanine Watch
      [10, 10],    // North-East Crane Platform
      [-8, -8],    // South-West Shipping Lane Roamer
      [8, -8],     // South-East Container Flanker
      [0, 14]      // North Loading Bay Ambush
    ],
    animatedLights
  };
}

// -------------------------------------------------------------------------
// MAP: OFFICE TOWER — two-floor corporate layout, different footprint,
// staircase position, and objective placement from the suburban house.
// Floor 1: open-plan cubicle bullpen + reception. Floor 2: executive
// boardroom (objective: the server closet / data vault behind it).
// -------------------------------------------------------------------------
export function buildOfficeTower(scene: THREE.Scene): BuiltMap {
  const colliders: ColliderAABB[] = [];
  const barricades: DestructibleBarricade[] = [];
  const rappelWalls: RappelWall[] = [];
  const animatedLights: THREE.PointLight[] = [];

  const tileTex = ProceduralTextures.createTileTexture(8, 8);
  const concreteTex = ProceduralTextures.createConcreteTexture(8, 8);
  const carpetTex = ProceduralTextures.createCarpetTexture();

  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.9, transmission: 0.7 });
  const facadeMat = new THREE.MeshStandardMaterial({ color: 0x2b3542, roughness: 0.4, metalness: 0.6 });
  const floor1Mat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.4, metalness: 0.15 });
  const floor2Mat = new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.85 });
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.6 });
  const plazaMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.85 });

  const F1_Y = 0, F2_Y = 4.4, H_WALL = 4.2;

  // Plaza / exterior ground
  // Grass grounds around the plaza — previously the concrete plaza was the only ground
  // texture out to the edge of the map, so nothing outside the building read as landscaped.
  addGrassGrounds(scene, 200);

  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.receiveShadow = true;
  scene.add(plaza);

  // Ornamental trees around the plaza edges, clear of the attacker approach and windows.
  addLeafyTree(scene, colliders, -24, -22, 1.1);
  addLeafyTree(scene, colliders, 24, -22, 1.15);
  addLeafyTree(scene, colliders, -28, 4, 1.2);
  addLeafyTree(scene, colliders, 28, 6, 1.1);
  addLeafyTree(scene, colliders, -18, 22, 1.2);
  addLeafyTree(scene, colliders, 18, 22, 1.15);

  // Visitor parking lot, set off to the side of the attacker spawn lane.
  addParkingLot(scene, colliders, -28, -20, Math.PI / 2, 6, [0, 2, 3, 5]);

  // Plaza street furniture — benches + a bike rack, so the open concrete plaza has a
  // little exterior dressing and low cover beyond just trees at the edges.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.7, metalness: 0.2 });
  const addBench = (x: number, z: number, rotY: number) => {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.rotation.y = rotY;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), benchMat);
    seat.position.set(0, 0.45, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.08), benchMat);
    back.position.set(0, 0.72, -0.21);
    seat.castShadow = true; back.castShadow = true;
    bench.add(seat, back);
    scene.add(bench);
    colliders.push({ minX: x - 0.9, maxX: x + 0.9, minY: 0, maxY: 0.5, minZ: z - 0.3, maxZ: z + 0.3, h: 0.5, name: 'bench' });
  };
  addBench(-14, -16, 0);
  addBench(14, -16, 0);

  const bikeRackMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.5, metalness: 0.6 });
  const bikeRack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.15), bikeRackMat);
  bikeRack.position.set(19, 0.35, -12);
  bikeRack.castShadow = true;
  scene.add(bikeRack);
  colliders.push({ minX: 17.8, maxX: 20.2, minY: 0, maxY: 0.7, minZ: -12.15, maxZ: -11.85, h: 0.7, name: 'bike_rack' });

  // Footprint: 30 x 26 rectangular tower, glass curtain wall facade
  const BW = 30, BD = 26;

  const gFloor = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), floor1Mat);
  gFloor.rotation.x = -Math.PI / 2;
  gFloor.position.set(0, 0.02, 0);
  gFloor.receiveShadow = true;
  scene.add(gFloor);

  const slab2 = addWall(scene, colliders, 0, F2_Y - 0.15, 0, BW, 0.3, BD, floor2Mat, false);
  slab2.receiveShadow = true;

  const roof = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.35, BD), facadeMat);
  roof.position.set(0, F2_Y + H_WALL, 0);
  scene.add(roof);

  const plantMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });
  const potMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 0.6, roughness: 0.3 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.5 });

  // Ground floor exterior curtain wall — real segments with true gaps at each door/window.
  addWallWithOpenings(scene, colliders, 'x', -BD / 2, 0, BW, F1_Y, H_WALL, 0.3, glassMat,
    [{ at: -3, width: 3.0, sillH: 0, openH: 3.0 }, { at: 8, width: 2.6, sillH: 0, openH: 3.0 }], 'g_south');
  addWallWithOpenings(scene, colliders, 'z', -BW / 2, 0, BD, F1_Y, H_WALL, 0.3, facadeMat,
    [{ at: -4, width: 2.6, sillH: 1.0, openH: 2.2 }], 'g_west');
  addWallWithOpenings(scene, colliders, 'z', BW / 2, 0, BD, F1_Y, H_WALL, 0.3, facadeMat,
    [{ at: 4, width: 2.6, sillH: 1.0, openH: 2.2 }], 'g_east');
  addWall(scene, colliders, 0, F1_Y, BD / 2, BW, H_WALL, 0.3, facadeMat, true, 'g_north');

  addWallWithOpenings(scene, colliders, 'x', -BD / 2, 0, BW, F2_Y, H_WALL, 0.3, facadeMat,
    [{ at: 0, width: 3.4, sillH: 1.2, openH: 2.4 }], 'f2_south');
  addWallWithOpenings(scene, colliders, 'z', -BW / 2, 0, BD, F2_Y, H_WALL, 0.3, facadeMat,
    [{ at: -6, width: 2.6, sillH: 1.2, openH: 2.2 }], 'f2_west');
  addWallWithOpenings(scene, colliders, 'z', BW / 2, 0, BD, F2_Y, H_WALL, 0.3, facadeMat,
    [{ at: 6, width: 2.6, sillH: 1.2, openH: 2.2 }], 'f2_east');
  addWall(scene, colliders, 0, F2_Y, BD / 2, BW, H_WALL, 0.3, facadeMat, true, 'f2_north');

  addBarricade(scene, colliders, barricades, 'door_lobby_main', -3, F1_Y, -BD / 2, 3.0, 3.0, false, new THREE.Vector3(0, 0, -1), 0, 100);
  addBarricade(scene, colliders, barricades, 'door_lobby_side', 8, F1_Y, -BD / 2, 2.6, 3.0, false, new THREE.Vector3(0, 0, -1), 0, 100);
  addBarricade(scene, colliders, barricades, 'win_g_west', -BW / 2, F1_Y + 1.0, -4, 2.6, 2.2, true, new THREE.Vector3(-1, 0, 0), 0, 60);
  addBarricade(scene, colliders, barricades, 'win_g_east', BW / 2, F1_Y + 1.0, 4, 2.6, 2.2, true, new THREE.Vector3(1, 0, 0), 0, 60);
  addBarricade(scene, colliders, barricades, 'win_2f_boardroom', 0, F2_Y + 1.2, -BD / 2, 3.4, 2.4, true, new THREE.Vector3(0, 0, -1), 1, 60);
  addBarricade(scene, colliders, barricades, 'win_2f_west', -BW / 2, F2_Y + 1.2, -6, 2.6, 2.2, true, new THREE.Vector3(-1, 0, 0), 1, 60);
  addBarricade(scene, colliders, barricades, 'win_2f_east', BW / 2, F2_Y + 1.2, 6, 2.6, 2.2, true, new THREE.Vector3(1, 0, 0), 1, 60);

  // Ground floor: reception desk, real desk-pod clusters with aisles (instead of a flat
  // uniform 15-box grid), a breakroom alcove, and an open glass meeting-room alcove.
  addWall(scene, colliders, 0, F1_Y, -9, 2.6, 1.1, 0.6, deskMat, true, 'reception_desk');
  addVisualBox(scene, 0, F1_Y, -9.35, 2.2, 0.3, 0.06, screenMat);
  addVisualBox(scene, -2.5, F1_Y, -10.5, 0.5, 0.9, 0.5, plantMat);
  addVisualBox(scene, 2.5, F1_Y, -10.5, 0.5, 1.0, 0.5, potMat);

  const podSpots: [number, number][] = [[-9, -2], [-9, 4], [0, -2], [0, 4], [7, -2], [7, 4]];
  podSpots.forEach(([cx, cz], i) => {
    addWall(scene, colliders, cx, F1_Y, cz, 2.0, 1.1, 1.5, wallMat, true, `pod_${i}`);
    addVisualBox(scene, cx - 0.5, F1_Y + 1.1, cz, 0.5, 0.35, 0.05, screenMat);
    addVisualBox(scene, cx + 0.5, F1_Y + 1.1, cz, 0.5, 0.35, 0.05, screenMat);
    addCeilingLight(scene, cx, H_WALL - 0.2, cz, 0xf5f5f4, 1.0);
  });

  // Breakroom alcove (open on two sides — no door needed, no risk of sealing anyone in)
  addWall(scene, colliders, 8, F1_Y, 8.5, 4.5, 1.4, 0.25, wallMat, true, 'breakroom_back');
  addWall(scene, colliders, 10.2, F1_Y, 6.5, 0.25, 1.4, 4.5, wallMat, true, 'breakroom_side');
  addVisualBox(scene, 7, F1_Y, 8.0, 2.2, 0.9, 0.6, counterMat);
  addVisualBox(scene, 9, F1_Y, 6.5, 1.0, 0.75, 1.0, deskMat);
  addCeilingLight(scene, 8.5, H_WALL - 0.2, 7.5, 0xfff2cc, 1.1);

  // Open glass meeting-room alcove, mirrored on the west side
  addWall(scene, colliders, -8, F1_Y, 8.5, 4.5, H_WALL - 0.2, 0.15, glassMat, true, 'meeting_back');
  addWall(scene, colliders, -10.2, F1_Y, 6.5, 0.15, H_WALL - 0.2, 4.5, glassMat, true, 'meeting_side');
  addVisualBox(scene, -8, F1_Y, 7.5, 2.6, 0.75, 1.2, deskMat);
  addCeilingLight(scene, -8.5, H_WALL - 0.2, 7.5, 0xf5f5f4, 1.1);

  addCeilingLight(scene, -3, H_WALL - 0.2, -9, 0xffffff, 1.2);

  // Staircase — placed on the east side, opposite the house's stair spot, to keep the flow distinct
  const steps = 14, stepH = H_WALL / steps, stepD = 0.36, stepW = 2.2;
  for (let i = 0; i < steps; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH * (i + 1), stepD), wallMat);
    step.position.set(11, F1_Y + (stepH * (i + 1)) / 2, -9 + i * stepD);
    scene.add(step);
  }
  // BUG FIX: this used to push a solid, full-height (F1_Y to F2_Y) collider box over the
  // exact same footprint as the stair ramp that getFloorHeight() already computes for
  // office_tower (see BreachProtocolEngine.ts). That made the entire staircase volume act
  // like a solid wall — collides() blocked the player from ever stepping onto it, so the
  // stairs were unusable. The suburban house's working staircase pushes no collider at all
  // for its stair footprint (its steps are climbed purely via getFloorHeight's ramp), so
  // this now matches that pattern instead of walling the stairs off.

  // 2F: Boardroom (long table) + Executive suite, with the data vault behind the boardroom
  const table = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.85, 2.0), deskMat);
  table.position.set(-2, F2_Y + 0.425, -6);
  table.castShadow = true;
  scene.add(table);
  colliders.push({ minX: -4.75, maxX: 0.75, minY: F2_Y, maxY: F2_Y + 0.85, minZ: -7, maxZ: -5, h: F2_Y + 0.85 });
  addCeilingLight(scene, -2, F2_Y + H_WALL - 0.2, -6, 0xffffff, 1.3);
  for (const cx of [-4, -0.5, 3]) addVisualBox(scene, cx, F2_Y, -7.6, 0.5, 0.85, 0.5, new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }));

  // Exec office wall now has a real doorway instead of sealing the room shut.
  addWallWithOpenings(scene, colliders, 'z', -9, -2, 8, F2_Y, H_WALL, 0.25, wallMat,
    [{ at: 0, width: 2.0, sillH: 0, openH: 2.4 }], 'exec_office_wall');
  addVisualBox(scene, -12, F2_Y, -4, 1.4, 0.75, 0.7, deskMat);
  addCeilingLight(scene, -11, F2_Y + H_WALL - 0.2, -3, 0xf5f5f4, 1.0);

  // Office & Server Vault Destructible Soft Drywall Partitions (Defenders can reinforce!)
  addSoftWall(scene, colliders, barricades, 'soft_office_server_front', 3, F2_Y, 2.5, 0.25, H_WALL, 4.0, new THREE.Vector3(-1, 0, 0), 1);
  addSoftWall(scene, colliders, barricades, 'soft_office_boardroom_partition', -6, F2_Y, 1.5, 6.0, H_WALL, 0.25, new THREE.Vector3(0, 0, 1), 1);
  addSoftWall(scene, colliders, barricades, 'soft_office_bullpen_divider', 4, F1_Y, 1.0, 0.25, H_WALL, 5.0, new THREE.Vector3(-1, 0, 0), 0);

  // Vault room wall now has a real doorway — previously a fully solid span, which meant a
  // defender who spawned inside the vault room could only ever leave by breaching their
  // own window, since there was no walkable way out.
  addWallWithOpenings(scene, colliders, 'x', 3, 6, 8, F2_Y, H_WALL, 0.25, wallMat,
    [{ at: 6.5, width: 2.0, sillH: 0, openH: 2.4 }], 'vault_room_wall');
  addCeilingLight(scene, 9, F2_Y + H_WALL - 0.2, 4, 0x9fd8ff, 1.0);

  // Data vault objective — small server closet behind the boardroom
  const vaultCabinet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 1.0), new THREE.MeshStandardMaterial({ color: 0xca8a04, metalness: 0.7, roughness: 0.3 }));
  vaultCabinet.position.set(9, F2_Y + 1.0, 8);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 12), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  core.position.set(9, F2_Y + 1.6, 8);
  const coreLight = new THREE.PointLight(0x22d3ee, 2.6, 9, 2);
  coreLight.position.set(9, F2_Y + 1.7, 8);
  scene.add(vaultCabinet, core, coreLight);
  animatedLights.push(coreLight);
  colliders.push({ minX: 8.2, maxX: 9.8, minY: F2_Y, maxY: F2_Y + 2.0, minZ: 7.2, maxZ: 8.8, h: F2_Y + 2.0, name: 'office_data_vault' });

  // Rooftop rappel access on all four sides (tall glass tower — classic vertical assault)
  rappelWalls.push(
    { id: 'r_south', minX: -BW / 2 + 2, maxX: BW / 2 - 2, minZ: -BD / 2 - 1.2, maxZ: -BD / 2 + 0.5, wallX: 0, wallZ: -BD / 2, normal: new THREE.Vector3(0, 0, -1), roofY: F2_Y + H_WALL, groundY: 0 },
    { id: 'r_north', minX: -BW / 2 + 2, maxX: BW / 2 - 2, minZ: BD / 2 - 0.5, maxZ: BD / 2 + 1.2, wallX: 0, wallZ: BD / 2, normal: new THREE.Vector3(0, 0, 1), roofY: F2_Y + H_WALL, groundY: 0 },
    { id: 'r_west', minX: -BW / 2 - 1.2, maxX: -BW / 2 + 0.5, minZ: -BD / 2 + 2, maxZ: BD / 2 - 2, wallX: -BW / 2, wallZ: 0, normal: new THREE.Vector3(-1, 0, 0), roofY: F2_Y + H_WALL, groundY: 0 },
    { id: 'r_east', minX: BW / 2 - 0.5, maxX: BW / 2 + 1.2, minZ: -BD / 2 + 2, maxZ: BD / 2 - 2, wallX: BW / 2, wallZ: 0, normal: new THREE.Vector3(1, 0, 0), roofY: F2_Y + H_WALL, groundY: 0 }
  );

  return {
    colliders,
    barricades,
    rappelWalls,
    objectivePos: new THREE.Vector3(9, F2_Y + 0.3, 8),
    spawnsAtk: [
      [0, -26],    // South Main Plaza Entry
      [24, 0],     // East Multi-level Parking Deck
      [-24, 0],    // West Street Service Alley
      [0, 26],     // North Courtyard Garden
      [-16, -20],  // South-West Boulevard
      [16, -20]    // South-East Boulevard
    ],
    spawnsDef: [
      [9, 9],      // 2F Executive Server Vault Anchor
      [6, 5],      // 2F Boardroom Watch
      [-6, 6],     // 2F West Corner Office Lurk
      [-2, -6],    // 1F Reception Desk Guard
      [-9, -3],    // 1F Cubicle Bullpen Roamer
      [3, -8]      // 1F Main Lobby Flanker
    ],
    animatedLights
  };
}
