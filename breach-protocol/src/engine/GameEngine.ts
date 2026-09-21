import * as THREE from 'three';
import { 
  PlayerState, 
  MatchPhase, 
  Team, 
  KillFeedEntry, 
  ObjectiveZone, 
  DeployableCamera, 
  DroneObject 
} from '../types/game';
import { COPPER_YARD_MAP, MapData } from '../maps/mapData';
import { DestructionEngine } from './DestructionEngine';
import { EnvironmentBuilder } from '../maps/EnvironmentBuilder';
import { WeaponMeshFactory, weaponMeshFactory } from './WeaponMeshFactory';
import { BotAIEngine, BotController } from './BotAI';
import { PlayerController } from './PlayerController';
import { WEAPONS } from '../data/weapons';
import { sound } from '../audio/SoundEngine';
import { OPERATORS, getOperator } from '../data/operators';

export class GameEngine {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // Sub-systems
  public destruction: DestructionEngine;
  public environmentBuilder: EnvironmentBuilder;
  public botAI: BotAIEngine;
  public playerController: PlayerController | null = null;

  // Match State
  public currentMap: MapData = COPPER_YARD_MAP;
  public matchPhase: MatchPhase = 'menu';
  public roundNumber: number = 1;
  public maxRounds: number = 9;
  public attackerScore: number = 0;
  public defenderScore: number = 0;
  public phaseTimer: number = 30; // seconds remaining in current phase
  public roundWinner: Team | null = null;
  public winReason: string = '';

  // Players (5 Attackers vs 5 Defenders)
  public players: PlayerState[] = [];
  public localPlayerId: string = 'p_local';
  public spectatorIndex: number = 0;

  // Visual meshes
  public firstPersonRig: ReturnType<WeaponMeshFactory['createFirstPersonRig']> | null = null;
  public botMeshes: Map<string, ReturnType<WeaponMeshFactory['createThirdPersonCharacter']>> = new Map();

  // Drones & Surveillance
  public localDrone: DroneObject | null = null;
  public droneMesh: ReturnType<WeaponMeshFactory['createReconDroneMesh']> | null = null;
  public isControllingDrone: boolean = false;
  public isViewingCCTV: boolean = false;
  public activeCCTVIndex: number = 0;
  public cctvCamera: THREE.PerspectiveCamera | null = null;
  public droneCamera: THREE.PerspectiveCamera | null = null;
  public cameras: DeployableCamera[] = [];

  // Objective Bomb Sites
  public objectives: ObjectiveZone[] = [];
  public activeDefuserZone: ObjectiveZone | null = null;
  public isPlantingDefuser: boolean = false;
  public isDisarmingDefuser: boolean = false;
  public defuserInteractionProgress: number = 0;

  // Tracers & Bullet VFX
  public bulletTracers: Array<{ mesh: THREE.Line; lifetime: number }> = [];

  // Killfeed & UI state
  public killFeed: KillFeedEntry[] = [];
  public spottedEnemies: Map<string, { x: number; y: number; z: number; decayTime: number }> = new Map();

  // Callbacks for React HUD updates
  public onStateChange?: () => void;

  private timer: THREE.Timer = new THREE.Timer();
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x181e26);
    this.scene.fog = new THREE.FogExp2(0x181e26, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 150);
    this.cctvCamera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 80);
    this.droneCamera = new THREE.PerspectiveCamera(80, container.clientWidth / container.clientHeight, 0.05, 120);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. Sub-engines
    this.destruction = new DestructionEngine(this.scene);
    this.environmentBuilder = new EnvironmentBuilder(this.scene);
    this.botAI = new BotAIEngine(this.destruction);

    // 5. Lighting
    this.setupLighting();

    // 6. Drone mesh
    this.droneMesh = weaponMeshFactory.createReconDroneMesh();
    this.scene.add(this.droneMesh.root);
    this.droneMesh.root.visible = false;

    // 7. Window resize handling
    window.addEventListener('resize', this.onWindowResize);

    // 8. Start Loop
    this.timer.reset();
    this.loop();
  }

  private setupLighting() {
    // Ambient tactical gloom
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
    this.scene.add(ambientLight);

    // Directional moonlight / sun angle
    const dirLight = new THREE.DirectionalLight(0xfef08a, 1.4);
    dirLight.position.set(25, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    this.scene.add(dirLight);

    // Compound interior mood lights
    const serverLight = new THREE.PointLight(0x06b6d4, 1.5, 18);
    serverLight.position.set(-6, 3.2, -6);
    this.scene.add(serverLight);

    const controlLight = new THREE.PointLight(0x38bdf8, 1.5, 18);
    controlLight.position.set(5, 7.4, 5);
    this.scene.add(controlLight);
  }

  // Load Map (Copper Yard, Harbor Relay, Old Metro)
  public loadMap(mapData: MapData) {
    this.currentMap = mapData;

    // Build environment props & compound
    this.environmentBuilder.buildExteriorAndInterior(85);

    // Initialize destructible and reinforceable walls
    this.destruction.initMapWalls(mapData.walls);

    // Initialize doors and windows with barricades
    this.destruction.initDoorsAndWindows(mapData.doorsAndWindows);

    // Initialize cameras
    this.cameras = mapData.cameras.map(c => ({ ...c }));

    // Initialize objectives
    this.objectives = mapData.objectives.map(o => ({ ...o }));
  }

  // Start 5v5 Match (Practice or Multiplayer)
  public startMatch(userTeam: Team = 'attackers', userSpecialistId: string = 'att_breach') {
    this.players = [];
    this.botAI.bots = [];
    this.botMeshes.forEach(m => this.scene.remove(m.root));
    this.botMeshes.clear();
    this.killFeed = [];

    // 1. Create Local Human Player
    const userOp = getOperator(userSpecialistId);
    const localPlayer: PlayerState = {
      id: this.localPlayerId,
      name: 'OPERATOR (YOU)',
      isBot: false,
      isLocalPlayer: true,
      team: userTeam,
      specialistId: userSpecialistId,
      primaryWeaponId: userOp.primaryWeapons[0],
      secondaryWeaponId: userOp.secondaryWeapons[0],
      health: 100,
      maxHealth: 100,
      armor: userOp.armor * 20,
      isAlive: true,
      isCrouched: false,
      leanAngle: 0,
      isAiming: false,
      isSprinting: false,
      isRappelling: false,
      isControllingDrone: false,
      isViewingCamera: false,
      kills: 0,
      deaths: 0,
      score: 0,
      ping: 18,
      pos: { x: 0, y: 0.2, z: 0 },
      rot: { yaw: 0, pitch: 0 },
      currentAmmo: WEAPONS[userOp.primaryWeapons[0]]?.magSize || 30,
      reserveAmmo: WEAPONS[userOp.primaryWeapons[0]]?.reserveAmmo || 150,
      abilityCharges: userOp.abilityCharges,
      abilityCooldownTimer: 0,
      reinforcedWallsRemaining: userTeam === 'defenders' ? 2 : 0,
      barricadesRemaining: userTeam === 'defenders' ? 3 : 0,
      droneActive: userTeam === 'attackers',
    };

    // Clean up previous PlayerController if it exists
    if (this.playerController) {
      this.playerController.destroy();
      this.playerController = null;
    }

    // Reset First Person Camera to local origin
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();

    // Spawn point for local player
    const spawnList = userTeam === 'attackers' ? this.currentMap.attackerSpawns : this.currentMap.defenderSpawns;
    const spawnPt = spawnList[0];
    localPlayer.pos = { x: spawnPt.x, y: spawnPt.y, z: spawnPt.z };

    // Initial look angle facing towards compound center (0, 0)
    const initialYaw = Math.atan2(-spawnPt.x, -spawnPt.z);
    localPlayer.rot.yaw = initialYaw;
    this.players.push(localPlayer);

    // Create First Person Arms & Weapon Rig
    if (this.firstPersonRig) {
      this.camera.remove(this.firstPersonRig.root);
    }
    const weaponType = WEAPONS[localPlayer.primaryWeaponId]?.type || 'assault_rifle';
    this.firstPersonRig = weaponMeshFactory.createFirstPersonRig(weaponType);
    this.camera.add(this.firstPersonRig.root);

    // Initialize PlayerController with correct initial yaw
    this.playerController = new PlayerController(this.camera, this.renderer.domElement, this.destruction, localPlayer);
    this.playerController.yawObject.rotation.y = initialYaw;
    this.scene.add(this.playerController.yawObject);

    // 2. Spawn 9 Tactical Bots (4 friendly teammates + 5 enemy squad)
    const availableAttackers = OPERATORS.filter(o => o.team === 'attackers' && o.id !== userSpecialistId);
    const availableDefenders = OPERATORS.filter(o => o.team === 'defenders' && o.id !== userSpecialistId);

    const friendlyTeam = userTeam;
    const enemyTeam = userTeam === 'attackers' ? 'defenders' : 'attackers';

    // 4 Teammates
    for (let i = 1; i <= 4; i++) {
      const opList = friendlyTeam === 'attackers' ? availableAttackers : availableDefenders;
      const botOp = opList[i % opList.length];
      const botSpawn = (friendlyTeam === 'attackers' ? this.currentMap.attackerSpawns : this.currentMap.defenderSpawns)[i % 4];

      this.createBotPlayer(`bot_team_${i}`, `SQUAD-${botOp.callsign.toUpperCase()}`, friendlyTeam, botOp, botSpawn);
    }

    // 5 Enemies
    for (let i = 0; i < 5; i++) {
      const opList = enemyTeam === 'attackers' ? availableAttackers : availableDefenders;
      const botOp = opList[i % opList.length];
      const botSpawn = (enemyTeam === 'attackers' ? this.currentMap.attackerSpawns : this.currentMap.defenderSpawns)[i % 4];

      this.createBotPlayer(`bot_enemy_${i}`, `HOSTILE-${botOp.callsign.toUpperCase()}`, enemyTeam, botOp, botSpawn);
    }

    // 3. Initialize Recon Drone (if attacker)
    if (userTeam === 'attackers') {
      this.localDrone = {
        id: 'drone_local',
        ownerId: this.localPlayerId,
        position: { x: spawnPt.x + 1.2, y: 0.15, z: spawnPt.z + 1.2 },
        rotation: { yaw: initialYaw, pitch: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        health: 100,
        battery: 100,
        isDestroyed: false,
      };
      if (this.droneMesh) {
        this.droneMesh.root.visible = true;
        this.droneMesh.root.position.set(this.localDrone.position.x, this.localDrone.position.y, this.localDrone.position.z);
        this.droneMesh.root.rotation.y = initialYaw;
      }
    } else {
      this.localDrone = null;
      if (this.droneMesh) {
        this.droneMesh.root.visible = false;
      }
    }

    // 4. Begin Recon / Prep Phase (30s countdown)
    this.matchPhase = 'drone_prep';
    this.phaseTimer = 25;
    this.isControllingDrone = userTeam === 'attackers';

    // Set first person weapon visibility according to initial drone state
    if (this.firstPersonRig) {
      this.firstPersonRig.root.visible = !this.isControllingDrone;
    }

    sound.playRadioPing(false);
    this.onStateChange?.();
  }

  private createBotPlayer(
    id: string,
    name: string,
    team: Team,
    op: typeof OPERATORS[0],
    spawn: { x: number; y: number; z: number }
  ) {
    const botPlayer: PlayerState = {
      id,
      name,
      isBot: true,
      isLocalPlayer: false,
      team,
      specialistId: op.id,
      primaryWeaponId: op.primaryWeapons[0],
      secondaryWeaponId: op.secondaryWeapons[0],
      health: 100,
      maxHealth: 100,
      armor: op.armor * 20,
      isAlive: true,
      isCrouched: false,
      leanAngle: 0,
      isAiming: false,
      isSprinting: false,
      isRappelling: false,
      isControllingDrone: false,
      isViewingCamera: false,
      kills: 0,
      deaths: 0,
      score: 0,
      ping: Math.floor(14 + Math.random() * 20),
      pos: { x: spawn.x + (Math.random() - 0.5) * 3, y: spawn.y, z: spawn.z + (Math.random() - 0.5) * 3 },
      rot: { yaw: 0, pitch: 0 },
      currentAmmo: WEAPONS[op.primaryWeapons[0]]?.magSize || 30,
      reserveAmmo: WEAPONS[op.primaryWeapons[0]]?.reserveAmmo || 150,
      abilityCharges: op.abilityCharges,
      abilityCooldownTimer: 0,
      reinforcedWallsRemaining: team === 'defenders' ? 2 : 0,
      barricadesRemaining: team === 'defenders' ? 3 : 0,
      droneActive: team === 'attackers',
    };

    // 3D character mesh
    const charMesh = weaponMeshFactory.createThirdPersonCharacter(team, op.color);
    charMesh.root.position.set(botPlayer.pos.x, botPlayer.pos.y, botPlayer.pos.z);
    this.scene.add(charMesh.root);
    this.botMeshes.set(id, charMesh);

    // Register with tactical AI system
    this.botAI.registerBot(botPlayer, charMesh.root, charMesh.weaponMount, charMesh.flashMesh);
    this.players.push(botPlayer);
  }

  // Skip prep phase or advance immediately to action phase
  public advanceToActionPhase() {
    this.matchPhase = 'action_phase';
    this.phaseTimer = 180; // 3 minutes round
    this.isControllingDrone = false;
    this.isViewingCCTV = false;

    if (this.droneMesh) {
      this.droneMesh.root.visible = false;
    }
    if (this.firstPersonRig) {
      this.firstPersonRig.root.visible = true;
    }

    sound.playRadioPing(false);
    this.onStateChange?.();
  }

  // Toggle CCTV camera surveillance feed (Defenders or Spectators)
  public toggleCCTV(enable?: boolean) {
    const nextState = enable !== undefined ? enable : !this.isViewingCCTV;
    this.isViewingCCTV = nextState;
    if (this.isViewingCCTV) {
      this.isControllingDrone = false;
      this.activeCCTVIndex = 0;
      sound.playRadioPing(false);
    }
    if (this.firstPersonRig) {
      this.firstPersonRig.root.visible = !this.isViewingCCTV && !this.isControllingDrone;
    }
    this.onStateChange?.();
  }

  public cycleCCTV(direction: 1 | -1 = 1) {
    if (this.cameras.length === 0) return;
    this.activeCCTVIndex = (this.activeCCTVIndex + direction + this.cameras.length) % this.cameras.length;
    sound.playRadioPing(false);
    this.onStateChange?.();
  }

  // Switch between Drone control and Player body
  public toggleDrone(enable?: boolean) {
    const local = this.getLocalPlayer();
    if (!local || local.team !== 'attackers') return;

    this.isControllingDrone = enable !== undefined ? enable : !this.isControllingDrone;
    if (this.droneMesh && this.localDrone) {
      this.droneMesh.root.visible = this.isControllingDrone;
    }
    if (this.firstPersonRig) {
      this.firstPersonRig.root.visible = !this.isControllingDrone && !this.isViewingCCTV;
    }
    this.onStateChange?.();
  }

  // Main Loop
  private loop = () => {
    this.animationFrameId = requestAnimationFrame(this.loop);
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.1);

    // Update Debris & world physics
    this.destruction.updateDebris(delta);

    // Update Bullet Tracers
    this.updateBulletTracers(delta);

    // Update Timers & Match State
    this.updateMatchLifecycle(delta);

    // Update Local Player Controller (Action phase, or Prep phase if not controlling drone)
    if (this.playerController && (this.matchPhase === 'action_phase' || !this.isControllingDrone)) {
      this.playerController.update(delta, (origin, dir) => {
        this.handlePlayerShoot(origin, dir);
      });
    }

    // Update Recon Drone physics if active
    if (this.isControllingDrone && this.localDrone && this.droneMesh) {
      this.updateDronePhysics(delta);
    }

    // Update Bot AI
    this.botAI.update(delta, this.matchPhase, this.players, (bot, targetHit, isHeadshot) => {
      this.handleBotShoot(bot, targetHit, isHeadshot);
    });

    // Update First Person Gun Animations (ADS, Recoil bobbing)
    this.updateFirstPersonRig(delta);

    // Render from correct perspective
    this.renderView();
  };

  private updateMatchLifecycle(delta: number) {
    if (this.matchPhase === 'drone_prep' || this.matchPhase === 'action_phase') {
      this.phaseTimer -= delta;

      // Check prep phase timeout
      if (this.matchPhase === 'drone_prep' && this.phaseTimer <= 0) {
        this.advanceToActionPhase();
      }

      // Check round timer expiration
      if (this.matchPhase === 'action_phase' && this.phaseTimer <= 0) {
        // Defenders win by time expiry if defuser is not planted
        if (!this.activeDefuserZone || this.activeDefuserZone.state !== 'armed') {
          this.endRound('defenders', 'Time expired - Defenders successfully denied compound');
        }
      }

      // Check elimination conditions
      const aliveAttackers = this.players.filter(p => p.team === 'attackers' && p.isAlive).length;
      const aliveDefenders = this.players.filter(p => p.team === 'defenders' && p.isAlive).length;

      if (aliveAttackers === 0 && this.matchPhase === 'action_phase') {
        // If defuser is already armed, defenders must still defuse it
        if (!this.activeDefuserZone || this.activeDefuserZone.state !== 'armed') {
          this.endRound('defenders', 'All Attackers Eliminated');
        }
      } else if (aliveDefenders === 0 && this.matchPhase === 'action_phase') {
        this.endRound('attackers', 'All Defenders Eliminated');
      }

      // Check Active Defuser timer
      if (this.activeDefuserZone && this.activeDefuserZone.state === 'armed') {
        this.activeDefuserZone.armedTimeRemaining -= delta;
        if (Math.floor(this.activeDefuserZone.armedTimeRemaining * 2) % 2 === 0) {
          sound.playDefuserTick(false);
        }
        if (this.activeDefuserZone.armedTimeRemaining <= 0) {
          // Defuser exploded! Attackers win
          this.destruction.explosiveBreach(new THREE.Vector3(this.activeDefuserZone.position.x, this.activeDefuserZone.position.y, this.activeDefuserZone.position.z), 12, true);
          this.endRound('attackers', 'Defuser Exploded - Objective Secured');
        }
      }
    }

    // Information decay for spotted enemy markers
    this.spottedEnemies.forEach((info, key) => {
      info.decayTime -= delta;
      if (info.decayTime <= 0) {
        this.spottedEnemies.delete(key);
      }
    });
  }

  // Handle Round Ending
  public endRound(winner: Team, reason: string) {
    if (this.matchPhase === 'round_end' || this.matchPhase === 'match_end') return;

    this.matchPhase = 'round_end';
    this.roundWinner = winner;
    this.winReason = reason;
    this.phaseTimer = 6;

    if (winner === 'attackers') this.attackerScore++;
    else this.defenderScore++;

    sound.playRadioPing(winner === this.getLocalPlayer()?.team);
    this.onStateChange?.();

    // Check match victory (first to 5 or side switch)
    setTimeout(() => {
      if (this.attackerScore >= 5 || this.defenderScore >= 5) {
        this.matchPhase = 'match_end';
      } else {
        this.roundNumber++;
        this.startMatch(this.getLocalPlayer()?.team || 'attackers', this.getLocalPlayer()?.specialistId || 'att_breach');
      }
      this.onStateChange?.();
    }, 6000);
  }

  // Update physical Recon Drone physics & controls
  private updateDronePhysics(delta: number) {
    if (!this.localDrone || !this.droneMesh || !this.playerController) return;

    const droneSpeed = 7.5;
    const turnSpeed = 2.8;

    // A = Turn Left, D = Turn Right
    if (this.playerController.keys['KeyA']) this.localDrone.rotation.yaw += turnSpeed * delta;
    if (this.playerController.keys['KeyD']) this.localDrone.rotation.yaw -= turnSpeed * delta;

    // W = Forward, S = Reverse
    let moveForward = 0;
    if (this.playerController.keys['KeyW']) moveForward += 1;
    if (this.playerController.keys['KeyS']) moveForward -= 0.6;

    const forwardDir = new THREE.Vector3(
      -Math.sin(this.localDrone.rotation.yaw),
      0,
      -Math.cos(this.localDrone.rotation.yaw)
    );

    const step = forwardDir.multiplyScalar(moveForward * droneSpeed * delta);
    const nextPos = new THREE.Vector3(
      this.localDrone.position.x + step.x,
      this.localDrone.position.y,
      this.localDrone.position.z + step.z
    );

    // Collision check with unbroken walls
    if (!this.destruction.checkPointCollision(nextPos, 0.2, 0.2)) {
      this.localDrone.position.x = nextPos.x;
      this.localDrone.position.z = nextPos.z;
    }

    // Space = Drone Jump / Mini-hop
    if (this.playerController.keys['Space'] && this.localDrone.position.y <= 0.16) {
      this.localDrone.velocity.y = 3.8;
      sound.playDroneHop();
    }

    // Drone gravity
    this.localDrone.velocity.y -= 9.8 * delta;
    this.localDrone.position.y += this.localDrone.velocity.y * delta;
    if (this.localDrone.position.y < 0.15) {
      this.localDrone.position.y = 0.15;
      this.localDrone.velocity.y = 0;
    }

    // Sync 3D mesh
    this.droneMesh.root.position.set(this.localDrone.position.x, this.localDrone.position.y, this.localDrone.position.z);
    this.droneMesh.root.rotation.y = this.localDrone.rotation.yaw;

    // Drone Battery consumption
    this.localDrone.battery = Math.max(0, this.localDrone.battery - delta * 1.5);

    // Scan for defenders in line of sight
    this.scanDroneVision();
  }

  // Drone camera line of sight scanner
  private scanDroneVision() {
    if (!this.localDrone) return;
    const dPos = new THREE.Vector3(this.localDrone.position.x, this.localDrone.position.y + 0.1, this.localDrone.position.z);

    for (const player of this.players) {
      if (!player.isAlive || player.team !== 'defenders') continue;

      const pPos = new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z);
      const dist = dPos.distanceTo(pPos);

      if (dist < 18) {
        // Line of sight check
        const dir = new THREE.Vector3().subVectors(pPos, dPos).normalize();
        const hit = this.destruction.checkRayCollision(dPos, dir, dist);

        if (!hit || hit.dist >= dist - 0.4) {
          // Spotted! Update decaying ping
          this.spottedEnemies.set(player.id, {
            x: player.pos.x,
            y: player.pos.y + 1.6,
            z: player.pos.z,
            decayTime: 5.0
          });
          sound.playRadioPing(true);
        }
      }
    }
  }

  // Player Gun Fire Raycasting & Damage Handling with Bullet Penetration
  private handlePlayerShoot(origin: THREE.Vector3, direction: THREE.Vector3) {
    const local = this.getLocalPlayer();
    if (!local) return;

    const weaponData = WEAPONS[local.primaryWeaponId] || WEAPONS['ar_commando'];

    // Muzzle flash on first person gun
    if (this.firstPersonRig) {
      this.firstPersonRig.muzzleFlash.visible = true;
      this.firstPersonRig.flashLight.intensity = 4;
      setTimeout(() => {
        if (this.firstPersonRig) {
          this.firstPersonRig.muzzleFlash.visible = false;
          this.firstPersonRig.flashLight.intensity = 0;
        }
      }, 50);
    }

    // Alert bot sound sensors
    this.botAI.alertSoundEvent(origin, local.team);

    let currentOrigin = origin.clone();
    let currentDir = direction.clone();
    let remainingDamage = weaponData.damage;
    let maxPenetrations = 3;
    let totalDistTraveled = 0;
    const maxRange = 80;

    for (let step = 0; step < maxPenetrations; step++) {
      const remainingRange = maxRange - totalDistTraveled;
      if (remainingRange <= 0.1 || remainingDamage <= 1) break;

      // 1. Raycast vs walls and barricades from the current origin
      const wallHit = this.destruction.checkRayCollision(currentOrigin, currentDir, remainingRange);

      // 2. Check for player hits between currentOrigin and the hit distance
      let hitPlayer: PlayerState | null = null;
      let stepHitDist = wallHit ? wallHit.dist : remainingRange;
      let isHeadshot = false;

      for (const target of this.players) {
        if (!target.isAlive || target.team === local.team || target.isLocalPlayer) continue;

        const targetPos = new THREE.Vector3(target.pos.x, target.pos.y + (target.isCrouched ? 0.7 : 1.1), target.pos.z);
        const toTarget = new THREE.Vector3().subVectors(targetPos, currentOrigin);
        const dist = toTarget.dot(currentDir);

        if (dist > 0 && dist < stepHitDist) {
          const perp = new THREE.Vector3().subVectors(toTarget, currentDir.clone().multiplyScalar(dist));
          if (perp.length() < 0.48) {
            stepHitDist = dist;
            hitPlayer = target;
            isHeadshot = Math.abs(targetPos.y + 0.45 - (currentOrigin.y + currentDir.y * dist)) < 0.22;
          }
        }
      }

      // Draw bullet tracer segment up to what was hit
      const tracerEndPoint = currentOrigin.clone().addScaledVector(currentDir, stepHitDist);
      this.createBulletTracer(currentOrigin, tracerEndPoint);

      totalDistTraveled += stepHitDist;

      if (hitPlayer) {
        // Bullet hit a player - apply remaining damage and stop
        const dmg = isHeadshot ? remainingDamage * 2.5 : remainingDamage;
        this.damagePlayer(hitPlayer, dmg, local, weaponData.name, isHeadshot);
        break;
      }

      if (wallHit) {
        let canPenetrate = false;

        if (wallHit.segmentId) {
          const seg = this.destruction.wallSegments.get(wallHit.segmentId);
          if (seg) {
            // Apply damage to wall
            this.destruction.damageSegment(wallHit.segmentId, remainingDamage, false, local.pos);

            // Drywall & wood are soft. Reinforced metal and concrete (structural) are hard.
            if (seg.material !== 'reinforced_metal' && seg.material !== 'structural') {
              canPenetrate = true;
            }
          }
        } else if (wallHit.doorId) {
          const item = this.destruction.doorsAndWindows.get(wallHit.doorId);
          if (item) {
            this.destruction.damageDoorOrWindow(wallHit.doorId, remainingDamage, local.pos);
            // Wooden barricades can be penetrated
            if (item.state === 'barricaded' || item.state === 'damaged') {
              canPenetrate = true;
            }
          }
        }

        if (canPenetrate) {
          // Bullet penetrates but damage is reduced by 30% for passing through a wall
          remainingDamage *= 0.70;

          // Push origin slightly forward past the wall to prevent hitting the exact same spot
          currentOrigin.copy(wallHit.point).addScaledVector(currentDir, 0.15);
        } else {
          // Hard surface blocked the bullet completely
          break;
        }
      } else {
        // Reached max range without hitting a wall or player
        break;
      }
    }
  }

  // Handle Bot Firing
  private handleBotShoot(bot: BotController, targetHit: PlayerState | null, isHeadshot: boolean) {
    const weaponData = WEAPONS[bot.player.primaryWeaponId] || WEAPONS['ar_commando'];
    const origin = new THREE.Vector3(bot.player.pos.x, bot.player.pos.y + 1.4, bot.player.pos.z);

    if (targetHit && targetHit.isAlive) {
      const targetPos = new THREE.Vector3(targetHit.pos.x, targetHit.pos.y + 1.2, targetHit.pos.z);
      this.createBulletTracer(origin, targetPos);
      const dmg = isHeadshot ? weaponData.damage * 2.2 : weaponData.damage;
      this.damagePlayer(targetHit, dmg, bot.player, weaponData.name, isHeadshot);
    } else {
      // Stray shot towards target
      const endPoint = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4));
      this.createBulletTracer(origin, endPoint);
    }
  }

  // Apply damage to player with armor reduction and death handling
  public damagePlayer(
    target: PlayerState,
    damage: number,
    killer: PlayerState,
    weaponName: string,
    isHeadshot: boolean
  ) {
    if (!target.isAlive) return;

    // Armor absorbs 25% of damage
    if (target.armor > 0) {
      const armorAbsorb = Math.min(target.armor, damage * 0.25);
      target.armor -= armorAbsorb;
      damage -= armorAbsorb;
    }

    target.health -= damage;

    if (target.health <= 0) {
      target.health = 0;
      target.isAlive = false;
      target.deaths++;
      killer.kills++;
      killer.score += isHeadshot ? 150 : 100;

      // Add to tactical killfeed
      this.killFeed.unshift({
        id: `kf_${Date.now()}_${Math.random()}`,
        killerName: killer.name,
        killerTeam: killer.team,
        victimName: target.name,
        victimTeam: target.team,
        weaponName,
        isHeadshot,
        timestamp: Date.now()
      });
      if (this.killFeed.length > 5) this.killFeed.pop();

      // Audio & mesh removal
      sound.playRadioPing(target.isLocalPlayer);
      const botMesh = this.botMeshes.get(target.id);
      if (botMesh) {
        // Fall to ground (ragdoll-like tip)
        botMesh.root.rotation.x = Math.PI / 2;
        botMesh.root.position.y = 0.15;
      }

      this.onStateChange?.();
    }
  }

  // Trigger Specialist Ability
  public triggerSpecialistAbility() {
    const local = this.getLocalPlayer();
    if (!local || !local.isAlive || local.abilityCharges <= 0) return;

    const op = getOperator(local.specialistId);
    local.abilityCharges--;
    sound.playRadioPing(false);

    // Ability-specific tactical execution
    const id = local.specialistId;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, local.rot.yaw, 0));
    const targetPos = new THREE.Vector3(local.pos.x, local.pos.y + 1.5, local.pos.z).addScaledVector(forward, 2.5);

    // Hard Breach abilities (Aces, Thermite, Hibana, Maverick)
    if (id === 'att_aces' || id === 'att_thermite' || id === 'att_hibana' || id === 'att_maverick' || id === 'att_breach') {
      sound.playExplosion(targetPos, local.pos);
      this.destruction.explosiveBreach(targetPos, 4.0, true, local.pos);
    }
    // Soft Breach & Demolition (Ashe, Buk, Fuze, Ram, Sled, Oryx)
    else if (id === 'att_ashe' || id === 'att_buk' || id === 'att_fuze' || id === 'att_ram' || id === 'att_sled' || id === 'def_oryx') {
      sound.playExplosion(targetPos, local.pos);
      this.destruction.explosiveBreach(targetPos, 3.4, false, local.pos);
    }
    // EMP & Electronic Disruption (Thatcher, Brava, Twitch, Flo, Kali, Dokka, Volt)
    else if (id === 'att_thatcher' || id === 'att_brava' || id === 'att_twitch' || id === 'att_flo' || id === 'att_kali' || id === 'att_dokka' || id === 'att_volt') {
      this.cameras.forEach(cam => {
        const cPos = new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z);
        if (cPos.distanceTo(new THREE.Vector3(local.pos.x, local.pos.y, local.pos.z)) < 28) {
          cam.isDestroyed = true;
        }
      });
      sound.playExplosion(local.pos, local.pos);
      // If Dokka, also ping defenders
      if (id === 'att_dokka') {
        for (const p of this.players) {
          if (p.team === 'defenders' && p.isAlive) {
            this.spottedEnemies.set(p.id, { x: p.pos.x, y: p.pos.y + 1.5, z: p.pos.z, decayTime: 8 });
          }
        }
      }
    }
    // Intel & Recon Scans (Lion, Jack, IQ, Glaze, Iana, Zero, Pulse, Solis, Caveira, Alibi, Specter)
    else if (id === 'att_lion' || id === 'att_jack' || id === 'att_iq' || id === 'att_glaze' || id === 'att_iana' || id === 'att_zero' || id === 'def_pulse' || id === 'def_solis' || id === 'def_caveira' || id === 'def_alibi' || id === 'att_specter') {
      const enemyTeam = local.team === 'attackers' ? 'defenders' : 'attackers';
      for (const p of this.players) {
        if (p.team === enemyTeam && p.isAlive) {
          const dist = new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z).distanceTo(new THREE.Vector3(local.pos.x, local.pos.y, local.pos.z));
          if (dist < 35) {
            this.spottedEnemies.set(p.id, { x: p.pos.x, y: p.pos.y + 1.5, z: p.pos.z, decayTime: 7 });
          }
        }
      }
      sound.playRadioPing(true);
    }
    // Medical & Adrenal Surge (Fink, Doc, Thunderbird, Rook)
    else if (id === 'att_fink' || id === 'def_doc' || id === 'def_thunderbird' || id === 'def_rook') {
      local.health = Math.min(local.maxHealth + 40, local.health + 60);
      local.armor = Math.min(100, local.armor + 50);
      // Apply boost to nearby teammates too
      for (const p of this.players) {
        if (p.team === local.team && p.isAlive) {
          p.health = Math.min(p.maxHealth + 25, p.health + 40);
          p.armor = Math.min(100, p.armor + 30);
        }
      }
      sound.playReloadSound();
    }
    // Flashes & Disorientation (Blitz, Ying, Clash, Echo, Ela)
    else if (id === 'att_blitz' || id === 'att_ying' || id === 'def_clash' || id === 'def_echo' || id === 'def_ela') {
      sound.playExplosion(targetPos, local.pos);
      const enemyTeam = local.team === 'attackers' ? 'defenders' : 'attackers';
      for (const p of this.players) {
        if (p.team === enemyTeam && p.isAlive) {
          const dist = new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z).distanceTo(new THREE.Vector3(local.pos.x, local.pos.y, local.pos.z));
          if (dist < 14) {
            // Damage and disorient
            p.health = Math.max(1, p.health - 20);
            this.spottedEnemies.set(p.id, { x: p.pos.x, y: p.pos.y + 1.5, z: p.pos.z, decayTime: 5 });
          }
        }
      }
    }
    // Defensive Barricades & Site Hardening (Castle, Azami, Aruni, Bandit, Kaid, Kapkan, Frost, Smoke, Goyo, Tachanka, Thorn, Tubarao)
    else if (id.startsWith('def_')) {
      // Find nearest door or window within 4m to reinforce/armor
      let nearestDW: any = null;
      let minDist = 4.0;
      for (const dw of this.destruction.doorsAndWindows.values()) {
        const dPos = new THREE.Vector3(dw.position.x, dw.position.y, dw.position.z);
        const dist = dPos.distanceTo(new THREE.Vector3(local.pos.x, local.pos.y, local.pos.z));
        if (dist < minDist) {
          minDist = dist;
          nearestDW = dw;
        }
      }
      if (nearestDW) {
        nearestDW.state = 'barricaded';
        nearestDW.health = id === 'def_castle' ? 600 : 350;
        sound.playBarricadeHit(targetPos, local.pos);
      } else {
        // Place area denial or explosive barrier trap
        sound.playBarricadeHit(targetPos, local.pos);
        this.destruction.explosiveBreach(targetPos, 2.0, false, local.pos);
      }
    }
    // Deployable Cameras (Valkyrie, Maestro)
    else if (id === 'def_valkyrie' || id === 'def_maestro') {
      this.cameras.push({
        id: `cam_deployable_${Date.now()}`,
        name: id === 'def_maestro' ? 'EVIL EYE LASER' : 'BLACK EYE 360',
        team: 'defenders',
        position: { x: targetPos.x, y: targetPos.y + 1.2, z: targetPos.z },
        rotation: { yaw: local.rot.yaw + Math.PI, pitch: -0.2 },
        health: 150,
        isDestroyed: false,
        isStaticCCTV: false
      });
      sound.playBarricadeHit(targetPos, local.pos);
    }
    else {
      // General tactical breach charge
      sound.playExplosion(targetPos, local.pos);
      this.destruction.explosiveBreach(targetPos, 3.2, false, local.pos);
    }

    this.onStateChange?.();
  }

  // Plant or Defuse Bomb / Defuser
  public updateObjectiveInteraction(delta: number, isInteracting: boolean) {
    const local = this.getLocalPlayer();
    if (!local || !local.isAlive || this.matchPhase !== 'action_phase') return;

    const pPos = new THREE.Vector3(local.pos.x, local.pos.y, local.pos.z);

    // Attackers plant in Site A or Site B
    if (local.team === 'attackers') {
      for (const obj of this.objectives) {
        const oPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
        if (pPos.distanceTo(oPos) <= obj.radius && obj.state === 'neutral') {
          if (isInteracting) {
            this.isPlantingDefuser = true;
            this.defuserInteractionProgress += delta * 25; // 4 seconds to plant
            sound.playDefuserTick(true);

            if (this.defuserInteractionProgress >= 100) {
              obj.state = 'armed';
              obj.armedTimeRemaining = 45;
              this.activeDefuserZone = obj;
              this.defuserInteractionProgress = 0;
              this.isPlantingDefuser = false;
              sound.playRadioPing(false);
            }
          } else {
            this.isPlantingDefuser = false;
            this.defuserInteractionProgress = 0;
          }
          return;
        }
      }
    } else {
      // Defenders defuse armed defuser
      if (this.activeDefuserZone && this.activeDefuserZone.state === 'armed') {
        const oPos = new THREE.Vector3(this.activeDefuserZone.position.x, this.activeDefuserZone.position.y, this.activeDefuserZone.position.z);
        if (pPos.distanceTo(oPos) <= this.activeDefuserZone.radius + 1.5) {
          if (isInteracting) {
            this.isDisarmingDefuser = true;
            this.defuserInteractionProgress += delta * 20; // 5 seconds to defuse
            sound.playDefuserTick(true);

            if (this.defuserInteractionProgress >= 100) {
              this.activeDefuserZone.state = 'defused';
              this.endRound('defenders', 'Defuser Disabled - Defenders Retake Compound');
            }
          } else {
            this.isDisarmingDefuser = false;
            this.defuserInteractionProgress = 0;
          }
        }
      }
    }
  }

  // Create high-velocity glowing yellow bullet tracer
  private createBulletTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const points = [start, end];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xfde047, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bulletTracers.push({ mesh: line, lifetime: 0.08 });
  }

  private updateBulletTracers(delta: number) {
    for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
      const t = this.bulletTracers[i];
      t.lifetime -= delta;
      if (t.lifetime <= 0) {
        this.scene.remove(t.mesh);
        this.bulletTracers.splice(i, 1);
      }
    }
  }

  // First person arms & weapon positioning
  private updateFirstPersonRig(delta: number) {
    if (!this.firstPersonRig || !this.playerController) return;

    const local = this.getLocalPlayer();
    if (!local) return;

    const targetPos = local.isAiming
      ? this.firstPersonRig.adsOffset
      : this.firstPersonRig.hipOffset;

    // Smooth ADS transition
    this.firstPersonRig.weaponGroup.position.lerp(targetPos, delta * 16);

    // Procedural weapon sway during movement
    if (this.playerController.keys['KeyW'] || this.playerController.keys['KeyS']) {
      const bob = Math.sin(Date.now() * 0.01) * (local.isAiming ? 0.002 : 0.008);
      this.firstPersonRig.weaponGroup.position.y += bob;
    }
  }

  // Render Scene from appropriate camera
  private renderView() {
    const local = this.getLocalPlayer();

    if (this.isViewingCCTV && this.cctvCamera && this.cameras.length > 0) {
      // CCTV camera surveillance feed
      if (this.firstPersonRig) this.firstPersonRig.root.visible = false;
      const activeCam = this.cameras[this.activeCCTVIndex];
      this.cctvCamera.position.set(activeCam.position.x, activeCam.position.y, activeCam.position.z);
      this.cctvCamera.rotation.set(activeCam.rotation.pitch, activeCam.rotation.yaw, 0, 'YXZ');
      this.renderer.render(this.scene, this.cctvCamera);
    } else if (this.isControllingDrone && this.localDrone && this.droneCamera) {
      // Recon Drone Camera Feed (Independent camera at drone world position)
      if (this.firstPersonRig) this.firstPersonRig.root.visible = false;
      this.droneCamera.position.set(this.localDrone.position.x, this.localDrone.position.y + 0.22, this.localDrone.position.z);
      this.droneCamera.rotation.set(-0.15, this.localDrone.rotation.yaw, 0, 'YXZ');
      this.renderer.render(this.scene, this.droneCamera);
    } else if (local && !local.isAlive) {
      // Spectator Mode: follow living teammate
      if (this.firstPersonRig) this.firstPersonRig.root.visible = false;
      const livingTeammates = this.players.filter(p => p.team === local.team && p.isAlive);
      if (livingTeammates.length > 0) {
        const target = livingTeammates[this.spectatorIndex % livingTeammates.length];
        this.camera.position.set(target.pos.x, target.pos.y + 1.7, target.pos.z);
        this.camera.rotation.set(target.rot.pitch, target.rot.yaw, 0, 'YXZ');
      }
      this.renderer.render(this.scene, this.camera);
    } else {
      // Normal First-Person Player View
      if (this.firstPersonRig) this.firstPersonRig.root.visible = true;
      this.renderer.render(this.scene, this.camera);
    }
  }

  public cycleSpectator(direction: 1 | -1 = 1) {
    const local = this.getLocalPlayer();
    if (!local || local.isAlive) return;
    const living = this.players.filter(p => p.team === local.team && p.isAlive);
    if (living.length > 0) {
      this.spectatorIndex = (this.spectatorIndex + direction + living.length) % living.length;
      this.onStateChange?.();
    }
  }

  public getLocalPlayer(): PlayerState | undefined {
    return this.players.find(p => p.id === this.localPlayerId);
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.cctvCamera) {
      this.cctvCamera.aspect = w / h;
      this.cctvCamera.updateProjectionMatrix();
    }
    if (this.droneCamera) {
      this.droneCamera.aspect = w / h;
      this.droneCamera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h);
  };

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}
