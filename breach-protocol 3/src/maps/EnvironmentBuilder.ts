import * as THREE from 'three';

export class EnvironmentBuilder {
  private scene: THREE.Scene;
  private currentRoot: THREE.Group | null = null;

  // Materials
  private matAsphalt: THREE.MeshStandardMaterial;
  private matSidewalk: THREE.MeshStandardMaterial;
  private matRoadStripe: THREE.MeshBasicMaterial;
  private matFloorTile: THREE.MeshStandardMaterial;
  private matServerRack: THREE.MeshStandardMaterial;
  private matServerLights: THREE.MeshBasicMaterial;
  private matDesk: THREE.MeshStandardMaterial;
  private matMonitor: THREE.MeshStandardMaterial;
  private matScreen: THREE.MeshBasicMaterial;
  private matFence: THREE.MeshStandardMaterial;
  private matDumpster: THREE.MeshStandardMaterial;
  private matCrate: THREE.MeshStandardMaterial;
  private matBarrier: THREE.MeshStandardMaterial;
  private matVent: THREE.MeshStandardMaterial;
  private matCeiling: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.matAsphalt = new THREE.MeshStandardMaterial({ color: 0x1f242a, roughness: 0.95 });
    this.matSidewalk = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.85 });
    this.matRoadStripe = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    this.matFloorTile = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, metalness: 0.1 });
    this.matServerRack = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.7 });
    this.matServerLights = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.matDesk = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 });
    this.matMonitor = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
    this.matScreen = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.matFence = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.6, metalness: 0.8, wireframe: true });
    this.matDumpster = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7, metalness: 0.3 });
    this.matCrate = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    this.matBarrier = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
    this.matVent = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
    this.matCeiling = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
  }

  public buildExteriorAndInterior(compoundSize: number = 90) {
    if (this.currentRoot) {
      this.scene.remove(this.currentRoot);
      this.currentRoot = null;
    }

    const root = new THREE.Group();

    // 1. TERRAIN & GROUND
    const terrainGeo = new THREE.PlaneGeometry(compoundSize, compoundSize);
    const terrain = new THREE.Mesh(terrainGeo, this.matAsphalt);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = 0;
    terrain.receiveShadow = true;
    root.add(terrain);

    // 2. PARKING LOT STRIPES & ROADS
    for (let z = -35; z <= -24; z += 3.2) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5.5), this.matRoadStripe);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-26, 0.01, z);
      root.add(stripe);
    }
    // East side loading dock lines
    for (let z = -12; z <= 12; z += 5) {
      const yellowLine = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 8), this.matRoadStripe);
      yellowLine.rotation.x = -Math.PI / 2;
      yellowLine.position.set(24, 0.01, z);
      root.add(yellowLine);
    }

    // 3. CONCRETE SIDEWALKS & CURBS
    const sidewalkWest = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 38), this.matSidewalk);
    sidewalkWest.position.set(-20, 0.1, 0);
    const sidewalkEast = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 38), this.matSidewalk);
    sidewalkEast.position.set(20, 0.1, 0);
    const sidewalkSouth = new THREE.Mesh(new THREE.BoxGeometry(44, 0.2, 4), this.matSidewalk);
    sidewalkSouth.position.set(0, 0.1, -20);
    const sidewalkNorth = new THREE.Mesh(new THREE.BoxGeometry(44, 0.2, 4), this.matSidewalk);
    sidewalkNorth.position.set(0, 0.1, 20);
    root.add(sidewalkWest, sidewalkEast, sidewalkSouth, sidewalkNorth);

    // 4. PERIMETER FENCES & MAIN ENTRANCE GATE
    this.buildPerimeterFences(root, 42);

    // 5. EXTERIOR CLUTTER (Dumpsters, Pallets, Forklift crates, Concrete Jersey Barriers, Utility transformers)
    this.buildExteriorClutter(root);

    // 6. BUILDING INTERIOR FLOORS & CEILINGS
    // Ground floor polished tile
    const gFloor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), this.matFloorTile);
    gFloor.rotation.x = -Math.PI / 2;
    gFloor.position.set(0, 0.02, 0);
    gFloor.receiveShadow = true;
    root.add(gFloor);

    // 2nd floor concrete slab with staircase cutout
    const floor2A = new THREE.Mesh(new THREE.BoxGeometry(36, 0.3, 24), this.matFloorTile);
    floor2A.position.set(0, 4.2, -6);
    const floor2B = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 12), this.matFloorTile);
    floor2B.position.set(7, 4.2, 12);
    root.add(floor2A, floor2B);

    // Roof deck (Y=8.4)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(36, 0.35, 36), this.matCeiling);
    roof.position.set(0, 8.4, 0);
    roof.receiveShadow = true;
    root.add(roof);

    // 7. ROOF ACCESS & UTILITIES (HVAC Units, Chillers, Antenna Mast)
    this.buildRoofUtilities(root);

    // 8. INTERIOR ROOM PROPS
    // Site A: Server Room Core (Ground floor -6, 0, -6)
    this.buildServerRoom(root, -6, 0, -6);

    // Site B: Control Room Command Center (2nd floor 5, 4.4, 5)
    this.buildControlRoom(root, 5, 4.4, 5);

    // Stairs connecting 1F to 2F
    this.buildStairs(root, -12, 0, 12);

    // Exterior Streetlights & Compound floodlights
    this.buildExteriorLighting(root);

    this.currentRoot = root;
    this.scene.add(root);
  }

  private buildPerimeterFences(root: THREE.Group, dist: number) {
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.8 });

    // North & South fences
    for (let x = -dist; x <= dist; x += 6) {
      if (Math.abs(x) < 5) continue; // Leave main gate opening at front
      const postSouth = new THREE.Mesh(postGeo, postMat);
      postSouth.position.set(x, 1.6, -dist);
      const postNorth = new THREE.Mesh(postGeo, postMat);
      postNorth.position.set(x, 1.6, dist);

      const panelS = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.8), this.matFence);
      panelS.position.set(x - 3, 1.6, -dist);
      const panelN = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.8), this.matFence);
      panelN.position.set(x - 3, 1.6, dist);

      root.add(postSouth, postNorth, panelS, panelN);
    }

    // East & West fences
    for (let z = -dist; z <= dist; z += 6) {
      const postWest = new THREE.Mesh(postGeo, postMat);
      postWest.position.set(-dist, 1.6, z);
      const postEast = new THREE.Mesh(postGeo, postMat);
      postEast.position.set(dist, 1.6, z);

      const panelW = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.8), this.matFence);
      panelW.rotation.y = Math.PI / 2;
      panelW.position.set(-dist, 1.6, z - 3);

      const panelE = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.8), this.matFence);
      panelE.rotation.y = Math.PI / 2;
      panelE.position.set(dist, 1.6, z - 3);

      root.add(postWest, postEast, panelW, panelE);
    }
  }

  private buildExteriorClutter(root: THREE.Group) {
    // Green industrial dumpsters
    const dumpster1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.4), this.matDumpster);
    dumpster1.position.set(-24, 0.8, 8);
    const dumpster2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.4), this.matDumpster);
    dumpster2.position.set(24, 0.8, -14);
    root.add(dumpster1, dumpster2);

    // Wooden cargo pallets & crates
    const cratePositions = [
      [-22, 0.5, -12], [-22, 1.5, -12], [-20.8, 0.5, -12],
      [22, 0.6, 16], [23.4, 0.6, 16], [22, 1.8, 16],
      [-14, 0.6, 26], [-12.5, 0.6, 26]
    ];
    for (const pos of cratePositions) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), this.matCrate);
      crate.position.set(pos[0], pos[1], pos[2]);
      crate.castShadow = true;
      crate.receiveShadow = true;
      root.add(crate);
    }

    // Concrete & yellow security barriers
    const barrierPositions = [
      [-6, 0.45, -28], [6, 0.45, -28],
      [-22, 0.45, -4], [22, 0.45, -4]
    ];
    for (const b of barrierPositions) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.5), this.matBarrier);
      barrier.position.set(b[0], b[1], b[2]);
      root.add(barrier);
    }
  }

  private buildRoofUtilities(root: THREE.Group) {
    // Large HVAC Chillers on roof
    for (let i = 0; i < 3; i++) {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 2.2), this.matVent);
      hvac.position.set(-8 + i * 8, 9.3, 6);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 12), this.matServerRack);
      fan.position.set(-8 + i * 8, 10.25, 6);
      root.add(hvac, fan);
    }

    // High telecom communication antenna mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 12, 8), this.matServerRack);
    mast.position.set(12, 14.4, -12);
    const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    beaconLight.position.set(12, 20.4, -12);
    root.add(mast, beaconLight);
  }

  private buildServerRoom(root: THREE.Group, cx: number, cy: number, cz: number) {
    // Bomb Site A Container / Server racks
    for (let row = -2; row <= 2; row += 1.8) {
      for (let col = -1; col <= 1; col += 2) {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.7), this.matServerRack);
        rack.position.set(cx + row, cy + 1.3, cz + col);

        // Blinking green LED status lights
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.02), this.matServerLights);
        led.position.set(cx + row, cy + 1.8, cz + col + 0.36);
        root.add(rack, led);
      }
    }

    // Objective Biohazard / Bomb Site Container in center
    const bombContainer = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.8, roughness: 0.2 }));
    bombContainer.position.set(cx, cy + 0.45, cz);
    const bombBeacon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    bombBeacon.position.set(cx, cy + 1.0, cz);
    root.add(bombContainer, bombBeacon);
  }

  private buildControlRoom(root: THREE.Group, cx: number, cy: number, cz: number) {
    // Bomb Site B - Control consoles, desks & glowing monitors
    for (let i = -1; i <= 1; i++) {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.0), this.matDesk);
      desk.position.set(cx + i * 3, cy + 0.42, cz);

      // Monitors
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), this.matMonitor);
      mon.position.set(cx + i * 3, cy + 1.15, cz - 0.2);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), this.matScreen);
      scr.position.set(cx + i * 3, cy + 1.15, cz - 0.16);

      root.add(desk, mon, scr);
    }

    // Site B Defusal Object
    const siteBObj = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.7, roughness: 0.3 }));
    siteBObj.position.set(cx, cy + 0.4, cz + 2.5);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    beacon.position.set(cx, cy + 0.9, cz + 2.5);
    root.add(siteBObj, beacon);
  }

  private buildStairs(root: THREE.Group, sx: number, sy: number, sz: number) {
    const steps = 14;
    const stepH = 4.2 / steps;
    const stepD = 0.38;
    const stepW = 2.0;

    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH * (i + 1), stepD), this.matSidewalk);
      step.position.set(sx, sy + (stepH * (i + 1)) / 2, sz - i * stepD);
      root.add(step);
    }

    // Handrail
    const railMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, steps * stepD * 1.3, 8), railMat);
    railL.position.set(sx - stepW / 2 + 0.05, sy + 2.8, sz - (steps * stepD) / 2);
    railL.rotation.x = 0.65;
    const railR = railL.clone();
    railR.position.x = sx + stepW / 2 - 0.05;
    root.add(railL, railR);
  }

  private buildExteriorLighting(root: THREE.Group) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });

    const lampCoords = [
      [-30, -30], [30, -30],
      [-30, 30], [30, 30]
    ];

    for (const [x, z] of lampCoords) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), poleMat);
      pole.position.set(x, 3.5, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.8), poleMat);
      arm.position.set(x, 6.8, z > 0 ? z - 0.9 : z + 0.9);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.6), lampMat);
      head.position.set(x, 6.7, z > 0 ? z - 1.6 : z + 1.6);

      const light = new THREE.PointLight(0xfef3c7, 0.8, 28);
      light.position.set(x, 6.4, z > 0 ? z - 1.6 : z + 1.6);
      root.add(pole, arm, head, light);
    }
  }
}
