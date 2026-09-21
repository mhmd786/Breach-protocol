import * as THREE from 'three';

export interface DroneScanResult {
  spottedEnemy: string | null;
  spottedObjective: boolean;
}

export class ReconDrone {
  public mesh: THREE.Group;
  public pos: THREE.Vector3;
  public vel: THREE.Vector3;
  public yaw: number = 0;
  public pitch: number = 0;
  public isGrounded: boolean = true;
  public jumpCooldown: number = 0;
  public hp: number = 40;
  public maxHp: number = 40;
  public destroyed: boolean = false;
  // Twitch's Shock Drone reuses this same class/piloting system rather than a separate one —
  // `isArmed` flags a drone as hers (drawn with a taser-dart emitter, and lets the pilot fire).
  public isArmed: boolean = false;
  public shockCooldown: number = 0;
  
  // Model Components
  public chassisMesh: THREE.Mesh;
  public wheels: THREE.Mesh[] = [];
  public antennaL: THREE.Mesh;
  public antennaR: THREE.Mesh;
  public camTurret: THREE.Group;
  public camLens: THREE.Mesh;
  public scanLight: THREE.SpotLight;
  public statusLed: THREE.Mesh;
  public smokeParticles: THREE.Points | null = null;
  public smokeVel: THREE.Vector3[] = [];

  // Materials for damage transitions
  private normalChassisMat: THREE.MeshStandardMaterial;
  private damagedChassisMat: THREE.MeshStandardMaterial;
  private ledMat: THREE.MeshBasicMaterial;
  private lensMat: THREE.MeshBasicMaterial;

  // Wheel speed & animation
  private currentDriveSpeed: number = 0;
  public readonly COLLISION_RADIUS = 0.11;
  public readonly DRONE_GROUND_OFFSET = 0.005;

  constructor(spawnPos: THREE.Vector3, initialYaw: number = 0) {
    this.pos = spawnPos.clone();
    this.pos.y = Math.max(spawnPos.y || 0, this.DRONE_GROUND_OFFSET);
    this.vel = new THREE.Vector3();
    this.yaw = initialYaw;

    this.mesh = new THREE.Group();

    // 1. Tactical Materials
    this.normalChassisMat = new THREE.MeshStandardMaterial({
      color: 0x1c2127, // Dark carbon tactical gray
      roughness: 0.45,
      metalness: 0.8
    });

    this.damagedChassisMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c, // Charred, blackened battle-damaged carbon
      roughness: 0.9,
      metalness: 0.2
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x3b424c,
      roughness: 0.6,
      metalness: 0.6
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x111214,
      roughness: 0.95
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xe65c00, // Vibrant tactical orange anodized hub
      roughness: 0.35,
      metalness: 0.85
    });

    this.ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });

    // 2. Compact Low-Profile Body Chassis (Length: 0.22m, Width: 0.14m, Height: 0.045m)
    this.chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.22), this.normalChassisMat);
    this.chassisMesh.position.set(0, 0.05, 0);
    this.chassisMesh.castShadow = true;
    this.chassisMesh.receiveShadow = true;

    // Top protective roll bar
    const rollBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.18), trimMat);
    rollBar.position.set(0, 0.03, 0);
    this.chassisMesh.add(rollBar);

    // Front angled protective wedge bumper
    const wedgeGeo = new THREE.BufferGeometry();
    const wedgeVertices = new Float32Array([
      // Front wedge bumper
      -0.07, -0.02, -0.11,
       0.07, -0.02, -0.11,
       0.05,  0.02, -0.14,
      -0.07, -0.02, -0.11,
       0.05,  0.02, -0.14,
      -0.05,  0.02, -0.14
    ]);
    wedgeGeo.setAttribute('position', new THREE.BufferAttribute(wedgeVertices, 3));
    wedgeGeo.computeVertexNormals();
    const wedge = new THREE.Mesh(wedgeGeo, trimMat);
    this.chassisMesh.add(wedge);

    // 3. Four Rugged All-Terrain Drive Wheels (Diameter: 0.09m, Width: 0.03m)
    // Placed on left and right flanks with high ground grip
    const wheelOffsets: [number, number, number][] = [
      [-0.09, 0.045, -0.075], // Front Left
      [ 0.09, 0.045, -0.075], // Front Right
      [-0.09, 0.045,  0.075], // Rear Left
      [ 0.09, 0.045,  0.075]  // Rear Right
    ];

    for (const [wx, wy, wz] of wheelOffsets) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, wy, wz);

      // Tire cylinder
      const tireGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;

      // Anodized center hub cap
      const rimGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.032, 10);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;

      wheelGroup.add(tire, rim);
      this.mesh.add(wheelGroup);
      this.wheels.push(tire);
    }

    // 4. Optical Sensor Turret (Front mounted spherical camera eye)
    this.camTurret = new THREE.Group();
    this.camTurret.position.set(0, 0.065, -0.11);

    const turretBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.3, metalness: 0.9 })
    );

    const lensAperture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12),
      trimMat
    );
    lensAperture.rotation.x = Math.PI / 2;
    lensAperture.position.set(0, 0, -0.025);

    this.camLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.016, 12),
      this.lensMat
    );
    this.camLens.position.set(0, 0, -0.036);

    this.camTurret.add(turretBody, lensAperture, this.camLens);
    this.mesh.add(this.camTurret);

    // Tactical Forward Spotlight (illuminates dark corners/vents)
    this.scanLight = new THREE.SpotLight(0x7fd6ff, 2.2, 8, Math.PI / 4, 0.4, 1.5);
    this.scanLight.position.set(0, 0.065, -0.12);
    this.scanLight.target.position.set(0, 0.04, -1.5);
    this.mesh.add(this.scanLight);
    this.mesh.add(this.scanLight.target);

    // 5. Rear Dual Spring Antennas & Status LED
    const antGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.22, 6);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x5a626b, metalness: 0.9 });

    this.antennaL = new THREE.Mesh(antGeo, antMat);
    this.antennaL.position.set(-0.05, 0.14, 0.09);
    this.antennaL.rotation.x = -0.3;
    this.antennaL.rotation.z = -0.12;

    this.antennaR = new THREE.Mesh(antGeo, antMat);
    this.antennaR.position.set(0.05, 0.14, 0.09);
    this.antennaR.rotation.x = -0.3;
    this.antennaR.rotation.z = 0.12;

    this.chassisMesh.add(this.antennaL, this.antennaR);

    // Status LED
    this.statusLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.01), this.ledMat);
    this.statusLed.position.set(0, 0.02, 0.11);
    this.chassisMesh.add(this.statusLed);

    this.mesh.add(this.chassisMesh);
    this.mesh.position.copy(this.pos);
  }

  /**
   * Main Physics & Driving Loop
   */
  public update(
    dt: number,
    keys: Record<string, boolean>,
    collidesFn: (x: number, z: number, y?: number) => boolean,
    sfxFn?: (freq: number, dur: number, type?: OscillatorType) => void,
    floorHeightFn?: (x: number, z: number, y: number) => number
  ) {
    // If destroyed, disable all input and only update smoke VFX
    if (this.destroyed) {
      this.updateSmoke(dt);
      return;
    }

    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= dt;
    }
    if (this.shockCooldown > 0) {
      this.shockCooldown -= dt;
    }

    // --- STEERING & YAW ---
    // A/D keys smoothly steer left and right
    const turnRate = 3.6;
    if (keys['KeyA'] || keys['ArrowLeft']) {
      this.yaw += turnRate * dt;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
      this.yaw -= turnRate * dt;
    }

    // --- ACCELERATION & DRIVING ---
    const forwardVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const maxSpeed = 5.2; // m/s
    const reverseSpeed = 2.8; // m/s
    const accel = 20.0;
    const friction = 14.0;

    let targetSpeed = 0;
    if (keys['KeyW'] || keys['ArrowUp']) {
      targetSpeed += maxSpeed;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
      targetSpeed -= reverseSpeed;
    }

    if (targetSpeed !== 0) {
      if (this.currentDriveSpeed < targetSpeed) {
        this.currentDriveSpeed = Math.min(targetSpeed, this.currentDriveSpeed + accel * dt);
      } else {
        this.currentDriveSpeed = Math.max(targetSpeed, this.currentDriveSpeed - accel * dt);
      }
    } else {
      // Natural braking friction
      if (this.currentDriveSpeed > 0) {
        this.currentDriveSpeed = Math.max(0, this.currentDriveSpeed - friction * dt);
      } else if (this.currentDriveSpeed < 0) {
        this.currentDriveSpeed = Math.min(0, this.currentDriveSpeed + friction * dt);
      }
    }

    // --- PNEUMATIC PISTON JUMP ---
    if ((keys['Space'] || keys['KeyX']) && this.isGrounded && this.jumpCooldown <= 0) {
      this.vel.y = 5.0; // Leaps approx 0.7m (bumped up from 4.2 / ~0.5m)
      this.isGrounded = false;
      this.jumpCooldown = 1.6;
      sfxFn?.(380, 0.08, 'sawtooth');
      sfxFn?.(720, 0.06, 'triangle');
    }

    // --- GRAVITY & STAIR/FLOOR CLAMPING ---
    const gravity = 18.0;
    this.vel.y -= gravity * dt;
    this.pos.y += this.vel.y * dt;

    const baseFloor = floorHeightFn ? floorHeightFn(this.pos.x, this.pos.z, this.pos.y) : 0;
    const groundLevel = baseFloor + this.DRONE_GROUND_OFFSET;

    if (this.pos.y <= groundLevel) {
      this.pos.y = groundLevel;
      this.vel.y = 0;
      this.isGrounded = true;
    } else if (this.isGrounded && this.jumpCooldown < 1.4) {
      // Smoothly stick to floor while traversing steps or slopes
      if (Math.abs(this.pos.y - groundLevel) < 0.22) {
        this.pos.y = groundLevel;
        this.vel.y = 0;
      }
    }

    // --- HORIZONTAL DISPLACEMENT WITH WALL SLIDING & UNSTUCK LOGIC ---
    if (Math.abs(this.currentDriveSpeed) > 0.01) {
      const step = forwardVec.clone().multiplyScalar(this.currentDriveSpeed * dt);
      const targetX = this.pos.x + step.x;
      const targetZ = this.pos.z + step.z;

      // 1. Try moving full diagonal step
      if (!collidesFn(targetX, targetZ, this.pos.y)) {
        this.pos.x = targetX;
        this.pos.z = targetZ;
      } else {
        // 2. Wall Sliding: Try X-axis only
        let movedX = false;
        if (!collidesFn(targetX, this.pos.z, this.pos.y)) {
          this.pos.x = targetX;
          movedX = true;
        }

        // 3. Wall Sliding: Try Z-axis only
        let movedZ = false;
        if (!collidesFn(this.pos.x, targetZ, this.pos.y)) {
          this.pos.z = targetZ;
          movedZ = true;
        }

        // If completely cornered against a wall, gently zero speed
        if (!movedX && !movedZ) {
          this.currentDriveSpeed = 0;
        }
      }

      // Animate wheel rolling
      const rollAmount = (this.currentDriveSpeed * dt) / 0.045;
      for (const wheel of this.wheels) {
        wheel.rotation.x += rollAmount;
      }

      // Antennas subtle bounce
      const t = performance.now() * 0.015;
      this.antennaL.rotation.z = -0.12 + Math.sin(t) * 0.05;
      this.antennaR.rotation.z = 0.12 + Math.cos(t) * 0.05;
    }

    // --- UNSTUCK SAFETY CHECK ---
    // If somehow penetrating a collider boundary, push outward along free radial vectors
    if (collidesFn(this.pos.x, this.pos.z, this.pos.y)) {
      const nudgeDist = 0.04;
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4, (3 * Math.PI) / 4];
      for (const ang of angles) {
        const nx = this.pos.x + Math.cos(this.yaw + ang) * nudgeDist;
        const nz = this.pos.z + Math.sin(this.yaw + ang) * nudgeDist;
        if (!collidesFn(nx, nz, this.pos.y)) {
          this.pos.x = nx;
          this.pos.z = nz;
          break;
        }
      }
    }

    // --- SYNC 3D MESH & TURRET GIMBAL ---
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;

    // Pitch front camera turret with look angle
    if (this.camTurret) {
      this.camTurret.rotation.x = this.pitch;
    }
  }

  /**
   * Independent First-Person Drone Camera Viewpoint
   * Positioned directly at the front optical glass sensor lens
   */
  // Marks this drone as Twitch's Shock Drone: adds a visible taser-dart emitter so it
  // reads differently from a plain recon drone, and lets update()/canFireShock() know
  // firing is allowed while piloting it.
  public setArmed() {
    this.isArmed = true;
    const emitterMat = new THREE.MeshStandardMaterial({ color: 0xffcc33, roughness: 0.3, metalness: 0.7, emissive: 0x664400, emissiveIntensity: 0.6 });
    const emitter = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), emitterMat);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0.065, -0.2);
    this.mesh.add(emitter);
  }

  public canFireShock(): boolean {
    return this.isArmed && !this.destroyed && this.shockCooldown <= 0;
  }

  public getCameraPosition(): THREE.Vector3 {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    // Lens is 0.088m above ground, 0.11m forward from chassis center
    return this.pos.clone()
      .add(new THREE.Vector3(0, 0.088, 0))
      .add(fwd.multiplyScalar(0.11));
  }

  /**
   * Tactical Recon Scanner
   * Scans defenders and objectives through direct Line of Sight
   */
  public scanSurroundings(
    bots: Array<{ mesh: THREE.Group; op: { name: string; role: string }; alive: boolean; side: string }>,
    objectivePos: THREE.Vector3,
    canSeeFn: (from: THREE.Vector3, to: THREE.Vector3) => boolean
  ): DroneScanResult {
    if (this.destroyed) return { spottedEnemy: null, spottedObjective: false };

    const eyePos = this.getCameraPosition();
    let spottedEnemy: string | null = null;
    let spottedObjective = false;

    // 1. Scan Defender Units
    for (const bot of bots) {
      if (!bot.alive || bot.side !== 'def') continue;
      const d = eyePos.distanceTo(bot.mesh.position);
      if (d < 15.0) {
        // Target chest height
        const targetPoint = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        if (canSeeFn(eyePos, targetPoint)) {
          spottedEnemy = bot.op.name;
          break;
        }
      }
    }

    // 2. Scan Objective Container (2F Vault)
    if (eyePos.distanceTo(objectivePos) < 14.0) {
      const objTarget = objectivePos.clone().add(new THREE.Vector3(0, 0.8, 0));
      if (canSeeFn(eyePos, objTarget)) {
        spottedObjective = true;
      }
    }

    return { spottedEnemy, spottedObjective };
  }

  /**
   * Destroys the drone with damage visuals and disables all further input
   */
  public destroy(scene: THREE.Scene) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hp = 0;
    this.currentDriveSpeed = 0;
    this.vel.set(0, 0, 0);

    // 1. Switch to charred battle-damaged chassis material
    if (this.chassisMesh) {
      this.chassisMesh.material = this.damagedChassisMat;
    }

    // 2. Extinguish headlight & turn LED to dark red
    if (this.scanLight) {
      this.scanLight.intensity = 0;
    }
    if (this.statusLed) {
      this.ledMat.color.setHex(0x330000);
    }
    if (this.camLens) {
      this.lensMat.color.setHex(0x221111);
    }

    // 3. Bend antennas realistically
    this.antennaL.rotation.z = -0.75;
    this.antennaR.rotation.z = 0.85;
    this.antennaL.rotation.x = 0.4;

    // 4. Spawn smoking particle emitter attached to the destroyed chassis
    const pCount = 18;
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(pCount * 3);
    this.smokeVel = [];

    for (let i = 0; i < pCount; i++) {
      posArr[i * 3] = (Math.random() - 0.5) * 0.08;
      posArr[i * 3 + 1] = 0.06 + Math.random() * 0.04;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
      this.smokeVel.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.12,
        0.2 + Math.random() * 0.35,
        (Math.random() - 0.5) * 0.12
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0x2e2e2e,
      size: 0.05,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });

    this.smokeParticles = new THREE.Points(geo, pMat);
    this.mesh.add(this.smokeParticles);
  }

  private updateSmoke(dt: number) {
    if (!this.smokeParticles) return;
    const posAttr = this.smokeParticles.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < this.smokeVel.length; i++) {
      arr[i * 3] += this.smokeVel[i].x * dt;
      arr[i * 3 + 1] += this.smokeVel[i].y * dt;
      arr[i * 3 + 2] += this.smokeVel[i].z * dt;

      // Loop smoke puffs upward
      if (arr[i * 3 + 1] > 0.45) {
        arr[i * 3] = (Math.random() - 0.5) * 0.06;
        arr[i * 3 + 1] = 0.06;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
      }
    }
    posAttr.needsUpdate = true;
  }
}
