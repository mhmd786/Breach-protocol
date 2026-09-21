import * as THREE from 'three';
import { BreakableWallSegment, DoorOrWindow, WallMaterial } from '../types/game';
import { WallDefinition } from '../maps/mapData';
import { sound } from '../audio/SoundEngine';

export interface DebrisParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  lifetime: number;
}

export class DestructionEngine {
  public scene: THREE.Scene;
  public wallSegments: Map<string, BreakableWallSegment> = new Map();
  public segmentMeshes: Map<string, THREE.Mesh> = new Map();
  public doorsAndWindows: Map<string, DoorOrWindow> = new Map();
  public doorMeshes: Map<string, THREE.Group> = new Map();
  public debrisList: DebrisParticle[] = [];

  // Reusable PBR-styled materials
  public matDrywall: THREE.MeshStandardMaterial;
  public matWood: THREE.MeshStandardMaterial;
  public matReinforced: THREE.MeshStandardMaterial;
  public matBarricade: THREE.MeshStandardMaterial;
  public matGlass: THREE.MeshPhysicalMaterial;
  public matStructural: THREE.MeshStandardMaterial;
  public matConcrete: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Tactical PBR materials
    this.matDrywall = new THREE.MeshStandardMaterial({
      color: 0xdfdad2,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.matWood = new THREE.MeshStandardMaterial({
      color: 0x8a6240,
      roughness: 0.75,
      metalness: 0.0,
    });

    this.matReinforced = new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.35,
      metalness: 0.85,
    });

    this.matBarricade = new THREE.MeshStandardMaterial({
      color: 0x6e5238,
      roughness: 0.85,
      metalness: 0.02,
    });

    this.matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.7,
      ior: 1.5,
    });

    this.matStructural = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.7,
      metalness: 0.3,
    });

    this.matConcrete = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.95,
      metalness: 0.05,
    });
  }

  // Initialize all walls from map data
  public initMapWalls(walls: WallDefinition[]) {
    // Clear previous
    this.wallSegments.clear();
    this.segmentMeshes.forEach(mesh => this.scene.remove(mesh));
    this.segmentMeshes.clear();

    for (const wall of walls) {
      const start = new THREE.Vector3(...wall.start);
      const end = new THREE.Vector3(...wall.end);
      const length = start.distanceTo(end);
      const dir = new THREE.Vector3().subVectors(end, start).normalize();
      const angle = Math.atan2(dir.x, dir.z);

      if (!wall.isBreachable) {
        // Solid structural concrete wall
        const geo = new THREE.BoxGeometry(wall.thickness, wall.height, length);
        const mesh = new THREE.Mesh(geo, this.matStructural);
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        center.y += wall.height / 2;
        mesh.position.copy(center);
        mesh.rotation.y = angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Store as a non-breakable segment for collision checks
        const segId = `structural_${wall.id}`;
        this.wallSegments.set(segId, {
          id: segId,
          wallId: wall.id,
          row: 0,
          col: 0,
          isDestroyed: false,
          isReinforced: false,
          health: 999999,
          material: 'structural',
          center: { x: center.x, y: center.y, z: center.z },
          size: { width: wall.thickness, height: wall.height, depth: length }
        });
      } else {
        // Breachable subdivided wall (grid of columns and rows)
        const cols = wall.segmentsX || 4;
        const rows = wall.segmentsY || 2;
        const segLen = length / cols;
        const segH = wall.height / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const segId = `${wall.id}_r${r}_c${c}`;
            const segCenter = new THREE.Vector3()
              .copy(start)
              .addScaledVector(dir, (c + 0.5) * segLen);
            segCenter.y += (r + 0.5) * segH;

            const segGeo = new THREE.BoxGeometry(wall.thickness, segH * 0.98, segLen * 0.98);
            const mat = wall.material === 'wood' ? this.matWood : this.matDrywall;
            const segMesh = new THREE.Mesh(segGeo, mat);
            segMesh.position.copy(segCenter);
            segMesh.rotation.y = angle;
            segMesh.castShadow = true;
            segMesh.receiveShadow = true;
            this.scene.add(segMesh);

            this.segmentMeshes.set(segId, segMesh);
            this.wallSegments.set(segId, {
              id: segId,
              wallId: wall.id,
              row: r,
              col: c,
              isDestroyed: false,
              isReinforced: false,
              health: wall.material === 'wood' ? 120 : 70,
              material: wall.material as WallMaterial,
              center: { x: segCenter.x, y: segCenter.y, z: segCenter.z },
              size: { width: wall.thickness, height: segH, depth: segLen }
            });
          }
        }
      }
    }
  }

  // Initialize doors and windows with barricades
  public initDoorsAndWindows(items: DoorOrWindow[]) {
    this.doorsAndWindows.clear();
    this.doorMeshes.forEach(grp => this.scene.remove(grp));
    this.doorMeshes.clear();

    for (const item of items) {
      this.doorsAndWindows.set(item.id, { ...item });

      const group = new THREE.Group();
      group.position.set(item.position.x, item.position.y, item.position.z);
      group.rotation.y = item.rotation;

      // Frame
      const frameMat = this.matStructural;
      const fThick = 0.15;
      const leftPost = new THREE.Mesh(new THREE.BoxGeometry(fThick, item.height, 0.3), frameMat);
      leftPost.position.set(-item.width / 2, item.height / 2, 0);
      const rightPost = new THREE.Mesh(new THREE.BoxGeometry(fThick, item.height, 0.3), frameMat);
      rightPost.position.set(item.width / 2, item.height / 2, 0);
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(item.width, fThick, 0.3), frameMat);
      topBar.position.set(0, item.height, 0);

      group.add(leftPost, rightPost, topBar);

      // Glass (for windows)
      if (item.type === 'window') {
        const glassMesh = new THREE.Mesh(
          new THREE.BoxGeometry(item.width - 0.2, item.height - 0.2, 0.05),
          this.matGlass
        );
        glassMesh.position.set(0, item.height / 2, 0);
        glassMesh.name = 'glass';
        group.add(glassMesh);
      }

      // Wooden Barricade Planks (if initially barricaded)
      if (item.state === 'barricaded') {
        this.buildBarricadePlanks(group, item);
      }

      this.scene.add(group);
      this.doorMeshes.set(item.id, group);
    }
  }

  private buildBarricadePlanks(group: THREE.Group, item: DoorOrWindow) {
    const plankCount = 6;
    const plankH = (item.height * 0.95) / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(item.width * 0.96, plankH * 0.88, 0.12),
        this.matBarricade
      );
      plank.position.set(0, (i + 0.5) * plankH, 0);
      plank.name = `plank_${i}`;
      plank.castShadow = true;
      group.add(plank);
    }

    // Add yellow warning cross-tape for tactical aesthetics
    const tapeMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const tape = new THREE.Mesh(new THREE.BoxGeometry(item.width * 0.7, 0.08, 0.14), tapeMat);
    tape.position.set(0, item.height / 2, 0);
    tape.rotation.z = 0.35;
    tape.name = 'warning_tape';
    group.add(tape);
  }

  // Reinforce a wall section (Defender feature)
  public reinforceWall(segmentId: string, playerPos?: { x: number; y: number; z: number }): boolean {
    const seg = this.wallSegments.get(segmentId);
    if (!seg || seg.isDestroyed || seg.isReinforced || seg.material === 'structural') {
      return false;
    }

    seg.isReinforced = true;
    seg.material = 'reinforced_metal';
    seg.health = 500; // Survives normal weapons, requires Hard Breach

    const mesh = this.segmentMeshes.get(segmentId);
    if (mesh) {
      mesh.material = this.matReinforced;
      // Add metallic reinforcement studs/bolts
      const boltGeo = new THREE.CylinderGeometry(0.04, 0.04, seg.size.width + 0.05, 8);
      const boltMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
      const bolt1 = new THREE.Mesh(boltGeo, boltMat);
      bolt1.rotation.z = Math.PI / 2;
      bolt1.position.set(0, seg.size.height * 0.35, 0);
      mesh.add(bolt1);

      const bolt2 = bolt1.clone();
      bolt2.position.set(0, -seg.size.height * 0.35, 0);
      mesh.add(bolt2);
    }

    sound.playBarricadeHit(seg.center, playerPos);
    return true;
  }

  // Barricade a door or window (Defender feature)
  public barricadeDoorOrWindow(id: string, playerPos?: { x: number; y: number; z: number }): boolean {
    const item = this.doorsAndWindows.get(id);
    if (!item || item.state === 'barricaded') return false;

    item.state = 'barricaded';
    item.health = item.type === 'door' ? 100 : 60;

    const group = this.doorMeshes.get(id);
    if (group) {
      // Remove old planks
      for (let i = group.children.length - 1; i >= 0; i--) {
        const c = group.children[i];
        if (c.name.startsWith('plank_') || c.name === 'warning_tape') {
          group.remove(c);
        }
      }
      this.buildBarricadePlanks(group, item);
    }

    sound.playBarricadeHit(item.position, playerPos);
    return true;
  }

  // Damage or breach a door/window barricade
  public damageDoorOrWindow(id: string, damage: number, playerPos?: { x: number; y: number; z: number }): boolean {
    const item = this.doorsAndWindows.get(id);
    if (!item || item.state === 'destroyed') return false;

    item.health -= damage;
    sound.playBarricadeHit(item.position, playerPos);

    const group = this.doorMeshes.get(id);
    if (group) {
      // Shatter glass if it was a window
      const glass = group.getObjectByName('glass');
      if (glass && item.type === 'window') {
        group.remove(glass);
        sound.playGlassBreak(item.position, playerPos);
        this.spawnDebris(item.position, 'glass', 8);
      }

      if (item.health <= 0) {
        // Complete destruction: remove all planks and open collision
        item.state = 'destroyed';
        for (let i = group.children.length - 1; i >= 0; i--) {
          const c = group.children[i];
          if (c.name.startsWith('plank_') || c.name === 'warning_tape' || c.name === 'glass') {
            group.remove(c);
          }
        }
        this.spawnDebris(item.position, 'wood', 12);
        return true;
      } else {
        // Partial damage: remove some planks
        item.state = 'damaged';
        const planksRemaining = Math.max(1, Math.ceil((item.health / 100) * 6));
        for (let i = 5; i >= planksRemaining; i--) {
          const p = group.getObjectByName(`plank_${i}`);
          if (p) group.remove(p);
        }
        this.spawnDebris(item.position, 'wood', 4);
      }
    }
    return false;
  }

  // Damage a wall segment (Soft breach or bullet penetration)
  public damageSegment(segmentId: string, damage: number, isHardBreach = false, playerPos?: { x: number; y: number; z: number }): boolean {
    const seg = this.wallSegments.get(segmentId);
    if (!seg || seg.isDestroyed || seg.material === 'structural') return false;

    // Reinforced surfaces reject ordinary soft breach and bullets!
    if (seg.isReinforced && !isHardBreach) {
      sound.playBarricadeHit(seg.center, playerPos);
      return false;
    }

    seg.health -= damage;

    if (seg.health <= 0) {
      this.destroySegment(segmentId, playerPos);
      return true;
    } else {
      sound.playBarricadeHit(seg.center, playerPos);
      this.spawnDebris(seg.center, seg.material === 'wood' ? 'wood' : 'drywall', 4);
    }
    return false;
  }

  // Complete destruction of a wall segment - opens geometry, collision & sightlines!
  public destroySegment(segmentId: string, playerPos?: { x: number; y: number; z: number }) {
    const seg = this.wallSegments.get(segmentId);
    if (!seg || seg.isDestroyed) return;

    seg.isDestroyed = true;
    const mesh = this.segmentMeshes.get(segmentId);
    if (mesh) {
      this.scene.remove(mesh);
      this.segmentMeshes.delete(segmentId);
    }

    // Spawn physical debris chunks
    this.spawnDebris(seg.center, seg.isReinforced ? 'metal' : (seg.material === 'wood' ? 'wood' : 'drywall'), 14);

    // Audio
    sound.playExplosion(seg.center, playerPos);
  }

  // Large explosive breach (breaching charge)
  public explosiveBreach(origin: THREE.Vector3, radius: number = 3.5, isHardBreach: boolean = false, playerPos?: { x: number; y: number; z: number }) {
    sound.playExplosion({ x: origin.x, y: origin.y, z: origin.z }, playerPos);

    // Check wall segments in radius
    this.wallSegments.forEach((seg, segId) => {
      if (seg.isDestroyed || seg.material === 'structural') return;
      const c = new THREE.Vector3(seg.center.x, seg.center.y, seg.center.z);
      const dist = c.distanceTo(origin);
      if (dist <= radius) {
        if (!seg.isReinforced || isHardBreach) {
          this.destroySegment(segId, playerPos);
        }
      }
    });

    // Check doors and windows
    this.doorsAndWindows.forEach((item, id) => {
      if (item.state === 'destroyed') return;
      const pos = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
      if (pos.distanceTo(origin) <= radius + 1) {
        this.damageDoorOrWindow(id, 999, playerPos);
      }
    });
  }

  // Spawn visual debris particles with physics
  private spawnDebris(origin: { x: number; y: number; z: number }, type: 'drywall' | 'wood' | 'metal' | 'glass', count: number) {
    let mat: THREE.Material = this.matDrywall;
    if (type === 'wood') mat = this.matWood;
    if (type === 'metal') mat = this.matReinforced;
    if (type === 'glass') mat = this.matGlass;

    for (let i = 0; i < count; i++) {
      const size = 0.08 + Math.random() * 0.15;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.4,
        origin.y + (Math.random() - 0.5) * 0.4,
        origin.z + (Math.random() - 0.5) * 0.4
      );

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        1.5 + Math.random() * 4,
        (Math.random() - 0.5) * 6
      );

      const angVel = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      this.scene.add(mesh);
      this.debrisList.push({
        mesh,
        velocity: vel,
        angularVelocity: angVel,
        lifetime: 3.5 + Math.random() * 2
      });
    }

    // Limit debris list count to keep high frame rate
    if (this.debrisList.length > 100) {
      const removed = this.debrisList.splice(0, this.debrisList.length - 100);
      removed.forEach(d => this.scene.remove(d.mesh));
    }
  }

  // Update debris physics per frame
  public updateDebris(delta: number) {
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.lifetime -= delta;
      if (d.lifetime <= 0) {
        this.scene.remove(d.mesh);
        this.debrisList.splice(i, 1);
        continue;
      }

      d.velocity.y -= 9.8 * delta; // Gravity
      d.mesh.position.addScaledVector(d.velocity, delta);
      d.mesh.rotation.x += d.angularVelocity.x * delta;
      d.mesh.rotation.y += d.angularVelocity.y * delta;
      d.mesh.rotation.z += d.angularVelocity.z * delta;

      // Bounce on floor (Y=0 or Y=4.2)
      if (d.mesh.position.y < 0.05) {
        d.mesh.position.y = 0.05;
        d.velocity.y *= -0.3;
        d.velocity.x *= 0.7;
        d.velocity.z *= 0.7;
      }
    }
  }

  // Raycast against all active walls, doors and barricades
  public checkRayCollision(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3, maxDist: number = 60): { hit: boolean; dist: number; point: THREE.Vector3; normal: THREE.Vector3; segmentId?: string; doorId?: string } | null {
    const ray = new THREE.Ray(rayOrigin, rayDir);
    let closestDist = maxDist;
    let hitResult: { hit: boolean; dist: number; point: THREE.Vector3; normal: THREE.Vector3; segmentId?: string; doorId?: string } | null = null;

    // Check Wall Segments
    this.wallSegments.forEach((seg, segId) => {
      if (seg.isDestroyed) return;
      const min = new THREE.Vector3(
        seg.center.x - seg.size.width / 2,
        seg.center.y - seg.size.height / 2,
        seg.center.z - seg.size.depth / 2
      );
      const max = new THREE.Vector3(
        seg.center.x + seg.size.width / 2,
        seg.center.y + seg.size.height / 2,
        seg.center.z + seg.size.depth / 2
      );
      const box = new THREE.Box3(min, max);
      const target = new THREE.Vector3();
      const hitPoint = ray.intersectBox(box, target);
      if (hitPoint) {
        const d = rayOrigin.distanceTo(hitPoint);
        if (d < closestDist) {
          closestDist = d;
          hitResult = {
            hit: true,
            dist: d,
            point: hitPoint.clone(),
            normal: new THREE.Vector3(0, 0, 1),
            segmentId: segId
          };
        }
      }
    });

    // Check active barricaded doors & windows
    this.doorsAndWindows.forEach((item, doorId) => {
      if (item.state === 'destroyed' || item.state === 'open') return;
      const min = new THREE.Vector3(
        item.position.x - item.width / 2,
        item.position.y,
        item.position.z - 0.25
      );
      const max = new THREE.Vector3(
        item.position.x + item.width / 2,
        item.position.y + item.height,
        item.position.z + 0.25
      );
      const box = new THREE.Box3(min, max);
      const target = new THREE.Vector3();
      const hitPoint = ray.intersectBox(box, target);
      if (hitPoint) {
        const d = rayOrigin.distanceTo(hitPoint);
        if (d < closestDist) {
          closestDist = d;
          hitResult = {
            hit: true,
            dist: d,
            point: hitPoint.clone(),
            normal: new THREE.Vector3(0, 0, 1),
            doorId
          };
        }
      }
    });

    return hitResult;
  }

  // Check if a point collides with walls/doors (for player movement clipping)
  public checkPointCollision(pos: THREE.Vector3, playerRadius: number = 0.45, playerHeight: number = 1.8): boolean {
    const playerMin = new THREE.Vector3(pos.x - playerRadius, pos.y, pos.z - playerRadius);
    const playerMax = new THREE.Vector3(pos.x + playerRadius, pos.y + playerHeight, pos.z + playerRadius);
    const playerBox = new THREE.Box3(playerMin, playerMax);

    // Wall segments
    for (const [, seg] of this.wallSegments) {
      if (seg.isDestroyed) continue; // Walk directly through breached walls!
      const segMin = new THREE.Vector3(
        seg.center.x - seg.size.width / 2,
        seg.center.y - seg.size.height / 2,
        seg.center.z - seg.size.depth / 2
      );
      const segMax = new THREE.Vector3(
        seg.center.x + seg.size.width / 2,
        seg.center.y + seg.size.height / 2,
        seg.center.z + seg.size.depth / 2
      );
      const segBox = new THREE.Box3(segMin, segMax);
      if (playerBox.intersectsBox(segBox)) {
        return true;
      }
    }

    // Barricaded doors & windows
    for (const [, item] of this.doorsAndWindows) {
      if (item.state === 'destroyed' || item.state === 'open') continue;
      const doorMin = new THREE.Vector3(item.position.x - item.width / 2, item.position.y, item.position.z - 0.2);
      const doorMax = new THREE.Vector3(item.position.x + item.width / 2, item.position.y + item.height, item.position.z + 0.2);
      const doorBox = new THREE.Box3(doorMin, doorMax);
      if (playerBox.intersectsBox(doorBox)) {
        return true;
      }
    }

    return false;
  }
}
