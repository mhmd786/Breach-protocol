import * as THREE from 'three';
import { PlayerState } from '../types/game';
import { WEAPONS } from '../data/weapons';
import { DestructionEngine } from './DestructionEngine';
import { sound } from '../audio/SoundEngine';

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public destruction: DestructionEngine;
  public player: PlayerState;

  // Camera rig & transforms
  public pitchObject: THREE.Object3D;
  public yawObject: THREE.Object3D;
  public isLocked: boolean = false;

  // Movement physics
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isGrounded: boolean = true;
  public eyeHeight: number = 1.7;
  public crouchHeight: number = 1.1;

  // Input states
  public keys: Record<string, boolean> = {};
  public isMouseDown: boolean = false;
  public isRightMouseDown: boolean = false;

  // Weapon & Recoil state
  public shootTimer: number = 0;
  public reloadTimer: number = 0;
  public recoilOffset: { pitch: number; yaw: number } = { pitch: 0, yaw: 0 };
  public currentFov: number = 75;
  public baseFov: number = 75;

  // Rappel state
  public rappelAnchor: { x: number; y: number; z: number; normal: THREE.Vector3 } | null = null;
  public rappelRopeLine: THREE.Line | null = null;

  // Interaction prompt
  public activeInteractionPrompt: string | null = null;
  public interactionTarget: { type: 'reinforce' | 'barricade' | 'rappel' | 'window_entry' | 'objective_plant' | 'objective_defuse'; id: string } | null = null;

  // Bound event listeners for clean disposal
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onPointerLockChange: () => void;
  private onContextMenu: (e: MouseEvent) => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, destruction: DestructionEngine, player: PlayerState) {
    this.camera = camera;
    this.domElement = domElement;
    this.destruction = destruction;
    this.player = player;

    // Reset camera transform to local origin inside head rig
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();

    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(this.camera);

    this.yawObject = new THREE.Object3D();
    this.yawObject.position.set(player.pos.x, player.pos.y + this.eyeHeight, player.pos.z);
    this.yawObject.add(this.pitchObject);

    // Bind event handlers
    this.onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR') {
        this.startReload();
      } else if (e.code === 'KeyC') {
        this.player.isCrouched = !this.player.isCrouched;
      }
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    this.onMouseDown = (e: MouseEvent) => {
      if (!this.isLocked) {
        this.domElement.requestPointerLock();
        return;
      }
      if (e.button === 0) this.isMouseDown = true;
      if (e.button === 2) this.isRightMouseDown = true;
    };

    this.onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.isMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    };

    this.onPointerLockChange = () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    };

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.isLocked) return;

      const mouseSensitivity = 0.0022;
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      // Mouse UP = look UP, Mouse DOWN = look DOWN
      // Mouse LEFT = turn LEFT, Mouse RIGHT = turn RIGHT
      this.yawObject.rotation.y -= movementX * mouseSensitivity;
      this.pitchObject.rotation.x -= movementY * mouseSensitivity;

      // Clamp vertical pitch (-88 to +88 degrees)
      this.pitchObject.rotation.x = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.pitchObject.rotation.x));
    };

    this.onContextMenu = (e: MouseEvent) => e.preventDefault();

    this.setupInputs();
  }

  private setupInputs() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  public destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('contextmenu', this.onContextMenu);

    if (this.yawObject.parent) {
      this.yawObject.parent.remove(this.yawObject);
    }
  }

  public update(
    delta: number,
    onShootBullet: (origin: THREE.Vector3, direction: THREE.Vector3) => void
  ) {
    if (!this.player.isAlive) return;

    // Handle Lean (Q / E)
    let targetLean = 0;
    if (this.keys['KeyQ']) targetLean -= 1;
    if (this.keys['KeyE']) targetLean += 1;
    this.player.leanAngle = THREE.MathUtils.lerp(this.player.leanAngle, targetLean, delta * 12);

    // Apply lean camera roll & head shift
    this.camera.rotation.z = -this.player.leanAngle * 0.18;
    this.camera.position.x = this.player.leanAngle * 0.28;
    this.camera.position.y = 0;
    this.camera.position.z = 0;

    // ADS Zoom transition
    const weaponData = WEAPONS[this.player.primaryWeaponId] || WEAPONS['ar_commando'];
    this.player.isAiming = this.isRightMouseDown;
    const targetFov = this.player.isAiming ? this.baseFov * weaponData.adsZoom : this.baseFov;
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, delta * 14);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // Eye height lerp (Crouch)
    const targetHeight = this.player.isCrouched ? this.crouchHeight : this.eyeHeight;
    const curEyeY = this.yawObject.position.y - this.player.pos.y;
    const nextEyeY = THREE.MathUtils.lerp(curEyeY, targetHeight, delta * 10);
    this.yawObject.position.y = this.player.pos.y + nextEyeY;

    // Recoil recovery
    this.recoilOffset.pitch = THREE.MathUtils.lerp(this.recoilOffset.pitch, 0, delta * 14);
    this.recoilOffset.yaw = THREE.MathUtils.lerp(this.recoilOffset.yaw, 0, delta * 14);

    // Reload timer
    if (this.reloadTimer > 0) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }

    // Weapon Firing loop
    this.shootTimer -= delta;
    if (this.isMouseDown && this.shootTimer <= 0 && this.reloadTimer <= 0) {
      if (this.player.currentAmmo > 0) {
        this.fireWeapon(weaponData, onShootBullet);
      } else {
        this.startReload();
      }
    }

    // Movement: Rappel vs Normal Ground movement
    if (this.player.isRappelling && this.rappelAnchor) {
      this.handleRappelMovement(delta);
    } else {
      this.handleGroundMovement(delta);
    }

    // Sync player position & rotation
    this.player.pos.x = this.yawObject.position.x;
    this.player.pos.y = this.yawObject.position.y - nextEyeY;
    this.player.pos.z = this.yawObject.position.z;
    this.player.rot.yaw = this.yawObject.rotation.y;
    this.player.rot.pitch = this.pitchObject.rotation.x;

    // Contextual interaction scanner (Reinforce, Barricade, Rappel, Window Entry)
    this.scanInteractionContext();
  }

  private handleGroundMovement(delta: number) {
    const moveVector = new THREE.Vector3();
    this.player.isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.player.isAiming && !this.player.isCrouched;

    const speed = this.player.isCrouched
      ? 2.2
      : (this.player.isSprinting ? 5.8 : (this.player.isAiming ? 2.5 : 3.8));

    // A = LEFT, D = RIGHT, W = FORWARD, S = BACKWARD
    if (this.keys['KeyW']) moveVector.z -= 1;
    if (this.keys['KeyS']) moveVector.z += 1;
    if (this.keys['KeyA']) moveVector.x -= 1;
    if (this.keys['KeyD']) moveVector.x += 1;

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawObject.rotation.y);
      moveVector.multiplyScalar(speed * delta);

      // Check collision
      const nextPos = this.yawObject.position.clone().add(moveVector);
      nextPos.y = this.player.pos.y; // check at player base

      if (!this.destruction.checkPointCollision(nextPos, 0.45, 1.8)) {
        this.yawObject.position.x += moveVector.x;
        this.yawObject.position.z += moveVector.z;
      } else {
        // Try slide along X
        const posX = new THREE.Vector3(this.yawObject.position.x + moveVector.x, this.player.pos.y, this.yawObject.position.z);
        if (!this.destruction.checkPointCollision(posX, 0.45, 1.8)) {
          this.yawObject.position.x += moveVector.x;
        } else {
          // Try slide along Z
          const posZ = new THREE.Vector3(this.yawObject.position.x, this.player.pos.y, this.yawObject.position.z + moveVector.z);
          if (!this.destruction.checkPointCollision(posZ, 0.45, 1.8)) {
            this.yawObject.position.z += moveVector.z;
          }
        }
      }

      // Procedural footstep audio
      if (Math.random() < (this.player.isSprinting ? 0.08 : 0.04)) {
        const isExterior = Math.abs(this.yawObject.position.x) > 18 || Math.abs(this.yawObject.position.z) > 18;
        sound.playFootstep(isExterior ? 'gravel' : 'concrete', this.player.isSprinting, this.player.pos);
      }
    }

    // Floor elevation check (1F vs 2F stairs/slab)
    const is2ndFloor = (this.yawObject.position.x > -18 && this.yawObject.position.x < 18 &&
                        this.yawObject.position.z > -18 && this.yawObject.position.z < 18 &&
                        this.player.pos.y > 2.0);

    const groundTargetY = is2ndFloor ? 4.2 : 0;
    this.player.pos.y = THREE.MathUtils.lerp(this.player.pos.y, groundTargetY, delta * 12);
  }

  // Real Exterior Wall Rappel physics
  private handleRappelMovement(delta: number) {
    const climbSpeed = 3.5;
    const lateralSpeed = 2.8;

    // W = climb up, S = rappel down
    if (this.keys['KeyW'] && this.player.pos.y < 8.2) {
      this.player.pos.y += climbSpeed * delta;
    }
    if (this.keys['KeyS'] && this.player.pos.y > 0.2) {
      this.player.pos.y -= climbSpeed * delta;
    }

    // Space = detach from rappel
    if (this.keys['Space']) {
      this.detachRappel();
      return;
    }

    // Lateral swinging along the wall (A/D)
    if (this.rappelAnchor) {
      const tangent = new THREE.Vector3(-this.rappelAnchor.normal.z, 0, this.rappelAnchor.normal.x);
      if (this.keys['KeyA']) {
        this.yawObject.position.addScaledVector(tangent, -lateralSpeed * delta);
      }
      if (this.keys['KeyD']) {
        this.yawObject.position.addScaledVector(tangent, lateralSpeed * delta);
      }
    }
  }

  public attachRappel(anchor: { x: number; y: number; z: number; normal: THREE.Vector3 }) {
    this.player.isRappelling = true;
    this.rappelAnchor = anchor;
    sound.playFootstep('metal', false, this.player.pos);
  }

  public detachRappel() {
    this.player.isRappelling = false;
    this.rappelAnchor = null;
    sound.playFootstep('concrete', false, this.player.pos);
  }

  // Window breach entry while rappelling
  public executeWindowEntry(doorOrWindowId: string) {
    const item = this.destruction.doorsAndWindows.get(doorOrWindowId);
    if (!item) return;

    // Break barricade/glass
    this.destruction.damageDoorOrWindow(doorOrWindowId, 999, this.player.pos);

    // Physically step inside room
    const insideNormal = new THREE.Vector3(0, 0, item.position.z > 0 ? -1.8 : 1.8);
    this.yawObject.position.set(item.position.x, item.position.y, item.position.z).add(insideNormal);
    this.player.pos.y = item.position.y > 3 ? 4.2 : 0;

    this.detachRappel();
    sound.playFootstep('wood', true, this.player.pos);
  }

  private scanInteractionContext() {
    this.activeInteractionPrompt = null;
    this.interactionTarget = null;

    const pPos = new THREE.Vector3(this.yawObject.position.x, this.player.pos.y, this.yawObject.position.z);

    // 1. Rappel window entry prompt
    if (this.player.isRappelling) {
      for (const [id, item] of this.destruction.doorsAndWindows) {
        if (item.type === 'window') {
          const wPos = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
          if (pPos.distanceTo(wPos) < 2.5) {
            this.activeInteractionPrompt = `[F] BREACH & ENTER WINDOW (${item.name})`;
            this.interactionTarget = { type: 'window_entry', id };
            return;
          }
        }
      }
    }

    // 2. Rappel attach prompt (when near exterior wall / roof edge)
    const isNearExteriorWall = (Math.abs(pPos.x) > 17 && Math.abs(pPos.x) < 20) || (Math.abs(pPos.z) > 17 && Math.abs(pPos.z) < 20);
    if (!this.player.isRappelling && isNearExteriorWall && pPos.y < 8.5) {
      this.activeInteractionPrompt = `[F] ATTACH RAPPEL ROPE`;
      this.interactionTarget = { type: 'rappel', id: 'exterior_wall' };
      return;
    }

    // 3. Defender Reinforce soft wall
    if (this.player.team === 'defenders' && this.player.reinforcedWallsRemaining > 0) {
      for (const [segId, seg] of this.destruction.wallSegments) {
        if (!seg.isDestroyed && !seg.isReinforced && seg.material !== 'structural') {
          const sPos = new THREE.Vector3(seg.center.x, seg.center.y, seg.center.z);
          if (pPos.distanceTo(sPos) < 2.2) {
            this.activeInteractionPrompt = `[F] REINFORCE WALL (${this.player.reinforcedWallsRemaining} LEFT)`;
            this.interactionTarget = { type: 'reinforce', id: segId };
            return;
          }
        }
      }
    }

    // 4. Defender Barricade door/window
    if (this.player.team === 'defenders' && this.player.barricadesRemaining > 0) {
      for (const [id, item] of this.destruction.doorsAndWindows) {
        if (item.state !== 'barricaded') {
          const dPos = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
          if (pPos.distanceTo(dPos) < 2.4) {
            this.activeInteractionPrompt = `[F] BARRICADE ${item.type.toUpperCase()}`;
            this.interactionTarget = { type: 'barricade', id };
            return;
          }
        }
      }
    }
  }

  // Execute active contextual interaction (Key F)
  public triggerInteract() {
    if (!this.interactionTarget) return;

    if (this.interactionTarget.type === 'window_entry') {
      this.executeWindowEntry(this.interactionTarget.id);
    } else if (this.interactionTarget.type === 'rappel') {
      const normal = new THREE.Vector3(
        Math.abs(this.yawObject.position.x) > 17 ? Math.sign(this.yawObject.position.x) : 0,
        0,
        Math.abs(this.yawObject.position.z) > 17 ? Math.sign(this.yawObject.position.z) : 0
      );
      this.attachRappel({
        x: this.yawObject.position.x,
        y: 8.4,
        z: this.yawObject.position.z,
        normal
      });
    } else if (this.interactionTarget.type === 'reinforce') {
      if (this.destruction.reinforceWall(this.interactionTarget.id, this.player.pos)) {
        this.player.reinforcedWallsRemaining--;
      }
    } else if (this.interactionTarget.type === 'barricade') {
      if (this.destruction.barricadeDoorOrWindow(this.interactionTarget.id, this.player.pos)) {
        this.player.barricadesRemaining--;
      }
    }
  }

  private fireWeapon(weaponData: typeof WEAPONS[string], onShootBullet: (origin: THREE.Vector3, direction: THREE.Vector3) => void) {
    this.player.currentAmmo--;
    this.shootTimer = 60 / weaponData.rpm;

    // Recoil kick
    const recoilV = weaponData.recoilVertical * (this.player.isAiming ? 0.6 : 1.0);
    const recoilH = (Math.random() - 0.5) * weaponData.recoilHorizontal * (this.player.isAiming ? 0.6 : 1.0);

    this.pitchObject.rotation.x += recoilV;
    this.yawObject.rotation.y += recoilH;

    // Gun sound
    sound.playGunshot(weaponData.soundProfile, this.player.pos);

    // Bullet Raycast direction from camera with spread
    const spreadVal = this.player.isAiming ? weaponData.spread * 0.2 : weaponData.spread;
    const spreadVector = new THREE.Vector3(
      (Math.random() - 0.5) * spreadVal,
      (Math.random() - 0.5) * spreadVal,
      0
    );

    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitchObject.rotation.x, this.yawObject.rotation.y, 0, 'YXZ'));
    dir.add(spreadVector).normalize();

    const origin = new THREE.Vector3().copy(this.yawObject.position);
    onShootBullet(origin, dir);
  }

  public startReload() {
    if (this.reloadTimer > 0) return;
    const weaponData = WEAPONS[this.player.primaryWeaponId] || WEAPONS['ar_commando'];
    if (this.player.currentAmmo === weaponData.magSize || this.player.reserveAmmo <= 0) return;

    this.reloadTimer = weaponData.reloadTime;
    sound.playReloadSound();
  }

  private finishReload() {
    const weaponData = WEAPONS[this.player.primaryWeaponId] || WEAPONS['ar_commando'];
    const needed = weaponData.magSize - this.player.currentAmmo;
    const toLoad = Math.min(needed, this.player.reserveAmmo);
    this.player.currentAmmo += toLoad;
    this.player.reserveAmmo -= toLoad;
  }
}
