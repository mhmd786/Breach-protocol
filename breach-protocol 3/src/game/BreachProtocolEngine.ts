import * as THREE from 'three';
import {
  OperatorDef,
  WeaponDef,
  MapData,
  Collider,
  Personality,
  OPERATORS,
  ATTACKERS,
  DEFENDERS,
  WEAPONS,
  PERSONALITY_TYPES,
  getOperatorById,
  getRecommendedWeaponIndex
} from './BreachProtocol';
import { ModelFactory } from './ModelFactory';
import { HouseMapBuilder, DestructibleBarricade, RappelWall, ColliderAABB } from './HouseMap';
import { ReconDrone } from './ReconDrone';
import { gadgetSystem, ActiveGadget } from './GadgetSystem';
import { sound as audioSystem } from '../audio/SoundEngine';
import { navGraph } from './Pathfinding';
import { networkClient } from './NetworkClient';

export interface BotUnit {
  id: string;
  mesh: THREE.Group;
  torsoGroup: THREE.Group;
  armsGroup: THREE.Group;
  weaponGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hitMesh: THREE.Mesh;
  marker: THREE.Mesh;
  op: OperatorDef;
  side: 'atk' | 'def';
  isMate: boolean;
  hp: number;
  alive: boolean;
  target: THREE.Vector3;
  fireT: number;
  stunned: number;
  aimSkill: number;
  personality: Personality;
  walkCycle: number;
  recoilKick: number;
  memory: {
    lastKnownPos: THREE.Vector3 | null;
    lastKnownTime: number;
    lastHeardPos: THREE.Vector3 | null;
    lastHeardTime: number;
    confidence: number;
  };
  state: 'HOLD' | 'SUSPICIOUS' | 'INVESTIGATE' | 'ENGAGE' | 'RETREAT';
  nextThink: number;
  moveGoal: THREE.Vector3;
  mistakeChance: number;
  leanState: number;
  leanAmount: number;
  peekSide: number;
  peekTimer: number;
  peekCooldown: number;
  lastPeekOrigin: THREE.Vector3 | null;
  lastCalloutTime?: number;
  gadgetCooldown?: number;
  gadgetCharges?: number;
  hasPlacedPrepGadget?: boolean;
  assignedRole?: 'anchor' | 'roamer' | 'breacher' | 'support' | 'entry';
  pathWaypoints?: THREE.Vector3[];
  pathIndex?: number;
  burstShotsLeft?: number;
  // Added for operator-ability parity: mirrors the equivalent player-side fields
  // (this.player.shielded / this.player.cloaked) so bots get the same mechanical effect.
  shielded?: boolean;
  cloaked?: boolean;
  speedBoost?: number;
}

export interface PlacedBreachCharge {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  targetBarricade: DestructibleBarricade | null;
  placedByPlayer: boolean;
}

export interface MatchConfig {
  mapKey: string;
  roundsToWin: number;
  difficulty: string;
  operator: OperatorDef;
  weaponIdx: number;
  lanUrl?: string;
  playerName?: string;
  roomId?: string;
  enableLan?: boolean;
  spawnIndex?: number;
}

export interface GameStatus {
  renderer: string;
  scene: string;
  camera: string;
  map: string;
  player: string;
  weapon: string;
  operator: string;
  ai: string;
  input: string;
  loop: string;
  fps: number;
  lastError: string | null;
}

export class BreachProtocolEngine {
  public container: HTMLElement;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;
  public timer: THREE.Timer = new THREE.Timer();

  // Diagnostics & Status
  public status: GameStatus = {
    renderer: 'not started',
    scene: 'not started',
    camera: 'not started',
    map: 'not started',
    player: 'not started',
    weapon: 'not started',
    operator: 'not started',
    ai: 'not started',
    input: 'not started',
    loop: 'not started',
    fps: 0,
    lastError: null
  };
  public diagPanelOn: boolean = false;

  // Game state
  public started: boolean = false;
  public running: boolean = false;
  private animId: number | null = null;

  public player = {
    pos: new THREE.Vector3(0, 1.7, 0),
    vel: new THREE.Vector3(),
    vy: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    alive: true,
    sprint: false,
    op: OPERATORS[0] as OperatorDef,
    weaponIdx: 0,
    ammoInMag: {} as Record<string, number>,
    ammoReserve: {} as Record<string, number>,
    reloading: false,
    reloadT: 0,
    abilityCooldown: 0,
    abilityActive: false,
    side: 'atk' as 'atk' | 'def',
    leanState: 0,
    leanAmount: 0,
    crouching: false,
    currentLeanAmount: 0,
    focusZoom: false,
    speedBoost: 1,
    ramming: false,
    shielded: false,
    cloaked: false,
    // Flash/concussion disorientation — was previously only ever written by GadgetSystem's
    // welcome_mat/airjab_mine effects (engine.player.stunned = X) but never declared here or
    // read anywhere, so stepping on a Frost trap or getting hit by an Airjab mine (or any
    // flashbang, which didn't touch the player at all) never actually impaired the player.
    // Now decremented in updateMovement() and checked there (movement) and in tryFire()
    // (firing) so it has a real, felt effect.
    stunned: 0,
    // Rappelling State
    isRappelling: false,
    rappelWall: null as RappelWall | null,
    rappelHeight: 1.7,
    rappelLateral: 0,
    rappelCableMesh: null as THREE.Line | null,
    // Breaching State
    breachChargesLeft: 2,
    activeBreachCharge: null as PlacedBreachCharge | null,
    // Tactical Gadget States
    gadgetCharges: 2,
    activeGadgetType: '',
    isThermalVision: false,
    isCardiacSensor: false,
    isElectronicsDetector: false,
    isFullShieldExtended: false,
    isSilencedFootsteps: false,
    isLionScanning: false,
    isDokkaebiRinging: false,
  };

  public LEAN_OFFSET_X = 0.55;
  public LEAN_OFFSET_Y = -0.04;
  public LEAN_ROTATION = 0.12;
  public LEAN_TRANSITION_SPEED = 9;
  public PLAYER_RADIUS = 0.4;
  public PLAYER_H = 1.7;

  public match = {
    round: 1,
    roundsToWin: 4,
    scoreAtk: 0,
    scoreDef: 0,
    phase: 'prep' as 'prep' | 'action' | 'result' | 'matchover',
    phaseTimer: 25,
    actionLength: 120,
    prepLength: 25,
    resultLength: 3.2,
    secureTimer: 0,
    secureNeeded: 5,
    secureRadius: 3.2,
    defuserPlanted: false,
    defuseProgress: 0,
    plantProgress: 0,
    defuserTimer: 45.0,
    defuserPos: null as THREE.Vector3 | null,
    defuserMesh: null as THREE.Group | null,
    defuserCarrier: null as string | null,
    defuserDropped: false,
    winner: null as 'atk' | 'def' | null
  };

  // Recon Drone & Visual Atmosphere
  public drone: ReconDrone | null = null;
  public inDroneMode: boolean = false;
  public droneSpottedEnemies: Set<string> = new Set();
  public isHoldingThrow: boolean = false;
  // Set by toggleHeldGadget() (Tab) when an attacker equips a breach charge into their hands
  // instead of instantly slapping it onto the nearest wall with [B] — left-click then plants
  // it wherever they're aiming, same as G-held cameras.
  public holdingBreachCharge: boolean = false;
  public trajectoryPoints: THREE.Mesh[] = [];
  public spottedEnemies: Map<string, { x: number; y: number; z: number; decayTime: number }> = new Map();
  public droneSpottedObjective: boolean = false;
  public dronesReserve: number = 1;
  public animatedLights: THREE.PointLight[] = [];

  public colliders: ColliderAABB[] = [];
  public barricades: DestructibleBarricade[] = [];
  public rappelWalls: RappelWall[] = [];
  public objectivePos = new THREE.Vector3(6.0, 3.45, 0);

  public securityCameras: Array<{
    id: string;
    name: string;
    pos: THREE.Vector3;
    rot: { yaw: number; pitch: number };
    mesh: THREE.Group;
    hitMesh: THREE.Mesh;
    ledMat: THREE.MeshBasicMaterial;
    hp: number;
    isDestroyed: boolean;
    isMaestro?: boolean;
    empDisabledUntil?: number;
  }> = [];

  public throwableGrenades: Array<{
    id: string;
    type: 'frag' | 'flash' | 'smoke' | 'emp' | 'selma' | 'valkyrie_cam' | 'maestro_cam';
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    mesh: THREE.Mesh;
    life: number;
    ownerSide: 'atk' | 'def';
    hitNormal?: THREE.Vector3;
  }> = [];

  public wallhackPingGroup: THREE.Group = new THREE.Group();

  public activeTraps: { mesh: THREE.Mesh; pos: THREE.Vector3; owner: 'atk' | 'def' }[] = [];
  public activeTurrets: { mesh: THREE.Mesh; pos: THREE.Vector3; life: number; fireT: number; owner: 'atk' | 'def' }[] = [];
  public activeSensors: { pos: THREE.Vector3; life: number }[] = [];
  public bots: BotUnit[] = [];
  public bulletTracers: { line: THREE.Line; life: number }[] = [];
  public impactBursts: { points: THREE.Points; vel: THREE.Vector3[]; life: number; maxLife: number }[] = [];
  public debrisPieces: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3; life: number }[] = [];

  public difficulty: string = 'Normal';
  public currentMapKey: string = 'suburban_house';
  public mapSpawnsAtk: [number, number][] = [[0, -24]];
  public mapSpawnsDef: [number, number][] = [[-5, -1]];
  // Which of the map's spawn points the human player picked in the draft/loadout screen.
  // Clamped against the actual array length each round, since attacker/defender spawn
  // lists aren't always the same length and the player's side can swap between rounds.
  public preferredSpawnIndex: number = 0;
  // Delayed gadget-effect timers (multi-stage breaches, timed intel reveals, status effects
  // that read live game state at fire time) — tracked so clearRoundEntities() can cancel any
  // still pending when a round ends, instead of letting them fire into the next round.
  public pendingRoundTimeouts: number[] = [];
  public keys: Record<string, boolean> = {};

  // Camera screen shake
  public screenShakeIntensity: number = 0;
  // Flashbang whiteout: 1.0 right when blinded, fades to 0 over a few seconds. Read by the
  // React HUD (via getHudState()) to render a fading white overlay in sync with player.stunned.
  public flashWhiteout: number = 0;

  // Viewmodel
  public viewmodelGroup!: THREE.Group;
  public viewmodelWeapon!: THREE.Group;
  public viewmodelFlash!: THREE.Sprite;
  public viewmodelBarrelTip!: THREE.Object3D;
  public gadgetViewmodelGroup?: THREE.Group;
  // True while the mouse is held down with a throwable/placeable gadget equipped — shows the
  // trajectory arc or placement decal, and the actual throw/plant only happens on release.
  public isAimingThrow: boolean = false;
  public breachPreviewMesh?: THREE.Mesh;
  // Tracks which model is currently built into gadgetViewmodelGroup so updateGadgetViewmodel()
  // only rebuilds the rig when the held item actually changes kind (camera vs breach charge).
  private heldGadgetKind: 'camera' | 'breach_charge' | null = null;
  public viewmodelBob: number = 0;
  public viewmodelKick: number = 0;

  public muzzleLight!: THREE.PointLight;
  public objectiveMesh!: THREE.Mesh;

  // LAN Multiplayer
  public lanSocket: WebSocket | null = null;
  public lanId: string | null = null;
  public remotePlayers: Record<string, { mesh: THREE.Mesh | THREE.Group; targetPos: THREE.Vector3; targetYaw: number }> = {};

  // Audio Context
  private audioCtx: AudioContext | null = null;
  private footstepTimer: number = 0;
  private lastShot: number = 0;
  private lastMelee: number = 0;
  public isFiring: boolean = false;

  // Callbacks for UI sync
  public onStateUpdate?: () => void;
  public onLogMessage?: (msg: string) => void;
  public onMatchOver?: (winner: string, score: string) => void;
  public onToggleLoadoutMenu?: () => void;
  // Fired when the engine needs the loadout modal FORCED open (side swap) — distinct from
  // onToggleLoadoutMenu (bound to the [N] toggle key), since a toggle could accidentally
  // close the modal if it happened to already be open when a round starts.
  public onForceLoadoutOpen?: () => void;
  // Fired whenever the engine changes the player's operator/weapon on its own initiative
  // (currently: the mid-match side swap in beginRound()). Without this, the React side's
  // `selectedOp` / `selectedWeaponIdx` state goes stale after an automatic swap — the
  // loadout modal would keep highlighting the pre-swap operator even though the engine
  // (and currentRoundSide filter) has already moved on.
  public onOperatorChanged?: (op: OperatorDef, weaponIdx: number) => void;

  // The side the player started the match on, before any mid-match side swap. Anchor for
  // computing which side they should be on for any given round — see beginRound().
  private startingPlayerSide: 'atk' | 'def' | null = null;

  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnResize: () => void;

  public sideCallouts: {
    atk: { pos: THREE.Vector3; time: number; confidence: number } | null;
    def: { pos: THREE.Vector3; time: number; confidence: number } | null;
  } = {
    atk: null,
    def: null
  };

  constructor(container: HTMLElement) {
    this.container = container;

    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnResize = this.onResize.bind(this);
  }

  // ---------- SOUND SYNTHESIZER ----------
  public sfx(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08) {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const t0 = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    } catch {
      // Best-effort audio; ignore errors
    }
  }

  public sound = {
    shot: () => this.sfx(190, 0.06, 'sawtooth', 0.07),
    reload: () => this.sfx(340, 0.12, 'sine', 0.06),
    hit: () => this.sfx(90, 0.08, 'sawtooth', 0.08),
    roundStart: () => this.sfx(440, 0.2, 'triangle', 0.1),
    roundWin: () => this.sfx(660, 0.35, 'triangle', 0.12),
    roundLoss: () => this.sfx(160, 0.4, 'sawtooth', 0.1),
    secure: () => this.sfx(520, 0.15, 'sine', 0.08),
    breachPlant: () => this.sfx(880, 0.08, 'sine', 0.09),
    breachExplode: () => {
      this.sfx(60, 0.6, 'sawtooth', 0.35);
      this.scheduleTimeout(() => this.sfx(120, 0.4, 'square', 0.25), 30);
    },
    rappelHook: () => this.sfx(700, 0.15, 'triangle', 0.09),
    woodSnap: () => this.sfx(150, 0.1, 'square', 0.1),
    pingHostile: () => {
      this.sfx(880, 0.1, 'sine', 0.12);
      this.scheduleTimeout(() => this.sfx(1100, 0.12, 'sine', 0.14), 80);
    },
    pingObjective: () => {
      this.sfx(600, 0.12, 'triangle', 0.12);
      this.scheduleTimeout(() => this.sfx(900, 0.15, 'triangle', 0.14), 100);
      this.scheduleTimeout(() => this.sfx(1200, 0.2, 'triangle', 0.15), 220);
    },
    customTone: (freq: number, dur: number, type: OscillatorType = 'triangle') => this.sfx(freq, dur, type, 0.08),
    playEmpDischarge: () => audioSystem.playEmpDischarge(),
    playSledgeSmash: () => audioSystem.playSledgeSmash(),
    playShockZap: () => audioSystem.playShockZap(),
    playGadgetDeploy: () => audioSystem.playGadgetDeploy(),
    playPhoneBuzz: () => audioSystem.playPhoneBuzz(),
    playGasHiss: (dur?: number) => audioSystem.playGasHiss(dur),
    playHeartbeat: () => audioSystem.playHeartbeat(),
    playFlashbang: () => audioSystem.playFlashbang(),
    playCameraClick: () => this.sfx(880, 0.06, 'sine', 0.12),
    playReloadSound: () => audioSystem.playReloadSound()
  };

  public log(msg: string) {
    if (this.onLogMessage) {
      this.onLogMessage(msg);
    }
  }

  public pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  public currentWeapon(): WeaponDef {
    return WEAPONS[this.player.weaponIdx] || WEAPONS[0];
  }

  // ---------------------------------------------------------------------
  // 1. MATCH START & ROUNDS (NO DRONING PHASE)
  // ---------------------------------------------------------------------
  public startMatch(config: MatchConfig) {
    this.currentMapKey = config.mapKey || 'suburban_house';
    this.match.roundsToWin = config.roundsToWin || 4;
    this.difficulty = config.difficulty || 'Normal';
    this.preferredSpawnIndex = config.spawnIndex ?? 0;
    this.match.round = 1;
    this.match.scoreAtk = 0;
    this.match.scoreDef = 0;
    this.match.winner = null;

    this.player.op = config.operator;
    this.startingPlayerSide = config.operator.side;
    if (this.player.op.id === 'glaz') {
      this.player.weaponIdx = 0;
    } else {
      this.player.weaponIdx = config.weaponIdx;
    }

    const mapNames: Record<string, string> = {
      suburban_house: 'Suburban Villa',
      warehouse: 'Warehouse District',
      office_tower: 'Office Tower'
    };
    this.status.map = mapNames[this.currentMapKey] || 'Suburban Villa';
    this.status.operator = this.player.op.name;
    this.status.weapon = WEAPONS[this.player.weaponIdx].name;

    this.initScene();
    gadgetSystem.init(this.scene);
    networkClient.init(this.scene, this);
    this.started = true;
    this.running = true;

    if (config.enableLan !== false) {
      networkClient.connect(
        config.roomId || 'default',
        config.playerName || 'Operator',
        config.operator.side,
        config.operator.id
      );
    } else if (config.lanUrl) {
      this.connectLAN(config.lanUrl);
    }

    this.beginRound();
    this.animate();

    try {
      this.renderer.domElement.requestPointerLock();
    } catch {
      // Will lock on first user click
    }
  }

  public setOperatorAndWeapon(op: OperatorDef, weaponIdx: number) {
    this.player.op = op;
    if (op.id === 'glaz') {
      this.player.weaponIdx = 0;
    } else {
      this.player.weaponIdx = weaponIdx;
    }
    this.status.operator = op.name;
    this.status.weapon = WEAPONS[this.player.weaponIdx].name;
    this.player.gadgetCharges = op.charges || 2;
    this.player.activeGadgetType = op.gadgetType || 'generic';
    this.player.side = op.side;

    this.initFirstPersonRig();
    this.log(`[IN-GAME LOADOUT] Equipped ${op.name} (${op.side.toUpperCase()} · ${op.role}) with ${WEAPONS[this.player.weaponIdx].name}.`);
    this.onStateUpdate?.();
  }

  public playerSideThisRound(): 'atk' | 'def' {
    return this.player.op.side || 'atk';
  }

  public clearRoundEntities() {
    // Cancel any delayed gadget effects still in flight from the previous round (e.g. Ace's
    // multi-stage SELMA breach, Thermite/Fuze's delayed detonations, timed intel reveals).
    // These read live state (this.bots, this.barricades) at fire time, so if they're still
    // pending when a new round starts — which rebuilds bots/barricades from scratch — they'd
    // damage freshly spawned bots or breach the new round's walls out of nowhere, sometimes
    // ending the brand new round before it properly began. That's the "gadget crashes round" bug.
    this.pendingRoundTimeouts.forEach(id => clearTimeout(id));
    this.pendingRoundTimeouts = [];

    // Every entry here is round-local. Clear both scene objects and their owning arrays
    // so the next map cannot retain invisible effects/colliders or stale camera references.
    this.throwableGrenades.forEach(g => this.scene.remove(g.mesh));
    this.throwableGrenades = [];
    this.bulletTracers.forEach(t => this.scene.remove(t.line));
    this.bulletTracers = [];
    this.impactBursts.forEach(b => this.scene.remove(b.points));
    this.impactBursts = [];
    this.securityCameras.forEach(camera => { this.scene.remove(camera.mesh); this.scene.remove(camera.hitMesh); });
    this.securityCameras = [];
    this.inCctvMode = false;
    this.activeCctvIndex = 0;
    this.bots.forEach(b => {
      this.scene.remove(b.mesh);
      this.scene.remove(b.marker);
    });
    this.bots = [];
    this.sideCallouts.atk = null;
    this.sideCallouts.def = null;
    this.activeTraps.forEach(t => this.scene.remove(t.mesh));
    this.activeTraps = [];
    this.activeTurrets.forEach(t => this.scene.remove(t.mesh));
    this.activeTurrets = [];
    this.activeSensors = [];
    this.debrisPieces.forEach(d => this.scene.remove(d.mesh));
    this.debrisPieces = [];

    if (this.match.defuserMesh) {
      this.scene.remove(this.match.defuserMesh);
      this.match.defuserMesh = null;
    }

    if (this.drone) {
      this.scene.remove(this.drone.mesh);
      this.drone = null;
    }
    this.inDroneMode = false;
    this.droneSpottedEnemies.clear();
    this.droneSpottedObjective = false;

    if (this.player.activeBreachCharge) {
      this.scene.remove(this.player.activeBreachCharge.mesh);
      this.player.activeBreachCharge = null;
    }
    if (this.player.rappelCableMesh) {
      this.scene.remove(this.player.rappelCableMesh);
      this.player.rappelCableMesh = null;
    }
    this.player.isRappelling = false;
    this.player.vel.set(0, 0, 0);
    this.player.vy = 0;
    this.player.speedBoost = 1;
    this.player.focusZoom = false;
    this.player.reloading = false;
    this.player.reloadT = 0;

    // Clean up trajectory points
    this.trajectoryPoints.forEach(m => {
      if (m) {
        try { m.visible = false; this.scene.remove(m); } catch {}
        try { if (m.geometry) m.geometry.dispose(); } catch {}
        if (m.material) {
          try {
            if (Array.isArray(m.material)) {
              m.material.forEach(mat => mat.dispose());
            } else {
              m.material.dispose();
            }
          } catch {}
        }
      }
    });
    this.trajectoryPoints = [];
  }

  public beginRound() {
    this.clearRoundEntities();

    // Classic best-of-N side swap. advanceMatch() runs the match for roundsToWin*2-1
    // total rounds — that math only makes sense if both teams get an equal share of
    // rounds on each side, swapping once at the halfway point (round roundsToWin+1).
    // Previously nothing drove that: playerSideThisRound() just echoed the operator's
    // fixed side forever, so the player played the ENTIRE match on their starting side.
    // The in-game loadout modal (InGameLoadoutModal.tsx) already filters its operator
    // list by currentRoundSide and expects to be reopened when that side changes — it
    // just never had anything triggering it. This is what drives it.
    if (this.startingPlayerSide) {
      const swapRound = this.match.roundsToWin + 1;
      const expectedSide: 'atk' | 'def' = this.match.round >= swapRound
        ? (this.startingPlayerSide === 'atk' ? 'def' : 'atk')
        : this.startingPlayerSide;

      if (this.player.op.side !== expectedSide) {
        const roster = expectedSide === 'atk' ? ATTACKERS : DEFENDERS;
        // Temporarily equip a valid operator for the new side so the engine is never in
        // an invalid state (player.op.side must always match player.side) — the player
        // then picks their actual loadout from the modal opened below.
        const fallbackOp = roster[0];
        this.log(`SIDES HAVE SWAPPED! You are now on ${expectedSide === 'atk' ? 'ATTACK' : 'DEFENSE'}. Auto-equipped ${fallbackOp.name} — pick your operator for this side.`);
        // Route through the same setter the manual loadout picker uses, rather than
        // duplicating its field assignments here — that setter also rebuilds the
        // first-person viewmodel rig for the new operator/weapon, which a plain field
        // assignment would silently skip (leaving the old operator's arms/gun visible).
        this.setOperatorAndWeapon(fallbackOp, getRecommendedWeaponIndex(fallbackOp));
        this.onOperatorChanged?.(fallbackOp, this.player.weaponIdx);
        // Force the loadout modal open so the player actually chooses their operator for
        // the new side instead of being stuck with the roster default.
        this.onForceLoadoutOpen?.();
      }
    }

    this.player.side = this.playerSideThisRound();
    WEAPONS.forEach(w => {
      this.player.ammoInMag[w.id] = w.mag;
      this.player.ammoReserve[w.id] = w.reserve;
    });
    this.player.hp = 100;
    this.player.alive = true;
    this.player.abilityCooldown = 0;
    this.player.leanState = 0;
    this.player.leanAmount = 0;
    this.player.crouching = false;
    this.player.breachChargesLeft = 2;
    this.player.gadgetCharges = this.player.op.charges || 2;
    this.player.activeGadgetType = this.player.op.gadgetType || 'generic';
    this.player.isThermalVision = false;
    this.player.isCardiacSensor = false;
    this.player.isElectronicsDetector = false;
    this.player.isFullShieldExtended = false;
    this.player.isSilencedFootsteps = false;
    this.player.isLionScanning = false;
    this.player.isDokkaebiRinging = false;
    this.player.shielded = false;
    this.player.cloaked = false;
    this.match.defuserPlanted = false;
    this.match.defuseProgress = 0;
    this.match.plantProgress = 0;
    this.match.defuserTimer = 45.0;
    this.match.defuserPos = null;
    this.match.defuserMesh = null;
    this.match.defuserCarrier = null;
    this.match.defuserDropped = false;

    // Build the Tactical Infiltration House
    this.rebuildHouseMap();

    // Spawn points
    if (this.player.side === 'atk') {
      // Attackers spawn at the player's chosen spawn point (falling back to spawn 0 if the
      // index doesn't exist on this map/side, e.g. after a side swap onto a shorter list).
      const atkIdx = this.preferredSpawnIndex >= 0 && this.preferredSpawnIndex < this.mapSpawnsAtk.length ? this.preferredSpawnIndex : 0;
      const [sx, sz] = this.mapSpawnsAtk[atkIdx];
      const floorY = this.getFloorHeight(sx, sz, 0);
      this.player.pos.set(sx, floorY + this.PLAYER_H, sz);
      this.player.yaw = 0; // Facing the front of the building

      // Launch Recon Drone for Attackers
      this.inDroneMode = true;
      this.dronesReserve = 1;
      this.droneSpottedEnemies.clear();
      this.droneSpottedObjective = false;
      this.drone = this.createSafeDrone(new THREE.Vector3(sx, floorY + 0.06, sz + 3.5), 0);
      this.scene.add(this.drone.mesh);

      if (this.viewmodelGroup) {
        this.viewmodelGroup.visible = false;
      }

      this.match.phase = 'prep';
      this.match.phaseTimer = 25;
      this.match.secureTimer = 0;

      this.log('DRONE RECON PHASE! Drive drone with [W/A/S/D], jump with [SPACE], locate bomb & hostiles! Press [5] or [ENTER] to deploy as Operator.');
    } else {
      // Defenders spawn at the player's chosen spawn point (same clamping as attackers above),
      // height resolved from the actual floor at that point (previously a fixed 3.45 constant,
      // which put defenders in the floor on any map with a different 2F height or none at all —
      // e.g. Warehouse District or Office Tower).
      const defIdx = this.preferredSpawnIndex >= 0 && this.preferredSpawnIndex < this.mapSpawnsDef.length ? this.preferredSpawnIndex : 0;
      const [sx, sz] = this.mapSpawnsDef[defIdx];
      const floorY = this.getFloorHeight(sx, sz, this.objectivePos?.y || 3.5);
      this.player.pos.set(sx, floorY + this.PLAYER_H, sz);
      this.player.yaw = Math.PI;

      this.inDroneMode = false;
      if (this.viewmodelGroup) {
        this.viewmodelGroup.visible = true;
      }

      this.match.phase = 'prep';
      this.match.phaseTimer = 20;
      this.match.secureTimer = 0;

      this.log('PREPARATION PHASE! Fortify the objective and hold defensive angles against incoming intruders!');
    }

    // Spawn 4 friendly bots + 5 enemy bots with realistic humanoid models & weapons
    this.spawnTacticalBots();
    // The device always belongs to the attacking team. If the human is defending,
    // hand it to a real attacker bot rather than silently treating the player as carrier.
    this.match.defuserCarrier = this.player.side === 'atk' ? 'player' : (this.bots.find(b => b.alive && b.side === 'atk')?.id || null);

    this.sound.roundStart();
    this.onStateUpdate?.();
  }

  public createSafeDrone(desiredPos: THREE.Vector3, yaw: number): ReconDrone {
    let spawnX = desiredPos.x;
    let spawnZ = desiredPos.z;
    const floorY = this.getFloorHeight(spawnX, spawnZ, desiredPos.y);
    let spawnY = floorY + 0.055;

    // Verify clearance against all colliders
    if (this.collides(spawnX, spawnZ, spawnY, 0.12, 0.10, spawnY - 0.04, spawnY + 0.08)) {
      // Find nearest clear spot
      const offsets = [0.35, -0.35, 0.7, -0.7];
      let found = false;
      for (const ox of offsets) {
        for (const oz of offsets) {
          const testX = spawnX + ox;
          const testZ = spawnZ + oz;
          const testFY = this.getFloorHeight(testX, testZ, desiredPos.y) + 0.055;
          if (!this.collides(testX, testZ, testFY, 0.12, 0.10, testFY - 0.04, testFY + 0.08)) {
            spawnX = testX;
            spawnZ = testZ;
            spawnY = testFY;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    return new ReconDrone(new THREE.Vector3(spawnX, spawnY, spawnZ), yaw);
  }

  public exitDroneMode() {
    if (!this.inDroneMode) return;
    this.inDroneMode = false;
    this.isFiring = false;
    if (this.viewmodelGroup) {
      this.viewmodelGroup.visible = true;
    }
    this.camera.position.copy(this.player.pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    this.camera.rotation.z = 0;
    this.log('Operator deployed — Tactical Infiltration active!');
    this.onStateUpdate?.();
  }

  // Force-holster whatever's equipped via toggleHeldGadget()/[G] — called when entering
  // drone or CCTV mode since the player can't be holding a physical item in either.
  public holsterHeldGadgets() {
    if (this.isHoldingThrow || this.holdingBreachCharge || this.isAimingThrow) {
      this.isHoldingThrow = false;
      this.holdingBreachCharge = false;
      this.isAimingThrow = false;
      this.updateGadgetViewmodel();
    }
  }

  public toggleDroneMode() {
    if (this.player.side !== 'atk') return;
    if (this.inDroneMode) {
      this.exitDroneMode();
    } else {
      this.holsterHeldGadgets();
      if (this.drone && !this.drone.destroyed) {
        this.inDroneMode = true;
        if (this.viewmodelGroup) {
          this.viewmodelGroup.visible = false;
        }
        this.log('Switched to active Recon Drone feed.');
        this.onStateUpdate?.();
      } else if (this.dronesReserve > 0) {
        this.dronesReserve--;
        // Deploy reserve drone 1 meter in front of player on valid floor
        const fwd = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).normalize();
        const dropPos = this.player.pos.clone().add(fwd.multiplyScalar(1.0));
        dropPos.y = this.getFloorHeight(dropPos.x, dropPos.z, this.player.pos.y - this.PLAYER_H) + 0.055;
        this.drone = this.createSafeDrone(dropPos, this.player.yaw);
        this.scene.add(this.drone.mesh);
        this.inDroneMode = true;
        if (this.viewmodelGroup) {
          this.viewmodelGroup.visible = false;
        }
        this.log('Reserve Recon Drone deployed into area of operations.');
        this.onStateUpdate?.();
      } else {
        this.log('No operational reconnaissance drones remaining.');
      }
    }
  }

  public inCctvMode: boolean = false;
  public activeCctvIndex: number = 0;

  private isCameraOperational(camera: { isDestroyed: boolean; empDisabledUntil?: number }) {
    return !camera.isDestroyed && (!camera.empDisabledUntil || performance.now() >= camera.empDisabledUntil);
  }

  public toggleCctvMode() {
    if (this.inCctvMode) {
      this.exitCctvMode();
    } else {
      if (!this.securityCameras.some(camera => this.isCameraOperational(camera))) return;
      this.holsterHeldGadgets();
      this.inCctvMode = true;
      if (this.inDroneMode) this.exitDroneMode();
      if (this.viewmodelGroup) this.viewmodelGroup.visible = false;
      this.log('Accessing Security Surveillance Network...');
      this.onStateUpdate?.();
    }
  }

  public exitCctvMode() {
    if (!this.inCctvMode) return;
    this.inCctvMode = false;
    if (this.viewmodelGroup) this.viewmodelGroup.visible = true;
    this.camera.position.copy(this.player.pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    this.camera.rotation.z = 0;
    this.log('Exited CCTV Surveillance.');
    this.onStateUpdate?.();
  }

  public nextCctvCamera() {
    if (this.securityCameras.length === 0) return;
    this.activeCctvIndex = (this.activeCctvIndex + 1) % this.securityCameras.length;
    this.sound.playCameraClick();
    this.onStateUpdate?.();
  }

  public prevCctvCamera() {
    if (this.securityCameras.length === 0) return;
    this.activeCctvIndex = (this.activeCctvIndex - 1 + this.securityCameras.length) % this.securityCameras.length;
    this.sound.playCameraClick();
    this.onStateUpdate?.();
  }

  public rebuildHouseMap() {
    gadgetSystem.clearAll();
    // Clear old scene meshes except camera
    const toRemove: THREE.Object3D[] = [];
    this.scene.children.forEach(child => {
      if (child !== this.camera && child !== this.muzzleLight) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(c => this.scene.remove(c));

    // Build Tactical 2-Story House
    const houseData = HouseMapBuilder.buildHouse(this.scene, this.currentMapKey);
    this.colliders = houseData.colliders;
    this.barricades = houseData.barricades;
    this.rappelWalls = houseData.rappelWalls;
    this.objectivePos = houseData.objectivePos;
    this.animatedLights = houseData.animatedLights;
    // Map-specific spawn coordinates (x,z) — different maps have different footprints
    // (e.g. Warehouse District is single-floor, Office Tower's 2F sits at a different
    // height than the house maps), so spawns must come from the map, not a fixed constant.
    this.mapSpawnsAtk = houseData.spawnsAtk;
    this.mapSpawnsDef = houseData.spawnsDef;
    // The suburban house has a dedicated, hand-authored room-level graph (50+ nodes) —
    // restore that instead of overwriting it with the generic per-map graph, which was a
    // regression: every map load, including the house, was previously wiping it down to
    // ~7 generic waypoints. Every other map still gets its own graph built from its real
    // spawns, objective, and breach points (doors/windows).
    if (this.currentMapKey === 'suburban_house') {
      navGraph.rebuildDefaultHouseGraph();
    } else {
      const breachPoints = houseData.barricades.map(b => ({ id: b.id, position: b.position, isWindow: b.isWindow }));
      navGraph.configureMap(this.currentMapKey, houseData.spawnsAtk, houseData.spawnsDef, houseData.objectivePos, breachPoints);
    }

    // Apply custom sky background, fog, and lighting depending on the map key
    let skyColor = 0x7da4c4;
    let fogDensity = 0.015;
    let hemiSky = 0xbad2e8;
    let hemiGround = 0x1c1914;
    let hemiIntensity = 0.8;
    let sunColor = 0xfffaea;
    let sunIntensity = 1.25;
    let fillColor = 0x4a6a8c;
    let fillIntensity = 0.4;

    if (this.currentMapKey === 'warehouse') {
      // Overcast industrial daylight, flatter and dustier than the house maps
      skyColor = 0x9aa3ab;
      fogDensity = 0.018;
      hemiSky = 0xb7bec4;
      hemiGround = 0x33302a;
      hemiIntensity = 0.9;
      sunColor = 0xe8e4d8;
      sunIntensity = 0.95;
      fillColor = 0x5a6066;
      fillIntensity = 0.45;
    } else if (this.currentMapKey === 'office_tower') {
      // Bright modern glass-tower daylight, cooler and crisper
      skyColor = 0x9fd0f0;
      fogDensity = 0.008;
      hemiSky = 0xdcefff;
      hemiGround = 0x2a2f38;
      hemiIntensity = 1.15;
      sunColor = 0xffffff;
      sunIntensity = 1.6;
      fillColor = 0x6fa0c9;
      fillIntensity = 0.5;
    }

    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, fogDensity);

    // Ambient & Directional Lighting
    const hemi = new THREE.HemisphereLight(hemiSky, hemiGround, hemiIntensity);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
    sun.position.set(24, 38, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 2;
    this.scene.add(sun);

    const fillLight = new THREE.DirectionalLight(fillColor, fillIntensity);
    fillLight.position.set(-20, 15, 20);
    this.scene.add(fillLight);

    // Build Destroyable Tactical Security Cameras — placed per-map since each layout has
    // a different footprint (previously this was one fixed list for the house, which put
    // cameras in nonsense spots — floating in open air or inside walls — on other maps).
    const camConfigsByMap: Record<string, Array<{ id: string; name: string; pos: THREE.Vector3; rot: { yaw: number; pitch: number } }>> = {
      warehouse: [
        { id: 'cam_wh_west', name: 'CAM-01: West Roll-Up Door', pos: new THREE.Vector3(-12, 6.3, -12), rot: { yaw: 3.14, pitch: -0.35 } },
        { id: 'cam_wh_east', name: 'CAM-02: East Roll-Up Door', pos: new THREE.Vector3(12, 6.3, -12), rot: { yaw: 3.14, pitch: -0.35 } },
        { id: 'cam_wh_vault', name: 'CAM-03: Vault Overwatch', pos: new THREE.Vector3(0, 6.3, 8), rot: { yaw: 3.14, pitch: -0.4 } },
        { id: 'cam_wh_westside', name: 'CAM-04: West Flank Window', pos: new THREE.Vector3(-19, 4.5, 4), rot: { yaw: 1.57, pitch: -0.25 } },
        { id: 'cam_wh_eastside', name: 'CAM-05: East Flank Window', pos: new THREE.Vector3(19, 4.5, 4), rot: { yaw: -1.57, pitch: -0.25 } }
      ],
      office_tower: [
        { id: 'cam_off_lobby', name: 'CAM-01: Ground Lobby', pos: new THREE.Vector3(0, 3.9, -10), rot: { yaw: 3.14, pitch: -0.3 } },
        { id: 'cam_off_bullpen', name: 'CAM-02: Cubicle Bullpen', pos: new THREE.Vector3(0, 3.9, 1), rot: { yaw: 0, pitch: -0.35 } },
        { id: 'cam_off_boardroom', name: 'CAM-03: Boardroom', pos: new THREE.Vector3(-2, 8.3, -8), rot: { yaw: 0, pitch: -0.3 } },
        { id: 'cam_off_vault', name: 'CAM-04: Data Vault', pos: new THREE.Vector3(9, 8.3, 6), rot: { yaw: 3.14, pitch: -0.35 } },
        { id: 'cam_off_stairs', name: 'CAM-05: Stairwell', pos: new THREE.Vector3(9, 3.9, -6), rot: { yaw: 1.2, pitch: -0.3 } }
      ],
      // Previously missing — Harbor Villa fell through to the suburban-house default
      // coordinates below, which put cameras floating over water or inside the villa's
      // walls since the two layouts don't share any geometry.
    };
    const rawCamConfigs = camConfigsByMap[this.currentMapKey] || [
      { id: 'cam_ext_front', name: 'CAM-01: Front Porch & Entrance', pos: new THREE.Vector3(0, 3.2, -15.2), rot: { yaw: 0, pitch: -0.3 } },
      { id: 'cam_1f_lobby', name: 'CAM-02: 1F Main Lobby', pos: new THREE.Vector3(1, 3.4, -6.5), rot: { yaw: 3.14, pitch: -0.3 } },
      { id: 'cam_1f_kitchen', name: 'CAM-03: 1F East Corridor', pos: new THREE.Vector3(8, 3.4, 2), rot: { yaw: 1.57, pitch: -0.3 } },
      { id: 'cam_2f_master', name: 'CAM-04: 2F Master Site A', pos: new THREE.Vector3(8, 6.8, -4), rot: { yaw: -1.57, pitch: -0.3 } },
      { id: 'cam_2f_control', name: 'CAM-05: 2F Control Site B', pos: new THREE.Vector3(-8, 6.8, 8), rot: { yaw: 0.8, pitch: -0.4 } },
    ];

    this.securityCameras = rawCamConfigs.map(c => {
      const group = new THREE.Group();
      group.position.copy(c.pos);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.1, 12),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 })
      );
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.9 })
      );
      dome.position.y = -0.05;

      const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), ledMat);
      led.position.set(0, -0.14, 0.1);

      group.add(base, dome, led);
      this.scene.add(group);

      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.copy(c.pos);
      this.scene.add(hitMesh);

      return {
        ...c,
        mesh: group,
        hitMesh,
        ledMat,
        hp: 15,
        isDestroyed: false,
      };
    });
  }

  public spawnTacticalBots() {
    // Determine active humans on each team
    let atkHumans = this.player.side === 'atk' ? 1 : 0;
    let defHumans = this.player.side === 'def' ? 1 : 0;
    networkClient.remotePlayers.forEach(rp => {
      if (rp.side === 'atk') atkHumans++;
      if (rp.side === 'def') defHumans++;
    });

    const atkBotsCount = Math.max(0, 5 - atkHumans);
    const defBotsCount = Math.max(0, 5 - defHumans);

    if (this.player.side === 'atk') {
      if (atkBotsCount > 0) this.spawnTeam(atkBotsCount, 'atk', true);
      if (defBotsCount > 0) this.spawnTeam(defBotsCount, 'def', false);
    } else {
      if (defBotsCount > 0) this.spawnTeam(defBotsCount, 'def', true);
      if (atkBotsCount > 0) this.spawnTeam(atkBotsCount, 'atk', false);
    }
  }

  public adjustBotsForMultiplayer(atkHumans: number, defHumans: number) {
    const effectiveAtkHumans = Math.max(this.player.side === 'atk' ? 1 : 0, atkHumans);
    const effectiveDefHumans = Math.max(this.player.side === 'def' ? 1 : 0, defHumans);

    const desiredAtkBots = Math.max(0, 5 - effectiveAtkHumans);
    const desiredDefBots = Math.max(0, 5 - effectiveDefHumans);

    // Prune excess ATK bots
    let currentAtkBots = this.bots.filter(b => b.side === 'atk');
    while (currentAtkBots.length > desiredAtkBots) {
      const b = currentAtkBots.pop();
      if (b) {
        this.scene.remove(b.mesh);
        this.scene.remove(b.marker);
        const idx = this.bots.indexOf(b);
        if (idx !== -1) this.bots.splice(idx, 1);
      }
    }
    // Spawn missing ATK bots
    if (currentAtkBots.length < desiredAtkBots) {
      this.spawnTeam(desiredAtkBots - currentAtkBots.length, 'atk', this.player.side === 'atk');
    }

    // Prune excess DEF bots
    let currentDefBots = this.bots.filter(b => b.side === 'def');
    while (currentDefBots.length > desiredDefBots) {
      const b = currentDefBots.pop();
      if (b) {
        this.scene.remove(b.mesh);
        this.scene.remove(b.marker);
        const idx = this.bots.indexOf(b);
        if (idx !== -1) this.bots.splice(idx, 1);
      }
    }
    // Spawn missing DEF bots
    if (currentDefBots.length < desiredDefBots) {
      this.spawnTeam(desiredDefBots - currentDefBots.length, 'def', this.player.side === 'def');
    }

    this.onStateUpdate?.();
  }

  public spawnDefuserProp(pos: THREE.Vector3) {
    if (this.match.defuserMesh) {
      this.scene.remove(this.match.defuserMesh);
      this.match.defuserMesh = null;
    }
    const defuserObj = ModelFactory.createDefuserCase();
    defuserObj.root.position.copy(pos);
    this.scene.add(defuserObj.root);
    this.match.defuserMesh = defuserObj.root;
  }

  public spawnTeam(count: number, side: 'atk' | 'def', isMate: boolean) {
    const alreadyChosenIds = new Set<string>();
    if (this.player.side === side) {
      alreadyChosenIds.add(this.player.op.id);
    }
    this.bots.filter(b => b.side === side).forEach(b => alreadyChosenIds.add(b.op.id));
    
    // Pick unique operators from roster
    let pool = OPERATORS.filter(o => o.side === side && !alreadyChosenIds.has(o.id));
    if (pool.length < count) {
      pool = OPERATORS.filter(o => o.side === side);
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    // Tactical spawn vectors, pulled from the active map's own spawn data (not hardcoded to one
    // house layout) — height is resolved per-point via getFloorHeight so bots never spawn embedded
    // in a floor slab that doesn't exist, or is at a different height, on other maps.
    const atkSpawns = this.mapSpawnsAtk.map(([x, z]) => [x, this.getFloorHeight(x, z, 0), z]);
    const defAllSpawns = this.mapSpawnsDef.map(([x, z]) => {
      const approxY = this.objectivePos?.y || 3.5;
      return [x, this.getFloorHeight(x, z, approxY), z];
    });
    // Alternate "anchor" (near objective) vs "roamer" (elsewhere) assignment across the map's def spawn list
    const defAnchorSpawns = defAllSpawns.filter((_, i) => i % 2 === 0);
    const defRoamerSpawns = defAllSpawns.filter((_, i) => i % 2 === 1);
    if (defAnchorSpawns.length === 0) defAnchorSpawns.push(...defAllSpawns);
    if (defRoamerSpawns.length === 0) defRoamerSpawns.push(...defAllSpawns);

    for (let i = 0; i < count; i++) {
      const op = shuffled[i % shuffled.length];
      const isRoamer = op.role.includes('Roam') || op.role.includes('Trap') || op.role.includes('Intel') || op.role.includes('Infiltrat');

      let sp: number[];
      if (side === 'atk') {
        // If this is the player's side, offset bot spawn-cycling past the player's own chosen
        // spawn index so a bot doesn't land right on top of the human on round start.
        const startOffset = (side === this.player.side) ? this.preferredSpawnIndex + 1 : 0;
        sp = atkSpawns[(i + startOffset) % atkSpawns.length];
      } else {
        if (isRoamer) {
          sp = defRoamerSpawns[i % defRoamerSpawns.length];
        } else {
          sp = defAnchorSpawns[i % defAnchorSpawns.length];
        }
      }

      // Map primary weapon model type based on operator characteristics
      let weaponType = 'ar';
      if (op.role.includes('Shield') || op.id === 'montagne' || op.id === 'blitz' || op.id === 'clash') {
        weaponType = 'smg';
      } else if (op.role.includes('Shotgun') || op.id === 'smoke' || op.id === 'frost') {
        weaponType = 'shotgun';
      } else if (op.side === 'def' && (op.role.includes('Roam') || op.role.includes('Trap') || op.role.includes('Intel'))) {
        weaponType = 'smg';
      }

      // Create Realistic Humanoid Operator with weapon in hand
      const char = ModelFactory.createHumanoidOperator(side, op.color, weaponType);
      const group = char.root;
      group.position.set(sp[0] + (Math.random() - 0.5) * 1.2, sp[1] || 0, sp[2] + (Math.random() - 0.5) * 1.2);
      this.scene.add(group);

      // Marker for teammates or tagged enemies
      const markerGeo = new THREE.RingGeometry(0.3, 0.42, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: isMate ? 0x5aff8a : 0xff4444, side: THREE.DoubleSide });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(group.position.x, 2.3, group.position.z);
      marker.visible = !!isMate;
      this.scene.add(marker);

      const personality = this.pick(PERSONALITY_TYPES);
      this.bots.push({
        id: `${op.id}_${i}`,
        mesh: group,
        torsoGroup: char.torsoGroup,
        armsGroup: char.armsGroup,
        weaponGroup: char.weaponGroup,
        leftLeg: char.leftLeg,
        rightLeg: char.rightLeg,
        hitMesh: char.hitMesh,
        marker,
        op,
        side,
        isMate,
        hp: 100,
        alive: true,
        target: new THREE.Vector3(group.position.x, group.position.y, group.position.z),
        fireT: 0,
        stunned: 0,
        aimSkill: 0.45 + Math.random() * 0.45,
        personality,
        walkCycle: 0,
        recoilKick: 0,
        memory: { lastKnownPos: null, lastKnownTime: -999, lastHeardPos: null, lastHeardTime: -999, confidence: 0 },
        state: 'HOLD',
        nextThink: 0,
        moveGoal: new THREE.Vector3(group.position.x, group.position.y, group.position.z),
        mistakeChance: personality.mistakeChance,
        leanState: 0,
        leanAmount: 0,
        peekSide: 0,
        peekTimer: 0,
        peekCooldown: 0,
        lastPeekOrigin: null,
        gadgetCooldown: 4 + Math.random() * 8,
        gadgetCharges: op.charges || 2,
        hasPlacedPrepGadget: false,
        assignedRole: isRoamer ? 'roamer' : 'anchor'
      });
    }
    this.status.ai = this.bots.length + ' humanoid tactical bots deployed';
  }

  public endRound(winnerSide: 'atk' | 'def', reason: string) {
    if (this.match.phase !== 'action') return;
    this.match.phase = 'result';
    this.match.phaseTimer = this.match.resultLength;
    this.match.winner = winnerSide;
    if (winnerSide === 'atk') this.match.scoreAtk++; else this.match.scoreDef++;

    this.log(`Round ${this.match.round} result: ${winnerSide === 'atk' ? 'ATTACKERS' : 'DEFENDERS'} win — ${reason}.`);
    if (winnerSide === this.player.side) {
      this.sound.roundWin();
    } else {
      this.sound.roundLoss();
    }
    this.onStateUpdate?.();
  }

  public advanceMatch() {
    const totalRounds = this.match.roundsToWin * 2 - 1;
    if (this.match.scoreAtk >= this.match.roundsToWin || this.match.scoreDef >= this.match.roundsToWin || this.match.round >= totalRounds) {
      this.match.phase = 'matchover';
      const matchWinner = this.match.scoreAtk > this.match.scoreDef ? 'ATTACK' : (this.match.scoreDef > this.match.scoreAtk ? 'DEFENSE' : 'DRAW');
      const scoreStr = `${this.match.scoreAtk}-${this.match.scoreDef}`;
      this.log(`MATCH OVER — ${matchWinner} wins ${scoreStr}.`);
      this.onMatchOver?.(matchWinner, scoreStr);
      this.onStateUpdate?.();
      return;
    }

    this.match.round++;
    this.beginRound();
  }

  // ---------------------------------------------------------------------
  // 2. SCENE & VIEWMODEL SETUP
  // ---------------------------------------------------------------------
  public initScene() {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    this.scene = new THREE.Scene();
    this.status.scene = 'ok';

    this.scene.background = new THREE.Color(0x7da4c4);
    this.scene.fog = new THREE.FogExp2(0x7da4c4, 0.015);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(78, w / h, 0.05, 200);
    this.status.camera = 'ok';

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    if ('outputColorSpace' in this.renderer) {
      (this.renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
    }

    this.container.appendChild(this.renderer.domElement);
    this.status.renderer = 'ok';

    this.muzzleLight = new THREE.PointLight(0xffcc66, 0, 8, 2);
    this.scene.add(this.muzzleLight);

    gadgetSystem.init(this.scene);

    // First Person Weapon & Gloved Arms Rig
    this.initFirstPersonRig();

    this.setupEvents();
    this.timer.reset();
    this.status.loop = 'timer ready';
  }

  public initFirstPersonRig() {
    if (this.viewmodelGroup) {
      this.camera.remove(this.viewmodelGroup);
    }

    const currentWpn = this.currentWeapon();
    const rig = ModelFactory.createFirstPersonRig(currentWpn.id);
    this.viewmodelGroup = rig.root;
    this.viewmodelWeapon = rig.weaponGroup;
    this.viewmodelFlash = rig.flashSprite;
    this.viewmodelBarrelTip = rig.barrelTip;

    this.camera.add(this.viewmodelGroup);
    this.scene.add(this.camera);

    // Hand-held gadget viewmodel — built once and kept hidden until the player is
    // actually holding a gadget ([TAB]-equipped breach charge, or a [G]-held Valkyrie/
    // Maestro camera). Rebuilt in place by updateGadgetViewmodel() whenever the held
    // kind changes, so both share one cached group/slot in the camera rig.
    if (!this.gadgetViewmodelGroup) {
      const gadgetRig = ModelFactory.createGadgetViewRig('camera');
      this.gadgetViewmodelGroup = gadgetRig.root;
      this.gadgetViewmodelGroup.visible = false;
      this.heldGadgetKind = 'camera';
      this.camera.add(this.gadgetViewmodelGroup);
    }
  }

  // Swap the first-person view between the weapon rig and whichever hand-held gadget rig
  // matches what's currently equipped (isHoldingThrow → camera, holdingBreachCharge →
  // breach charge). Called whenever either of those flags changes so the viewmodel always
  // matches what the player is actually about to do with a left-click.
  public updateGadgetViewmodel() {
    if (!this.gadgetViewmodelGroup || !this.camera) return;
    const desiredKind: 'camera' | 'breach_charge' | null = this.holdingBreachCharge
      ? 'breach_charge'
      : this.isHoldingThrow
      ? 'camera'
      : null;

    if (desiredKind && desiredKind !== this.heldGadgetKind) {
      this.camera.remove(this.gadgetViewmodelGroup);
      const gadgetRig = ModelFactory.createGadgetViewRig(desiredKind);
      this.gadgetViewmodelGroup = gadgetRig.root;
      this.heldGadgetKind = desiredKind;
      this.camera.add(this.gadgetViewmodelGroup);
    }

    const holding = !!desiredKind;
    this.gadgetViewmodelGroup.visible = holding;
    if (this.viewmodelGroup) {
      if (holding) {
        this.viewmodelGroup.visible = false;
      } else if (!this.inCctvMode && !this.inDroneMode && this.player.alive) {
        this.viewmodelGroup.visible = true;
      }
    }
  }

  private boundContextMenu = (e: MouseEvent) => e.preventDefault();

  private setupEvents() {
    this.removeEvents();
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mousedown', this.boundOnMouseDown);
    document.addEventListener('mouseup', this.boundOnMouseUp);
    document.addEventListener('keydown', this.boundOnKeyDown);
    document.addEventListener('keyup', this.boundOnKeyUp);
    document.addEventListener('contextmenu', this.boundContextMenu);
    window.addEventListener('resize', this.boundOnResize);
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.isFiring = false;
      }
    });
    this.status.input = 'listeners attached';
  }

  private removeEvents() {
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mousedown', this.boundOnMouseDown);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    document.removeEventListener('keydown', this.boundOnKeyDown);
    document.removeEventListener('keyup', this.boundOnKeyUp);
    document.removeEventListener('contextmenu', this.boundContextMenu);
    window.removeEventListener('resize', this.boundOnResize);
  }

  private onResize() {
    if (!this.camera || !this.renderer) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    if (this.inCctvMode && this.securityCameras.length > 0) {
      const activeCam = this.securityCameras[this.activeCctvIndex];
      if (activeCam && this.isCameraOperational(activeCam)) {
        activeCam.rot.yaw -= e.movementX * 0.0022;
        activeCam.rot.pitch = Math.max(-0.6, Math.min(0.6, activeCam.rot.pitch - e.movementY * 0.0022));
        if (activeCam.mesh) {
          activeCam.mesh.rotation.y = activeCam.rot.yaw;
          activeCam.mesh.rotation.x = activeCam.rot.pitch;
        }
      }
      return;
    }
    if (this.inDroneMode && this.drone) {
      if (!this.drone.destroyed) {
        this.drone.yaw -= e.movementX * 0.0024;
        this.drone.pitch -= e.movementY * 0.0018;
        this.drone.pitch = Math.max(-0.65, Math.min(0.65, this.drone.pitch));
      }
      return;
    }
    this.player.yaw -= e.movementX * 0.0022;
    this.player.pitch -= e.movementY * 0.0022;
    this.player.pitch = Math.max(-1.4, Math.min(1.4, this.player.pitch));
  }

  private onMouseDown(e: MouseEvent) {
    if (document.pointerLockElement !== this.renderer.domElement) {
      this.renderer.domElement.requestPointerLock();
      return;
    }
    if (this.inCctvMode) {
      if (e.button === 0) {
        const activeCam = this.securityCameras[this.activeCctvIndex];
        if (activeCam && activeCam.isMaestro && this.isCameraOperational(activeCam)) {
          this.fireMaestroLaser(activeCam);
        }
      }
      return;
    }
    if (this.inDroneMode) {
      // Twitch's Shock Drone is a piloted drone like the recon drone, but armed — left-click
      // fires live rounds from its mounted micro-gun instead of doing nothing while piloting.
      // Fire immediately on click, then keep firing on the loop below for as long as it's held.
      if (e.button === 0) {
        this.isFiring = true;
        if (this.drone && this.drone.canFire()) {
          this.fireDroneGun();
        }
      }
      return;
    }
    if (e.button === 0 && (this.isHoldingThrow || this.holdingBreachCharge)) {
      // A gadget is equipped via [TAB] (or [G] for cameras) — press and hold to aim (shows
      // the trajectory arc or a placement decal), release to actually throw/place it. See
      // onMouseUp() for the throw/plant itself.
      this.isAimingThrow = true;
      return;
    }
    if (e.button === 0) {
      this.isFiring = true;
      this.tryFire();
    } else if (e.button === 2) {
      this.player.focusZoom = true;
      this.sound.playGadgetDeploy();
      this.onStateUpdate?.();
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.isFiring = false;
      if (this.isAimingThrow) {
        this.isAimingThrow = false;
        // Throw/plant on release, at wherever the player's aiming right now.
        if (this.holdingBreachCharge) {
          if (this.plantBreachChargeAtAim()) {
            this.holdingBreachCharge = false;
            this.updateGadgetViewmodel();
          }
        } else if (this.isHoldingThrow) {
          this.executeThrow();
          this.isHoldingThrow = false;
          this.updateGadgetViewmodel();
        }
      }
    } else if (e.button === 2) {
      this.player.focusZoom = false;
      this.onStateUpdate?.();
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keys[e.code] = true;
    if (!this.started) return;
    // Tab equips/holsters the shield gadget (Montagne/Blackbeard) with a single press —
    // press once to raise it, press again to lower it and return to the weapon. Also
    // prevents the browser's default focus-cycling behavior from stealing keyboard focus
    // off the game canvas.
    if (e.code === 'Tab') {
      e.preventDefault();
      if (!e.repeat) this.toggleHeldGadget();
      return;
    }
    if (e.code === 'KeyN' || e.code === 'KeyM') {
      this.onToggleLoadoutMenu?.();
      return;
    }
    if (e.code === 'Backquote') {
      this.diagPanelOn = !this.diagPanelOn;
      this.onStateUpdate?.();
    }
    if (e.code === 'KeyG') {
      const type = this.getThrowableTypeForOperator();
      if (type) {
        if (this.player.gadgetCharges !== undefined && this.player.gadgetCharges <= 0) {
          this.log(`No remaining charges for ${this.player.op.gadgetName || 'ability'}!`);
          return;
        }
        if (this.player.abilityCooldown > 0) {
          this.log(`Ability recharging (${this.player.abilityCooldown.toFixed(1)}s remaining).`);
          return;
        }
        this.isHoldingThrow = true;
        this.updateGadgetViewmodel();
      } else {
        this.toggleDroneMode();
      }
      return;
    }
    if (this.inCctvMode) {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.prevCctvCamera();
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.nextCctvCamera();
      if (e.code === 'Escape' || e.code === 'Digit6') this.exitCctvMode();
      return;
    }
    if (this.inDroneMode) {
      if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Digit5') {
        this.exitDroneMode();
      }
      return;
    }
    if (e.code === 'Digit5') {
      this.toggleDroneMode();
      return;
    }
    if (e.code === 'Digit6') {
      this.toggleCctvMode();
      return;
    }
    if (this.match.phase !== 'action') return;
    if (e.code === 'KeyR') this.startReload();
    if (e.code === 'Slash' || e.code === 'KeyF') this.useAbility();
    if (e.code === 'KeyV') this.handleMelee();
    if (e.code === 'KeyC') {
      if (this.player.isRappelling) {
        // Detach rappel and drop
        this.detachRappel();
      } else {
        this.player.crouching = !this.player.crouching;
      }
    }
    if (e.code === 'Space') {
      const canRappelHere = !this.player.isRappelling && !!this.findNearbyRappelWall();
      const nearbyWindow = this.barricades.find(
        b => !b.isBreached && b.isWindow && b.floor === 2 && b.position.distanceTo(this.player.pos) < 2.5
      );
      const feetY = this.player.pos.y - this.PLAYER_H;
      const targetFloorY = this.getFloorHeight(this.player.pos.x, this.player.pos.z, feetY);
      const isOnGround = Math.abs(this.player.pos.y - this.PLAYER_H - targetFloorY) < 0.15;

      if (!canRappelHere && !nearbyWindow && isOnGround && !this.player.isRappelling) {
        this.player.vy = 5.8;
      } else {
        this.handleSpaceInteraction();
      }
    }
    if (e.code === 'KeyB') {
      // Breaching Charge placement / detonation!
      this.handleBreachKey();
    }
    if (e.code === 'Digit1') {
      const opId = this.player.op?.id;
      if (opId === 'sledge') this.setWeaponIndex(5);
      else if (opId === 'montagne' || opId === 'blitz') this.setWeaponIndex(6);
      else if (opId === 'glaz') this.setWeaponIndex(0);
      else if (this.player.weaponIdx === 4) this.setWeaponIndex(1);
    }
    if (e.code === 'Digit2') { this.setWeaponIndex(4); }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys[e.code] = false;
    if (e.code === 'KeyG' && this.isHoldingThrow) {
      this.isHoldingThrow = false;
      this.updateGadgetViewmodel();
      this.executeThrow();
    }
  }

  public handleMelee() {
    if (!this.player.alive || this.match.phase !== 'action' || this.inDroneMode) return;
    const now = performance.now() / 1000;
    if (now - this.lastMelee < 0.5) return;
    this.lastMelee = now;

    this.sound.woodSnap();

    // Visual melee strike animation
    if (this.viewmodelGroup) {
      this.viewmodelGroup.position.z -= 0.12;
      this.viewmodelGroup.rotation.z += 0.15;
      this.scheduleTimeout(() => {
        if (this.viewmodelGroup) {
          this.viewmodelGroup.position.z += 0.12;
          this.viewmodelGroup.rotation.z -= 0.15;
        }
      }, 140);
    }

    // 1. Check if striking a nearby barricade
    const nearbyBarricade = this.barricades.find(
      b => !b.isBreached && b.position.distanceTo(this.player.pos) < 2.5
    );
    if (nearbyBarricade) {
      nearbyBarricade.hp -= 50;
      this.sound.woodSnap();
      this.spawnSplinterDebris(nearbyBarricade.position, nearbyBarricade.normal, 8);
      if (nearbyBarricade.hp <= 0) {
        this.breachBarricade(nearbyBarricade, true);
        this.log('MELEE BREACH! Barricade destroyed!');
      } else {
        this.log(`Barricade hit! (${nearbyBarricade.hp} HP remaining) [V]`);
      }
      return;
    }

    // 2. Check if striking an enemy in close quarters
    const enemySide = this.player.side === 'atk' ? 'def' : 'atk';
    const closeBot = this.bots.find(b => b.alive && b.side === enemySide && b.mesh.position.distanceTo(this.player.pos) < 2.2);
    if (closeBot) {
      closeBot.hp -= 100;
      this.sound.hit();
      this.spawnImpact(closeBot.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff2222);
      if (closeBot.hp <= 0) {
        closeBot.alive = false;
        this.log(`TACTICAL MELEE ELIMINATION: [${closeBot.op.name}] taken down!`);
      }
      return;
    }
  }

  public setWeaponIndex(idx: number) {
    if (this.player.weaponIdx === idx) return;
    this.player.weaponIdx = idx;
    this.initFirstPersonRig();
    this.onStateUpdate?.();
  }

  // ---------------------------------------------------------------------
  // 3. RAPPELLING SYSTEM
  // ---------------------------------------------------------------------
  public handleSpaceInteraction() {
    if (this.player.isRappelling) {
      // Check if near a 2nd floor window to enter or kick breach!
      const nearbyWindow = this.barricades.find(
        b => b.isWindow && b.floor === 2 && b.position.distanceTo(this.player.pos) < 2.5
      );

      if (nearbyWindow) {
        if (!nearbyWindow.isBreached) {
          this.breachBarricade(nearbyWindow, true);
          this.log('KICK BREACH! Infiltrated through the 2nd floor window!');
        } else {
          this.log('Vaulted through the 2nd floor window!');
        }
        this.detachRappel();
        // Jump inward through window
        const inward = nearbyWindow.normal.clone().negate().multiplyScalar(2.0);
        this.player.pos.add(inward);
        return;
      }

      // Check if near the roof edge to vault onto roof
      if (this.player.rappelWall && this.player.pos.y >= this.player.rappelWall.roofY - 0.5) {
        this.player.pos.y = this.player.rappelWall.roofY + this.PLAYER_H;
        const inward = this.player.rappelWall.normal.clone().negate().multiplyScalar(1.5);
        this.player.pos.add(inward);
        this.detachRappel();
        this.log('Vaulted over roof ledge onto roof!');
        return;
      }
      return;
    }

    // Check if player is facing an exterior wall to attach rappel hook
    const checkWall = this.findNearbyRappelWall();
    if (checkWall) {
      this.attachRappel(checkWall);
    }
  }

  public findNearbyRappelWall(): RappelWall | null {
    for (const rw of this.rappelWalls) {
      const p = this.player.pos;
      if (p.x >= rw.minX && p.x <= rw.maxX && p.z >= rw.minZ && p.z <= rw.maxZ) {
        return rw;
      }
    }
    return null;
  }

  public attachRappel(wall: RappelWall) {
    this.player.isRappelling = true;
    this.player.rappelWall = wall;
    this.player.rappelHeight = Math.max(1.8, this.player.pos.y);
    this.sound.rappelHook();

    // Create 3D Braided Steel Cable from Roof Anchor down to Player
    const anchorPos = new THREE.Vector3(this.player.pos.x, wall.roofY, this.player.pos.z);
    const cableGeo = new THREE.BufferGeometry().setFromPoints([anchorPos, this.player.pos]);
    const cableMat = new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 3 });
    const cable = new THREE.Line(cableGeo, cableMat);
    this.scene.add(cable);
    this.player.rappelCableMesh = cable;

    this.log('RAPPEL HOOK ATTACHED! [W/S] Climb/Descend · [A/D] Swing · [SPACE] Kick Window/Roof · [C] Detach');
    this.onStateUpdate?.();
  }

  public detachRappel() {
    this.player.isRappelling = false;
    this.player.rappelWall = null;
    if (this.player.rappelCableMesh) {
      this.scene.remove(this.player.rappelCableMesh);
      this.player.rappelCableMesh = null;
    }
    this.log('Rappel detached.');
    this.onStateUpdate?.();
  }

  public updateRappel(dt: number) {
    if (!this.player.isRappelling || !this.player.rappelWall) return;
    const wall = this.player.rappelWall;

    const climbSpeed = 3.5;
    if (this.keys['KeyW']) {
      this.player.rappelHeight = Math.min(wall.roofY - 0.1, this.player.rappelHeight + climbSpeed * dt);
    }
    if (this.keys['KeyS']) {
      this.player.rappelHeight = Math.max(1.2, this.player.rappelHeight - climbSpeed * dt);
    }

    // Lateral swing
    const swingDir = new THREE.Vector3(wall.normal.z, 0, -wall.normal.x);
    if (this.keys['KeyA']) {
      this.player.pos.addScaledVector(swingDir, -2.5 * dt);
    }
    if (this.keys['KeyD']) {
      this.player.pos.addScaledVector(swingDir, 2.5 * dt);
    }

    this.player.pos.y = this.player.rappelHeight;

    // Update 3D Cable Line geometry
    if (this.player.rappelCableMesh) {
      const anchorPos = new THREE.Vector3(this.player.pos.x, wall.roofY, this.player.pos.z);
      this.player.rappelCableMesh.geometry.setFromPoints([anchorPos, this.player.pos]);
    }
  }

  // ---------------------------------------------------------------------
  // 4. BREACHING CHARGE SYSTEM
  // ---------------------------------------------------------------------
  public handleBreachKey() {
    if (this.player.activeBreachCharge) {
      // Detonate active charge!
      this.detonateBreachCharge(this.player.activeBreachCharge);
      this.player.activeBreachCharge = null;
      return;
    }

    if (this.player.breachChargesLeft <= 0) {
      this.log('Out of Breach Charges!');
      return;
    }

    this.plantBreachChargeAtAim();
  }

  // Raycast-and-plant only (no detonate check) so it can be reused both by the instant [B]
  // press and by a left-click while a breach charge is equipped via [TAB].
  public plantBreachChargeAtAim(): boolean {
    // Look for a barricade or wall within 2.2m to place breach charge
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
    const ray = new THREE.Raycaster(origin, dir, 0.1, 2.5);

    // Check Barricades
    const barricadeMeshes = this.barricades.filter(b => !b.isBreached).map(b => b.mesh);
    const hits = ray.intersectObjects(barricadeMeshes, true);

    if (hits.length > 0) {
      const hit = hits[0];
      const hitBarricade = this.barricades.find(b => !b.isBreached && b.mesh.getObjectById(hit.object.id));

      this.plantBreachCharge(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 0, 1), hitBarricade || null);
      return true;
    } else {
      this.log('Aim at a barricade or wall to plant Breach Charge');
      return false;
    }
  }

  public plantBreachCharge(pos: THREE.Vector3, normal: THREE.Vector3, barricade: DestructibleBarricade | null) {
    this.player.breachChargesLeft--;
    this.sound.breachPlant();

    // Build Tactical Breach Charge Model
    const chargeGroup = new THREE.Group();
    chargeGroup.position.copy(pos);

    // Frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.45, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.5, metalness: 0.8 })
    );
    // C4 Explosive Packets
    const c4 = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.36, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 })
    );
    c4.position.set(0, 0, 0.02);

    // Blinking Red LED (Arming indicator)
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    led.position.set(0.1, 0.16, 0.06);

    chargeGroup.add(frame, c4, led);
    this.scene.add(chargeGroup);

    const charge: PlacedBreachCharge = {
      id: 'breach_' + Date.now(),
      mesh: chargeGroup,
      position: pos.clone(),
      normal: normal.clone(),
      targetBarricade: barricade,
      placedByPlayer: true
    };

    this.player.activeBreachCharge = charge;
    this.log('BREACH CHARGE PLANTED! Step back and press [B] to DETONATE!');
    this.onStateUpdate?.();
  }

  public detonateBreachCharge(charge: PlacedBreachCharge) {
    this.sound.breachExplode();
    this.screenShakeIntensity = 0.8;

    const blastPos = charge.position.clone();
    this.scene.remove(charge.mesh);

    // Massive Explosion Debris & Splinters
    this.spawnBreachExplosion(blastPos, charge.normal);

    // Destroy Barricade if attached
    if (charge.targetBarricade && !charge.targetBarricade.isBreached) {
      this.breachBarricade(charge.targetBarricade, false);
    }

    // Damage enemies / bots near blast radius
    this.bots.forEach(b => {
      if (!b.alive) return;
      const d = b.mesh.position.distanceTo(blastPos);
      if (d < 4.5) {
        const dmg = Math.round(95 * (1 - d / 4.5));
        this.damageUnit(b, dmg);
      }
    });

    // Damage player if standing too close
    const pDist = this.player.pos.distanceTo(blastPos);
    if (pDist < 4.0 && this.player.alive) {
      this.damagePlayer(Math.round(40 * (1 - pDist / 4.0)));
    }

    // Alert nearby bots!
    this.alertBotsToBreach(blastPos);
    this.log('BREACH EXPLOSION DETONATED! Pathway cleared!');
    this.onStateUpdate?.();
  }

  public breachBarricade(barricade: DestructibleBarricade, byKick: boolean = false) {
    if (barricade.isBreached) return;
    barricade.isBreached = true;
    this.sound.woodSnap();

    // Animate wooden planks splintering outwards
    this.spawnSplinterDebris(barricade.position, barricade.normal, 25);
    this.scene.remove(barricade.mesh);

    // Remove matching collider so players and bots can traverse through!
    this.colliders = this.colliders.filter(
      c => c.name !== barricade.id && !(Math.abs((c.minX + c.maxX) / 2 - barricade.position.x) < 1.2 && Math.abs((c.minZ + c.maxZ) / 2 - barricade.position.z) < 1.2 && c.minY >= barricade.position.y - 0.2 && c.maxY <= barricade.position.y + barricade.height + 0.2)
    );

    networkClient.notifyBarricadeBreach(barricade.id, barricade.position, barricade.normal);
    this.alertBotsToBreach(barricade.position);
    this.onStateUpdate?.();
  }

  public alertBotsToBreach(pos: THREE.Vector3) {
    const callouts = [
      'BREACH AT ENTRYWAY! DEFEND SIGHTLINE!',
      'WALL COMPROMISED! ENEMY INCOMING!',
      'WATCH THE BREACH HOLE!',
      'ENEMY BREACH DETONATED!'
    ];
    this.log(`[TAC COMMS] ${this.pick(callouts)}`);

    this.bots.forEach(b => {
      if (!b.alive) return;
      const d = b.mesh.position.distanceTo(pos);
      if (d < 18) {
        b.memory.lastHeardPos = pos.clone();
        b.memory.lastHeardTime = performance.now() / 1000;
        b.memory.confidence = 1.0;
        b.state = 'ENGAGE';
        b.moveGoal.set(pos.x + (Math.random() - 0.5) * 2, pos.y, pos.z + (Math.random() - 0.5) * 2);
      }
    });
  }

  public spawnBreachExplosion(pos: THREE.Vector3, normal: THREE.Vector3) {
    // Fireball Sphere
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.85 });
    const fireSphere = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 12), fireMat);
    fireSphere.position.copy(pos);
    this.scene.add(fireSphere);

    // Wooden Splinters
    this.spawnSplinterDebris(pos, normal, 35);

    this.scheduleTimeout(() => this.scene.remove(fireSphere), 200);
  }

  public spawnSplinterDebris(pos: THREE.Vector3, normal: THREE.Vector3, count: number) {
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a623f, roughness: 0.9 });
    for (let i = 0; i < count; i++) {
      const w = 0.08 + Math.random() * 0.12;
      const h = 0.2 + Math.random() * 0.45;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), plankMat);
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8));

      const vel = normal.clone().multiplyScalar(4 + Math.random() * 6);
      vel.x += (Math.random() - 0.5) * 5;
      vel.y += Math.random() * 4;
      vel.z += (Math.random() - 0.5) * 5;

      const rotVel = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      this.scene.add(mesh);
      this.debrisPieces.push({ mesh, vel, rotVel, life: 3.0 });
    }
  }

  // ---------------------------------------------------------------------
  // 5. SHOOTING & WEAPONS
  // ---------------------------------------------------------------------
  public tryFire() {
    if (!this.player.alive || this.player.reloading || this.match.phase !== 'action') return;
    if (this.player.stunned > 0) return;
    const w = this.currentWeapon();
    const now = performance.now() / 1000;
    if (now - this.lastShot < w.rate) return;
    if (this.player.ammoInMag[w.id] <= 0) {
      this.startReload();
      return;
    }
    this.lastShot = now;
    this.player.ammoInMag[w.id]--;
    this.muzzleFlash();
    this.sound.shot();
    this.broadcastSound(this.player.pos.clone(), this.player.side, 22);

    const spread = this.player.focusZoom ? (w.isSniper ? w.spread * 0.02 : w.spread * 0.28) : w.spread;
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const dir = this.getAimDir(spread);
      this.raycastShot(dir);
    }
    this.onStateUpdate?.();
  }

  public getAimDir(spread: number): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread * 0.3;
    return dir.normalize();
  }

  public raycastShot(dir: THREE.Vector3) {
    const origin = this.camera.position.clone().add(dir.clone().multiplyScalar(0.3));
    const raycaster = new THREE.Raycaster(origin, dir, 0.1, 70);

    const enemySide = this.player.side === 'atk' ? 'def' : 'atk';
    const botTargets = this.bots.filter(b => b.alive && b.side === enemySide).map(b => b.hitMesh);

    // Remote enemy human player models
    const remoteTargets: THREE.Object3D[] = [];
    networkClient.remotePlayers.forEach(rp => {
      if (rp.alive && rp.side === enemySide && rp.mesh) {
        remoteTargets.push(rp.mesh);
      }
    });

    // Also raycast against destructible wooden barricades & security cameras
    const barricadeMeshes = this.barricades.filter(b => !b.isBreached).map(b => b.mesh);
    const cameraMeshes = this.securityCameras.filter(c => !c.isDestroyed).map(c => c.hitMesh);
    const wallMeshes = this.colliderMeshes();
    const gadgetMeshes = gadgetSystem.gadgets.map(g => g.mesh);

    const allHits = raycaster.intersectObjects(
      ([...botTargets, ...barricadeMeshes, ...cameraMeshes, ...wallMeshes, ...remoteTargets, ...gadgetMeshes] as THREE.Object3D[]),
      true
    );
    allHits.sort((a, b) => a.distance - b.distance);
    const closest = allHits[0];

    this.drawTracer(origin, dir, closest ? closest.distance : 45);

    // Broadcast shot over LAN
    networkClient.notifyShot(origin, dir, this.currentWeapon().id, closest ? closest.point : undefined);

    if (closest) {
      // Check Security Camera destruction
      const hitCam = this.securityCameras.find(c => !c.isDestroyed && (c.hitMesh === closest.object || c.mesh.getObjectById(closest.object.id)));
      if (hitCam) {
        hitCam.hp -= this.currentWeapon().dmg;
        this.spawnImpact(closest.point, 0x00e5ff);
        if (hitCam.hp <= 0) {
          hitCam.isDestroyed = true;
          hitCam.ledMat.color.setHex(0x111111);
          this.spawnBreachExplosion(hitCam.pos, new THREE.Vector3(0, -1, 0));
          this.sound.playShockZap();
          this.log(`[CCTV] ${hitCam.name} DESTROYED BY ACCURATE FIRE!`);
        }
        return;
      }

      // Check deployed gadget hit (turrets, jammers, mines, cameras, shields, etc.)
      const hitGadget = gadgetSystem.findGadgetByObjectId(closest.object.id);
      if (hitGadget) {
        const destroyed = gadgetSystem.damageGadget(hitGadget.id, this.currentWeapon().dmg, this);
        this.spawnImpact(closest.point, 0xffaa00);
        this.sound.hit();
        if (destroyed) {
          this.log(`Destroyed ${hitGadget.name}!`);
        }
        return;
      }

      // Check remote human player hit
      let hitRemote: any = null;
      networkClient.remotePlayers.forEach(rp => {
        if (rp.alive && rp.side === enemySide && rp.mesh) {
          if (rp.mesh === closest.object || rp.mesh.getObjectById(closest.object.id)) {
            hitRemote = rp;
          }
        }
      });
      if (hitRemote) {
        networkClient.notifyDamage(hitRemote.id, this.currentWeapon().dmg);
        this.spawnImpact(closest.point, 0xff2222);
        this.sound.hit();
        this.log(`Hit operative ${hitRemote.name} for ${this.currentWeapon().dmg} DMG!`);
        return;
      }

      // Check bot hit
      const bot = this.bots.find(b => b.hitMesh === closest.object || b.mesh.getObjectById(closest.object.id));
      if (bot) {
        this.damageUnit(bot, this.currentWeapon().dmg);
        this.spawnImpact(closest.point, 0xff3333);
        return;
      }

      // Check barricade damage
      const barricade = this.barricades.find(b => !b.isBreached && b.mesh.getObjectById(closest.object.id));
      if (barricade) {
        barricade.hp -= this.currentWeapon().dmg;
        this.spawnSplinterDebris(closest.point, barricade.normal, 4);
        if (barricade.hp <= 0) {
          this.breachBarricade(barricade, false);
        }
        return;
      }

      this.spawnImpact(closest.point, 0xffcc66);
    }
  }

  public colliderMeshes(): THREE.Mesh[] {
    return this.scene.children.filter(
      o => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry && (o as THREE.Mesh).geometry.type === 'BoxGeometry' && o !== this.viewmodelGroup
    ) as THREE.Mesh[];
  }

  public drawTracer(origin: THREE.Vector3, dir: THREE.Vector3, dist: number) {
    const end = origin.clone().add(dir.clone().multiplyScalar(dist));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xfff0aa, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bulletTracers.push({ line, life: 0.05 });
  }

  public muzzleFlash() {
    this.muzzleLight.position.copy(this.camera.position);
    this.muzzleLight.intensity = 4.0;
    this.viewmodelKick = 1.0;
    if (this.viewmodelFlash) {
      this.viewmodelFlash.material.opacity = 1;
      this.viewmodelFlash.material.rotation = Math.random() * Math.PI;
    }
  }

  public startReload() {
    const w = this.currentWeapon();
    if (this.player.reloading || this.player.ammoReserve[w.id] <= 0 || this.player.ammoInMag[w.id] === w.mag) return;
    this.player.reloading = true;
    this.player.reloadT = 1.6;
    this.sound.reload();
    this.log('Reloading ' + w.name + '...');
    this.onStateUpdate?.();
  }

  // ---------------------------------------------------------------------
  // 6. HUMAN-LIKE TACTICAL BOT AI
  // ---------------------------------------------------------------------
  private updateDefenderDroneCombat(bot: BotUnit, dt: number, diffMul: number): boolean {
    if (!this.drone || this.drone.destroyed) return false;

    const droneDist = bot.mesh.position.distanceTo(this.drone.pos);
    if (droneDist > 14) return false;

    const eyePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const droneTarget = this.drone.pos.clone().add(new THREE.Vector3(0, 0.06, 0));
    if (!this.hasLineOfSight(eyePos, droneTarget)) return false;

    // Angle detection: drone in front field-of-view OR close proximity noise (<3.2m)
    const toDrone = new THREE.Vector3().subVectors(this.drone.pos, bot.mesh.position).normalize();
    const botFwd = new THREE.Vector3(Math.sin(bot.mesh.rotation.y), 0, Math.cos(bot.mesh.rotation.y));
    const dot = botFwd.dot(toDrone);

    if (dot < 0.25 && droneDist > 3.2) {
      return false; // Behind defender and beyond immediate motor hearing range
    }

    // Detected! Face toward the drone
    bot.mesh.rotation.y = Math.atan2(toDrone.x, toDrone.z);

    bot.fireT -= dt;
    if (bot.fireT <= 0) {
      bot.fireT = 0.55 / diffMul;
      bot.recoilKick = 0.35;

      const muzzlePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.drawTracer(muzzlePos, toDrone, droneDist);
      this.sound.shot();
      this.spawnImpact(this.drone.pos, 0xffaa33);

      if (Math.random() < 0.7 * diffMul) {
        this.drone.hp -= 20;
        if (this.drone.hp <= 0) {
          this.drone.destroy(this.scene);
          this.sound.breachExplode();
          this.log(`[DEF-${bot.op.name}] "Hostile recon neutralized!"`);
          this.onStateUpdate?.();
        }
      }
    }
    return true;
  }

  // Bots notice dangerous enemy gadgets (turrets, mines, jammers, tripwires) within sight range
  // and shoot them down when no enemy player is currently visible, instead of walking into them blind.
  private updateBotGadgetEngagement(bot: BotUnit, dt: number, diffMul: number): boolean {
    const enemySide = bot.side === 'atk' ? 'def' : 'atk';
    const threatTypes = [
      'evil_eye', 'ads_defense', 'entry_denial', 'welcome_mat', 'signal_disruptor',
      'shock_wire', 'razorbloom', 'trax_stingers', 'airjab_mine', 'black_eye_cam'
    ];
    const eyePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));

    let closest: any = null;
    let closestDist = Infinity;
    for (const g of gadgetSystem.gadgets) {
      if (g.ownerSide !== enemySide || !threatTypes.includes(g.type)) continue;
      const dist = bot.mesh.position.distanceTo(g.pos);
      if (dist > 15) continue;
      const target = g.pos.clone().add(new THREE.Vector3(0, 0.15, 0));
      if (!this.hasLineOfSight(eyePos, target)) continue;
      if (dist < closestDist) { closestDist = dist; closest = g; }
    }
    if (!closest) return false;

    const toG = new THREE.Vector3().subVectors(closest.pos, bot.mesh.position).normalize();
    bot.mesh.rotation.y = Math.atan2(toG.x, toG.z);

    bot.fireT -= dt;
    if (bot.fireT <= 0) {
      bot.fireT = 0.35 / diffMul;
      bot.recoilKick = 0.3;
      const muzzlePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.drawTracer(muzzlePos, toG, closestDist);
      this.sound.shot();
      if (Math.random() < 0.7 * diffMul) {
        const destroyed = gadgetSystem.damageGadget(closest.id, 22, this);
        this.spawnImpact(closest.pos, 0xffaa00);
        if (destroyed) {
          this.log(`[${bot.side.toUpperCase()}-${bot.op.name}] "Enemy device down!"`);
        }
      }
    }
    return true;
  }

  public updateBots(dt: number) {
    const diffMul = this.difficulty === 'Easy' ? 0.7 : (this.difficulty === 'Hard' ? 1.4 : 1.0);
    const reactionDelay = this.difficulty === 'Easy' ? 0.5 : (this.difficulty === 'Hard' ? 0.15 : 0.3);

    // PREPARATION PHASE: Defenders hold angles, patrol interior rooms, deploy gadgets, and shoot at recon drones!
    if (this.match.phase === 'prep') {
      this.bots.forEach(bot => {
        if (!bot.alive || bot.side !== 'def') return;

        // Defenders deploy defensive gadgets during prep phase
        if (!bot.hasPlacedPrepGadget && this.match.phaseTimer < 18) {
          bot.hasPlacedPrepGadget = true;
          this.triggerBotGadget(bot);
        }

        // If an active recon drone is buzzing around, defenders try to shoot it down
        this.updateDefenderDroneCombat(bot, dt, diffMul);

        // Weapon recoil recovery
        if (bot.recoilKick > 0) {
          bot.recoilKick = Math.max(0, bot.recoilKick - dt * 4);
          bot.weaponGroup.position.z = 0.48 - bot.recoilKick * 0.08;
        }
      });
      return;
    }

    if (this.match.phase !== 'action') return;

    this.bots.forEach(bot => {
      if (!bot.alive) return;
      if (bot.stunned > 0) { bot.stunned -= dt; return; }

      // In Action Phase, defenders still eliminate intrusive recon drones if spotted!
      if (bot.side === 'def' && this.drone && !this.drone.destroyed) {
        const engagedDrone = this.updateDefenderDroneCombat(bot, dt, diffMul);
        if (engagedDrone) {
          // Recoil recovery and return
          if (bot.recoilKick > 0) {
            bot.recoilKick = Math.max(0, bot.recoilKick - dt * 4);
            bot.weaponGroup.position.z = 0.48 - bot.recoilKick * 0.08;
          }
          return;
        }
      }

      const sighting = this.perceive(bot);

      // No enemy player currently visible: check for dangerous enemy gadgets in view and clear them
      if (!sighting) {
        const engagedGadget = this.updateBotGadgetEngagement(bot, dt, diffMul);
        if (engagedGadget) {
          if (bot.recoilKick > 0) {
            bot.recoilKick = Math.max(0, bot.recoilKick - dt * 4);
            bot.weaponGroup.position.z = 0.48 - bot.recoilKick * 0.08;
          }
          return;
        }
      }

      this.updateBeliefs(bot, dt, sighting);
      bot.state = this.chooseState(bot, sighting);

      // Periodic human-like tactical radio voice callouts
      const now = performance.now();
      if (!bot.lastCalloutTime || now - bot.lastCalloutTime > 6500) {
        if (bot.state === 'ENGAGE' && sighting) {
          bot.lastCalloutTime = now;
          const calls = bot.side === 'atk'
            ? ['"Hostile contact sighted! Opening fire!"', '"Target acquired, moving in!"', '"Engaging defender!"']
            : ['"Intruder contact! Fire on target!"', '"Hostile on sight! Hold the angle!"', '"Engaging attacker!"'];
          this.log(`[${bot.side.toUpperCase()}-${bot.op.name}] ${calls[Math.floor(Math.random() * calls.length)]}`);
        } else if (bot.state === 'RETREAT') {
          bot.lastCalloutTime = now;
          this.log(`[${bot.side.toUpperCase()}-${bot.op.name}] "Taking heavy damage! Falling back to cover!"`);
        } else if (bot.state === 'INVESTIGATE' && Math.random() < 0.2) {
          bot.lastCalloutTime = now;
          this.log(`[${bot.side.toUpperCase()}-${bot.op.name}] "Hearing movement, checking corners..."`);
        }
      }

      // AI Tactical Gadget Deployment in Action Phase
      if (bot.gadgetCooldown !== undefined) {
        bot.gadgetCooldown -= dt;
        if (bot.gadgetCooldown <= 0 && (bot.gadgetCharges === undefined || bot.gadgetCharges > 0)) {
          if (bot.state === 'ENGAGE' || (bot.state === 'INVESTIGATE' && Math.random() < 0.1)) {
            bot.gadgetCooldown = 14 + Math.random() * 8;
            if (bot.gadgetCharges !== undefined) bot.gadgetCharges--;
            this.triggerBotGadget(bot);
          }
        }
      }

      // Bot Navigation & Strategy based on tactical role
      bot.nextThink -= dt;
      let goalChanged = false;
      if (bot.nextThink <= 0 || (bot.state === 'ENGAGE' && bot.nextThink <= 0.2)) {
        bot.nextThink = 0.5 + Math.random() * 0.4;
        const believed = this.bestBelievedPos(bot);
        const oldGoal = bot.moveGoal.clone();

        if (this.match.defuserPlanted && bot.side === 'def') {
          // DEFUSER IS TICKING: Defenders abandon roaming and rush to retake objective and disable defuser!
          const target = this.match.defuserPos || this.objectivePos;
          bot.moveGoal.set(
            target.x + (Math.random() - 0.5) * 0.8,
            target.y,
            target.z + (Math.random() - 0.5) * 0.8
          );
        } else if (!this.match.defuserPlanted && bot.side === 'atk' && this.match.defuserDropped && this.match.defuserPos) {
          // Recovery is higher priority than generic roaming: the closest attacker retrieves it.
          bot.moveGoal.copy(this.match.defuserPos);
        } else if (bot.state === 'ENGAGE' && sighting) {
          // Tactical side-stepping & angle holding while shooting
          const strafe = (Math.random() - 0.5) * 1.8;
          bot.moveGoal.set(
            sighting.info.pos.x + strafe,
            sighting.info.pos.y,
            sighting.info.pos.z + (Math.random() - 0.5) * 1.8
          );
        } else if ((bot.state === 'INVESTIGATE' || bot.state === 'SUSPICIOUS') && believed) {
          bot.moveGoal.set(believed.x + (Math.random() - 0.5) * 1.5, believed.y, believed.z + (Math.random() - 0.5) * 1.5);
        } else if (bot.state === 'RETREAT') {
          // Fall back behind hard cover inside objective room
          bot.moveGoal.copy(this.objectivePos);
        } else {
          // Role-specific tactical behavior
          if (bot.side === 'def') {
            if (bot.assignedRole === 'roamer') {
              const roamWaypoints = navGraph.getNodesByRole('roamer');
              const wp = roamWaypoints[Math.floor(Math.random() * roamWaypoints.length)];
              if (wp) bot.moveGoal.copy(wp.pos);
            } else {
              // Anchors hold tight crossfires directly inside or on doorways of the bomb site
              bot.moveGoal.set(
                this.objectivePos.x + (Math.random() - 0.5) * 3.0,
                this.objectivePos.y,
                this.objectivePos.z + (Math.random() - 0.5) * 3.0
              );
            }
          } else {
            // Attackers systematically push toward entryways, doors, and objective
            bot.moveGoal.set(
              this.objectivePos.x + (Math.random() - 0.5) * 3.5,
              this.objectivePos.y,
              this.objectivePos.z + (Math.random() - 0.5) * 3.5
            );
          }
        }

        if (bot.moveGoal.distanceToSquared(oldGoal) > 1.5 || !bot.pathWaypoints || bot.pathWaypoints.length === 0) {
          goalChanged = true;
          bot.pathWaypoints = navGraph.findPath(bot.mesh.position, bot.moveGoal);
          bot.pathIndex = 0;
        }
      }

      // Defuser Interactions by Bots
      const targetPos = this.match.defuserPlanted || this.match.defuserDropped ? (this.match.defuserPos || this.objectivePos) : this.objectivePos;
      const distToObj = bot.mesh.position.distanceTo(targetPos);

      if (this.match.defuserPlanted && bot.side === 'def' && distToObj < 2.2 && bot.state !== 'ENGAGE') {
        this.match.defuseProgress = Math.min(100, (this.match.defuseProgress || 0) + dt * 18);
        if (Math.random() < 0.08) this.sound.customTone(500 + this.match.defuseProgress * 4, 0.04, 'triangle');
        if (this.match.defuseProgress >= 100) {
          this.sound.secure();
          this.endRound('def', 'defuser disabled');
        }
      } else if (!this.match.defuserPlanted && bot.side === 'atk' && this.match.defuserDropped && distToObj < 2.2) {
        this.recoverDefuser(bot);
      } else if (!this.match.defuserPlanted && bot.side === 'atk' && this.match.defuserCarrier === bot.id && bot.mesh.position.distanceTo(this.objectivePos) < 2.5) {
        const defendersNearby = this.bots.some(b => b.alive && b.side === 'def' && b.mesh.position.distanceTo(this.objectivePos) < 6.0);
        if (!defendersNearby) {
          this.match.plantProgress = Math.min(100, (this.match.plantProgress || 0) + dt * 22);
          if (this.match.plantProgress >= 100) {
            this.plantDefuser(bot.mesh.position);
          }
        }
      }

      // A* Waypoint Pathfinding Movement & Walking Animation
      let activeWp = bot.moveGoal;
      if (bot.pathWaypoints && bot.pathWaypoints.length > 0) {
        const pIdx = bot.pathIndex || 0;
        if (pIdx < bot.pathWaypoints.length) {
          activeWp = bot.pathWaypoints[pIdx];
          const distToWp = Math.hypot(activeWp.x - bot.mesh.position.x, activeWp.z - bot.mesh.position.z);
          if (distToWp < 0.75) {
            bot.pathIndex = pIdx + 1;
            if (bot.pathIndex < bot.pathWaypoints.length) {
              activeWp = bot.pathWaypoints[bot.pathIndex];
            } else {
              activeWp = bot.moveGoal;
            }
          }
        }
      }

      const dx = activeWp.x - bot.mesh.position.x;
      const dz = activeWp.z - bot.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const isMoving = dist > 0.35;

      if (isMoving) {
        const spd = 2.4 * diffMul * (bot.speedBoost ?? 1) * dt;
        const nx = bot.mesh.position.x + (dx / dist) * spd;
        const nz = bot.mesh.position.z + (dz / dist) * spd;
        if (!this.collides(nx, nz, bot.mesh.position.y + 1.2, 0.32, 1.7)) {
          bot.mesh.position.x = nx;
          bot.mesh.position.z = nz;
        } else {
          // If stuck against obstacle, recalculate path
          bot.pathWaypoints = navGraph.findPath(bot.mesh.position, bot.moveGoal);
          bot.pathIndex = 0;
        }

        // Adjust bot floor height for stairs / 2nd floor
        const botFloor = this.getFloorHeight(bot.mesh.position.x, bot.mesh.position.z, bot.mesh.position.y);
        bot.mesh.position.y += (botFloor - bot.mesh.position.y) * Math.min(1, dt * 14);

        // Face movement direction
        bot.mesh.rotation.y = Math.atan2(dx, dz);

        // Animate legs walking cycle
        bot.walkCycle += dt * 10;
        bot.leftLeg.rotation.x = Math.sin(bot.walkCycle) * 0.6;
        bot.rightLeg.rotation.x = -Math.sin(bot.walkCycle) * 0.6;
      } else {
        bot.leftLeg.rotation.x = 0;
        bot.rightLeg.rotation.x = 0;
      }

      // Tactical Barricade Breaching: If a bot is obstructed by an intact wooden barricade, breach it!
      const nearbyBarricade = this.barricades.find(
        b => !b.isBreached && b.position.distanceTo(bot.mesh.position) < 2.0
      );
      if (nearbyBarricade && (bot.side === 'atk' || bot.state === 'ENGAGE' || bot.state === 'INVESTIGATE')) {
        bot.fireT -= dt * 2;
        if (bot.fireT <= 0) {
          bot.fireT = 0.5;
          nearbyBarricade.hp -= 40;
          this.sound.woodSnap();
          this.spawnSplinterDebris(nearbyBarricade.position, nearbyBarricade.normal, 4);
          if (nearbyBarricade.hp <= 0) {
            this.breachBarricade(nearbyBarricade, false);
            this.log(`[${bot.side.toUpperCase()}-${bot.op.name}] Breached barricade!`);
          }
        }
      }

      // If engaging target, track aim vector with torso and weapon!
      const aimTarget = sighting ? sighting.info.pos : this.bestBelievedPos(bot);
      if (aimTarget) {
        const aimDir = new THREE.Vector3().subVectors(aimTarget, bot.mesh.position).normalize();
        const targetYaw = Math.atan2(aimDir.x, aimDir.z);
        bot.mesh.rotation.y = targetYaw;

        // Torso & arms pitch
        const pitch = Math.asin(Math.max(-1, Math.min(1, -aimDir.y)));
        bot.torsoGroup.rotation.x = pitch * 0.5;
        bot.weaponGroup.rotation.x = pitch;
      }

      // Tactical Corner Peeking
      this.updateBotPeek(bot, dt, sighting);
      bot.marker.position.set(bot.mesh.position.x, bot.mesh.position.y + 2.3, bot.mesh.position.z);

      // Bot Combat & Shooting with full visible weapon tracers, sounds & animations!
      bot.fireT -= dt;
      if (bot.state === 'ENGAGE' && sighting && bot.fireT <= 0) {
        // Burst-fire cadence instead of one slow potshot every ~0.85s (which read as
        // passive/weak against automatic weapons). A bot opens with a reaction delay,
        // then rips a 3-6 round burst at rifle-like cadence before pausing to reacquire.
        if (bot.burstShotsLeft === undefined || bot.burstShotsLeft <= 0) {
          bot.fireT = reactionDelay / diffMul;
          bot.burstShotsLeft = 3 + Math.floor(Math.random() * 4);
          bot.recoilKick = 0.35;
          return;
        }
        bot.burstShotsLeft--;
        bot.fireT = bot.burstShotsLeft > 0
          ? (0.09 + Math.random() * 0.05) / diffMul
          : (0.45 + Math.random() * 0.35) / diffMul; // pause after burst before next one
        bot.recoilKick = 0.35;

        const movingPenalty = isMoving ? 0.8 : 1.0;
        const hitChance = 0.32 * diffMul * bot.aimSkill * movingPenalty;

        // Calculate muzzle tip and target position for tracer
        const muzzlePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const targetPt = sighting.info.pos.clone().add(new THREE.Vector3(0, sighting.info.isPlayer ? 0 : 0.8, 0));
        const shotDir = new THREE.Vector3().subVectors(targetPt, muzzlePos).normalize();
        const shotDist = muzzlePos.distanceTo(targetPt);

        // Visible tracer bullet line and gunshot sound!
        this.drawTracer(muzzlePos, shotDir, shotDist);
        this.sound.shot();

        if (Math.random() < hitChance) {
          const dmg = (8 + Math.random() * 6) * diffMul;
          if (sighting.info.isPlayer) {
            this.damagePlayer(dmg);
            this.spawnImpact(this.camera.position, 0xff3333);
          } else if (sighting.info.unit) {
            this.damageUnit(sighting.info.unit, dmg);
            this.spawnImpact(targetPt, 0xff3333);
          }
        } else {
          // Ricochet spark nearby
          this.spawnImpact(targetPt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5)), 0xffcc44);
        }

        this.broadcastSound(bot.mesh.position.clone(), bot.side, 20);
      }

      // Weapon recoil recovery
      if (bot.recoilKick > 0) {
        bot.recoilKick = Math.max(0, bot.recoilKick - dt * 4);
        bot.weaponGroup.position.z = 0.48 - bot.recoilKick * 0.08;
      }
    });
  }

  public updateBotPeek(bot: BotUnit, dt: number, sighting: any) {
    if (bot.state !== 'ENGAGE' && bot.state !== 'HOLD') {
      bot.leanState = 0;
      bot.leanAmount += (0 - bot.leanAmount) * Math.min(1, dt * this.LEAN_TRANSITION_SPEED);
      bot.torsoGroup.rotation.z = 0;
      return;
    }

    bot.peekTimer += dt;
    if (bot.peekTimer > 1.2) {
      bot.peekTimer = 0;
      bot.leanState = Math.random() < 0.4 ? 1 : (Math.random() < 0.8 ? -1 : 0);
    }
    bot.leanAmount += (bot.leanState - bot.leanAmount) * Math.min(1, dt * this.LEAN_TRANSITION_SPEED);
    bot.torsoGroup.rotation.z = -bot.leanAmount * 0.18; // Physically tilts torso around corner
  }

  public perceive(bot: BotUnit): { info: { pos: THREE.Vector3; isPlayer: boolean; unit?: BotUnit }; dist: number } | null {
    const sightRange = 22 * bot.personality.engageBonus;
    let seen: { pos: THREE.Vector3; isPlayer: boolean; unit?: BotUnit } | null = null;
    let seenDist = Infinity;

    if (this.player.alive && this.player.side !== bot.side && !this.player.cloaked) {
      const d = bot.mesh.position.distanceTo(this.player.pos);
      if (d < sightRange && this.canSee(bot, this.player.pos, sightRange)) {
        seen = { pos: this.player.pos, isPlayer: true };
        seenDist = d;
      }
    }
    this.bots.forEach(o => {
      if (o === bot || !o.alive || o.side === bot.side || o.cloaked) return;
      const d = bot.mesh.position.distanceTo(o.mesh.position);
      if (d < sightRange && d < seenDist && this.canSee(bot, o.mesh.position, sightRange)) {
        seen = { pos: o.mesh.position, isPlayer: false, unit: o };
        seenDist = d;
      }
    });
    return seen ? { info: seen, dist: seenDist } : null;
  }

  public canSee(bot: BotUnit, targetPos: THREE.Vector3, maxRange: number): boolean {
    const eyePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const d = eyePos.distanceTo(targetPos);
    if (d > maxRange) return false;
    const dir = new THREE.Vector3().subVectors(targetPos, eyePos).normalize();
    const rc = new THREE.Raycaster(eyePos, dir, 0.1, d);

    // Wall & Barricades block LOS
    const wallHits = rc.intersectObjects(this.colliderMeshes());
    const barricadeHits = rc.intersectObjects(this.barricades.filter(b => !b.isBreached).map(b => b.mesh), true);

    if (wallHits.length > 0 && wallHits[0].distance < d - 0.4) return false;
    if (barricadeHits.length > 0 && barricadeHits[0].distance < d - 0.4) return false;

    return true;
  }

  public hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const d = from.distanceTo(to);
    if (d > 35) return false;
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const rc = new THREE.Raycaster(from, dir, 0.1, d);
    const wallHits = rc.intersectObjects(this.colliderMeshes());
    const barricadeHits = rc.intersectObjects(this.barricades.filter(b => !b.isBreached).map(b => b.mesh), true);
    if (wallHits.length > 0 && wallHits[0].distance < d - 0.3) return false;
    if (barricadeHits.length > 0 && barricadeHits[0].distance < d - 0.3) return false;
    return true;
  }

  public updateBeliefs(bot: BotUnit, dt: number, sighting: any) {
    const now = performance.now() / 1000;
    if (sighting) {
      bot.memory.lastKnownPos = sighting.info.pos.clone();
      bot.memory.lastKnownTime = now;
      bot.memory.confidence = 1.0;
      this.broadcastSighting(bot.side, sighting.info.pos, 0.9);
    } else {
      const sinceSeen = now - bot.memory.lastKnownTime;
      const sinceHeard = now - bot.memory.lastHeardTime;
      if (bot.memory.lastKnownPos && sinceSeen < 10) {
        bot.memory.confidence = Math.max(0, 1 - sinceSeen / 10);
      } else if (bot.memory.lastHeardPos && sinceHeard < 7) {
        bot.memory.confidence = Math.max(bot.memory.confidence * 0.985, 0.4 * (1 - sinceHeard / 7));
      } else {
        bot.memory.confidence = Math.max(0, bot.memory.confidence - dt * 0.18);
      }
      if (sinceSeen >= 10) bot.memory.lastKnownPos = null;
      if (sinceHeard >= 7) bot.memory.lastHeardPos = null;
    }
  }

  public chooseState(bot: BotUnit, sighting: any): 'HOLD' | 'SUSPICIOUS' | 'INVESTIGATE' | 'ENGAGE' | 'RETREAT' {
    // `caution` scales how early a bot bails to RETREAT (cautious personalities peel off sooner;
    // aggressive ones fight closer to zero HP). `holdBias` scales how readily a bot leaves its
    // post to go investigate a lead vs. staying put. Both were tracked on Personality but never
    // actually consulted anywhere, so every bot behaved identically regardless of personality.
    const retreatThreshold = bot.personality.retreatHp * bot.personality.caution;
    if (bot.hp <= retreatThreshold && bot.memory.confidence > 0.2) return 'RETREAT';
    if (sighting) return 'ENGAGE';
    const investigateThreshold = 0.35 + bot.personality.holdBias * 0.3;
    const suspiciousThreshold = 0.08 + bot.personality.holdBias * 0.12;
    if (bot.memory.confidence > investigateThreshold) return 'INVESTIGATE';
    if (bot.memory.confidence > suspiciousThreshold) return 'SUSPICIOUS';
    return 'HOLD';
  }

  public bestBelievedPos(bot: BotUnit): THREE.Vector3 | null {
    return bot.memory.lastKnownPos || bot.memory.lastHeardPos || null;
  }

  public broadcastSighting(side: 'atk' | 'def', pos: THREE.Vector3, confidence: number) {
    this.sideCallouts[side] = { pos: pos.clone(), time: performance.now() / 1000, confidence };
  }

  public broadcastSound(pos: THREE.Vector3, shooterSide: 'atk' | 'def', loudness: number) {
    const now = performance.now() / 1000;
    this.bots.forEach(b => {
      if (!b.alive || b.side === shooterSide) return;
      const d = b.mesh.position.distanceTo(pos);
      const range = loudness * (b.personality.hearRange / 18);
      if (d > range) return;
      const hearChance = Math.max(0, 1 - d / range);
      if (Math.random() > hearChance) return;
      const jitter = 1 + (d / range) * 3;
      const guessed = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * jitter, 0, (Math.random() - 0.5) * jitter));
      if (b.memory.lastHeardTime < now - 0.4) {
        b.memory.lastHeardPos = guessed;
        b.memory.lastHeardTime = now;
        b.memory.confidence = Math.max(b.memory.confidence, 0.45 * hearChance);
      }
    });
  }

  public damageUnit(bot: BotUnit, dmg: number) {
    // Mirrors damagePlayer()'s shielded reduction, for bot-side Montagne/Blackbeard.
    const dmgTaken = bot.shielded ? dmg * 0.5 : dmg;
    bot.hp -= dmgTaken;
    if (bot.hp <= 0 && bot.alive) {
      bot.alive = false;
      bot.mesh.visible = false;
      bot.marker.visible = false;
      if (this.match.defuserCarrier === bot.id) this.dropDefuser(bot.mesh.position);
      this.log(`[AI-${bot.side.toUpperCase()}] ${bot.op.name} eliminated.`);
      this.checkRoundEnd();
    }
    this.onStateUpdate?.();
  }

  public damagePlayer(dmg: number) {
    if (!this.player.alive) return;
    const dmgTaken = this.player.shielded ? dmg * 0.5 : dmg;
    this.player.hp -= dmgTaken;
    this.sound.hit();
    this.screenShakeIntensity = 0.5;
    if (this.player.hp <= 0) this.onPlayerDeath();
    this.onStateUpdate?.();
  }

  public checkRoundEnd() {
    if (this.match.phase !== 'action') return;
    const atkAliveBots = this.bots.filter(b => b.alive && b.side === 'atk').length + (this.player.side === 'atk' && this.player.alive ? 1 : 0);
    const defAliveBots = this.bots.filter(b => b.alive && b.side === 'def').length + (this.player.side === 'def' && this.player.alive ? 1 : 0);
    if (atkAliveBots <= 0) this.endRound('def', 'all attackers eliminated');
    else if (defAliveBots <= 0) this.endRound('atk', 'all defenders eliminated');
  }

  public onPlayerDeath() {
    if (!this.player.alive) return;
    this.player.alive = false;
    if (this.match.defuserCarrier === 'player') this.dropDefuser(this.player.pos);
    try {
      document.exitPointerLock();
    } catch {}
    this.log('You were eliminated — spectating active tactical bots.');
    this.checkRoundEnd();
    this.onStateUpdate?.();
  }

  public collides(
    x: number,
    z: number,
    y?: number,
    radius: number = 0.32,
    height: number = 1.65,
    customMinY?: number,
    customMaxY?: number
  ): boolean {
    const testY = y !== undefined ? y : (this.player ? this.player.pos.y : 1.7);
    const pMinY = customMinY !== undefined ? customMinY : (testY - height + 0.1);
    const pMaxY = customMaxY !== undefined ? customMaxY : (testY + 0.15);
    const pMinX = x - radius;
    const pMaxX = x + radius;
    const pMinZ = z - radius;
    const pMaxZ = z + radius;

    for (const c of this.colliders) {
      if (
        pMaxX > c.minX &&
        pMinX < c.maxX &&
        pMaxZ > c.minZ &&
        pMinZ < c.maxZ &&
        pMaxY > c.minY &&
        pMinY < c.maxY
      ) {
        return true;
      }
    }

    // Solid deployed gadgets (Kiba barriers, Talon shields) block movement too — these
    // aren't part of the static map so they never lived in this.colliders.
    for (const c of gadgetSystem.getMovementColliders()) {
      if (
        pMaxX > c.minX &&
        pMinX < c.maxX &&
        pMaxZ > c.minZ &&
        pMinZ < c.maxZ &&
        pMaxY > c.minY &&
        pMinY < c.maxY
      ) {
        return true;
      }
    }
    return false;
  }

  public getFloorHeight(x: number, z: number, currentFeetY: number = 0): number {
    // Warehouse District: single open floor, except for a small west-side mezzanine deck.
    if (this.currentMapKey === 'warehouse') {
      const MEZZ_Y = 3.0, MEZZ_X0 = -21, MEZZ_X1 = -15, MEZZ_Z0 = -8, MEZZ_Z1 = 8;
      // On top of the deck
      if (x >= MEZZ_X0 && x <= MEZZ_X1 && z >= MEZZ_Z0 && z <= MEZZ_Z1 && currentFeetY > 1.2) return MEZZ_Y;
      // Stair ramp up to the deck (south end)
      if (x >= MEZZ_X0 && x <= MEZZ_X1 && z >= -11 && z < MEZZ_Z0) {
        const t = Math.max(0, Math.min(1, (z - (-11)) / (MEZZ_Z0 - (-11))));
        return 0.02 + t * (MEZZ_Y - 0.02);
      }
      return 0.02;
    }

    // Office Tower: different footprint/2F height/staircase location than the house maps.
    if (this.currentMapKey === 'office_tower') {
      const stairZStart = -9, stairZEnd = -9 + 14 * 0.36; // ~-3.96
      const F2_Y = 4.4;
      if (x >= 9.9 && x <= 12.1 && z >= stairZStart && z <= stairZEnd) {
        const stairT = Math.max(0, Math.min(1, (z - stairZStart) / (stairZEnd - stairZStart)));
        return 0.02 + stairT * (F2_Y - 0.02);
      }
      if (x >= -14.7 && x <= 14.7 && z >= -12.7 && z <= 12.7) {
        if (currentFeetY > 2.0) return F2_Y;
      }
      return 0.02;
    }

    // 1. Staircase ramp: X between 0.6 and 2.4, Z between -3.2 and 2.2
    if (x >= 0.6 && x <= 2.4 && z >= -3.2 && z <= 2.2) {
      const stairT = Math.max(0, Math.min(1, (z - (-3.2)) / (2.2 - (-3.2))));
      return 0.02 + stairT * (3.45 - 0.02);
    }

    // 2. Roof deck (if player vaulted or rappelled onto roof)
    if (x >= -12.6 && x <= 12.6 && z >= -9.6 && z <= 9.6 && currentFeetY > 5.0) {
      return 6.4 + 0.35;
    }

    // 3. Second floor (if inside house perimeter and entity is on 2F)
    if (x >= -12.2 && x <= 12.2 && z >= -9.2 && z <= 9.2) {
      if (currentFeetY > 1.8) {
        return 3.45; // Exactly matches top of 2F slab!
      }
    }

    // 4. Exterior Front Porch
    if (x >= -3.2 && x <= 3.2 && z >= -11.5 && z <= -8.8) {
      return 0.18;
    }

    // 5. Exterior Front Walkway
    if (x >= -2.0 && x <= 2.0 && z >= -19.0 && z <= -11.5) {
      return 0.15;
    }

    // 6. Ground floor interior
    if (x >= -12.0 && x <= 12.0 && z >= -9.0 && z <= 9.0) {
      return x > 3.0 ? 0.03 : 0.02;
    }

    // Ground floor / Outdoors
    return 0.0;
  }

  // ---------------------------------------------------------------------
  // 7. MOVEMENT & LEANING
  // ---------------------------------------------------------------------
  public updateMovement(dt: number) {
    if (this.inCctvMode && this.securityCameras.length > 0) {
      const activeCam = this.securityCameras[this.activeCctvIndex];
      if (activeCam) {
        this.camera.position.copy(activeCam.pos);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = activeCam.rot.yaw;
        this.camera.rotation.x = activeCam.rot.pitch;
        this.camera.rotation.z = 0;
        if (this.viewmodelGroup) this.viewmodelGroup.visible = false;

        if (this.isCameraOperational(activeCam)) {
          const enemySide = this.player.side === 'atk' ? 'def' : 'atk';
          this.bots.filter(b => b.alive && b.side === enemySide).forEach(b => {
            if (b.mesh.position.distanceTo(activeCam.pos) < 22) {
              if (!this.droneSpottedEnemies.has(b.id)) {
                this.droneSpottedEnemies.add(b.id);
                this.sound.pingHostile();
                this.log(`HOSTILE IDENTIFIED ON CCTV: ${b.op.name.toUpperCase()}`);
                this.onStateUpdate?.();
              }
            }
          });
        }
      }
      return;
    }

    if (this.inDroneMode && this.drone) {
      this.drone.update(
        dt,
        this.keys,
        (x, z, y) => this.collides(x, z, y ?? this.drone!.pos.y, 0.11, 0.10, (y ?? this.drone!.pos.y) - 0.04, (y ?? this.drone!.pos.y) + 0.08),
        (freq, dur, type) => this.sound.customTone(freq, dur, type),
        (x, z, y) => this.getFloorHeight(x, z, y)
      );
      this.camera.position.copy(this.drone.getCameraPosition());
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.drone.yaw;
      this.camera.rotation.x = this.drone.pitch;
      this.camera.rotation.z = 0;
      if (this.viewmodelGroup) this.viewmodelGroup.visible = false;

      // Scan surroundings with direct line of sight
      if (!this.drone.destroyed) {
        const scan = this.drone.scanSurroundings(this.bots, this.objectivePos, (from, to) => this.hasLineOfSight(from, to));
        if (scan.spottedEnemy && !this.droneSpottedEnemies.has(scan.spottedEnemy)) {
          this.droneSpottedEnemies.add(scan.spottedEnemy);
          this.sound.pingHostile();
          this.log(`HOSTILE IDENTIFIED: ${scan.spottedEnemy.toUpperCase()}`);
          const spottedBot = this.bots.find(b => b.op.name === scan.spottedEnemy);
          if (spottedBot) spottedBot.marker.visible = true;
          this.onStateUpdate?.();
        }
        if (scan.spottedObjective && !this.droneSpottedObjective) {
          this.droneSpottedObjective = true;
          this.sound.pingObjective();
          this.log('OBJECTIVE LOCATED: BIOHAZARD CONTAINER (2F VAULT)');
          this.onStateUpdate?.();
        }
      }
      return;
    }

    if (this.player.isRappelling) {
      this.updateRappel(dt);
      this.camera.position.copy(this.player.pos);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.player.yaw;
      this.camera.rotation.x = this.player.pitch;
      return;
    }

    if (!this.player.alive || this.match.phase !== 'action') {
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.player.yaw;
      this.camera.rotation.x = this.player.pitch;
      return;
    }

    // Vertical Jump & Gravity physics
    const feetY = this.player.pos.y - this.PLAYER_H;
    const targetFloorY = this.getFloorHeight(this.player.pos.x, this.player.pos.z, feetY);

    if (this.player.pos.y - this.PLAYER_H > targetFloorY + 0.05) {
      this.player.vy -= 18 * dt; // gravity
    } else {
      if (this.player.vy < 0) this.player.vy = 0;
      if (this.player.pos.y - this.PLAYER_H < targetFloorY) {
        this.player.pos.y = targetFloorY + this.PLAYER_H;
      }
    }
    this.player.pos.y += this.player.vy * dt;
    const targetEyeY = targetFloorY + this.PLAYER_H;
    if (this.player.pos.y - this.PLAYER_H <= targetFloorY + 0.05 && Math.abs(this.player.vy) < 0.1) {
      if (Math.abs(this.player.pos.y - targetEyeY) > 0.01) {
        this.player.pos.y += (targetEyeY - this.player.pos.y) * Math.min(1, dt * 14);
      }
    }

    const forward = new THREE.Vector3(Math.sin(this.player.yaw) * -1, 0, Math.cos(this.player.yaw) * -1);
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    let move = new THREE.Vector3();
    if (this.keys['KeyW']) move.add(forward);
    if (this.keys['KeyS']) move.sub(forward);
    if (this.keys['KeyA']) move.sub(right);
    if (this.keys['KeyD']) move.add(right);
    if (move.lengthSq() > 0) move.normalize();

    const sprinting = !!this.keys['ShiftLeft'] && move.lengthSq() > 0 && !this.player.crouching;
    const stunSlow = this.player.stunned > 0 ? 0.15 : 1;
    const baseSpeed = 4.2 * (this.player.speedBoost || 1) * (this.player.crouching ? 0.55 : 1) * stunSlow;
    const speed = sprinting ? baseSpeed * 1.6 : baseSpeed;
    const nx = this.player.pos.x + move.x * speed * dt;
    const nz = this.player.pos.z + move.z * speed * dt;
    const currentEyeY = this.player.pos.y;
    if (!this.collides(nx, this.player.pos.z, currentEyeY, 0.32, this.PLAYER_H)) this.player.pos.x = nx;
    if (!this.collides(this.player.pos.x, nz, currentEyeY, 0.32, this.PLAYER_H)) this.player.pos.z = nz;

    this.footstepTimer -= dt;
    if (sprinting && this.footstepTimer <= 0) {
      this.footstepTimer = 0.45;
      this.broadcastSound(this.player.pos.clone(), this.player.side, 8);
    }

    // Leaning (Q / E)
    const leftHeld = !!this.keys['KeyQ'];
    const rightHeld = !!this.keys['KeyE'];
    this.player.leanState = (leftHeld && !rightHeld) ? -1 : (rightHeld && !leftHeld) ? 1 : 0;
    this.player.leanAmount += (this.player.leanState - this.player.leanAmount) * Math.min(1, dt * this.LEAN_TRANSITION_SPEED);

    let safeLean = this.player.leanAmount;
    if (Math.abs(safeLean) > 0.01) {
      for (let frac = 1; frac > 0; frac -= 0.1) {
        const testOffset = right.clone().multiplyScalar(safeLean * frac * this.LEAN_OFFSET_X);
        if (!this.collides(this.player.pos.x + testOffset.x, this.player.pos.z + testOffset.z, currentEyeY, 0.2, this.PLAYER_H)) {
          safeLean = safeLean * frac;
          break;
        }
        if (frac <= 0.1) safeLean = 0;
      }
    }
    this.player.currentLeanAmount = safeLean;

    const crouchOffset = this.player.crouching ? -0.45 : 0;
    const finalOffset = right.clone().multiplyScalar(safeLean * this.LEAN_OFFSET_X);
    finalOffset.y = safeLean !== 0 ? this.LEAN_OFFSET_Y * Math.abs(safeLean) : 0;

    // Apply Screen Shake
    let shakeX = 0, shakeY = 0;
    if (this.screenShakeIntensity > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShakeIntensity * 0.15;
      shakeY = (Math.random() - 0.5) * this.screenShakeIntensity * 0.15;
      this.screenShakeIntensity = Math.max(0, this.screenShakeIntensity - dt * 3);
    }

    // Flashbang whiteout fade — mirrors player.stunned's ~4.5s duration so the visual
    // clears out at roughly the same time control returns.
    if (this.flashWhiteout > 0) {
      this.flashWhiteout = Math.max(0, this.flashWhiteout - dt * 0.35);
    }

    this.camera.position.set(
      this.player.pos.x + finalOffset.x + shakeX,
      this.player.pos.y + crouchOffset + finalOffset.y + shakeY,
      this.player.pos.z + finalOffset.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    this.camera.rotation.z = -safeLean * this.LEAN_ROTATION;

    if (this.player.abilityCooldown > 0) {
      this.player.abilityCooldown -= dt;
    }
    if (this.player.stunned > 0) {
      this.player.stunned = Math.max(0, this.player.stunned - dt);
    }

    this.updateThrowableGrenades(dt);
    this.updateWallhackPings(dt);

    if (this.player.reloading) {
      this.player.reloadT -= dt;
      if (this.player.reloadT <= 0) {
        const w = this.currentWeapon();
        const need = w.mag - this.player.ammoInMag[w.id];
        const take = Math.min(need, this.player.ammoReserve[w.id]);
        this.player.ammoInMag[w.id] += take;
        this.player.ammoReserve[w.id] -= take;
        this.player.reloading = false;
        this.onStateUpdate?.();
      }
    }

    this.muzzleLight.intensity *= 0.8;
    if (this.muzzleLight.intensity < 0.01) this.muzzleLight.intensity = 0;

    this.updateViewmodel(dt, move.lengthSq() > 0);
    this.secureTick(dt);
    this.updateDefuserInteraction(dt);
  }

  public plantDefuser(planterPos: THREE.Vector3 = this.player.pos) {
    if (this.match.defuserPlanted || !this.match.defuserCarrier) return;
    this.match.defuserPlanted = true;
    this.match.plantProgress = 0;
    this.match.defuseProgress = 0;
    this.match.defuserTimer = 45.0;
    this.match.defuserCarrier = null;
    this.match.defuserDropped = false;
    this.match.defuserPos = planterPos.clone();
    this.match.defuserPos.y = this.getFloorHeight(planterPos.x, planterPos.z, planterPos.y - this.PLAYER_H) + 0.05;

    this.spawnDefuserProp(this.match.defuserPos);

    this.sound.playGadgetDeploy();
    this.log('[DEFUSER PLANTED] Defuser armed on site! 45s countdown initiated! Attackers defend, Defenders retake and disable!');
    networkClient.notifyDefuserAction('plant', this.match.defuserPos);
    this.onStateUpdate?.();
  }

  /** Drops the actual recoverable device; called for the carrier's player/bot death. */
  public dropDefuser(pos: THREE.Vector3) {
    if (this.match.defuserPlanted || !this.match.defuserCarrier) return;
    const ground = pos.clone();
    ground.y = this.getFloorHeight(ground.x, ground.z, ground.y - this.PLAYER_H) + 0.05;
    this.match.defuserCarrier = null;
    this.match.defuserDropped = true;
    this.match.defuserPos = ground;
    this.spawnDefuserProp(ground);
    this.log('[DEFUSER DROPPED] Attackers must recover the device.');
  }

  public recoverDefuser(carrier: 'player' | BotUnit) {
    if (this.match.defuserPlanted || !this.match.defuserDropped) return false;
    const pos = carrier === 'player' ? this.player.pos : carrier.mesh.position;
    if (!this.match.defuserPos || pos.distanceTo(this.match.defuserPos) > 2.2) return false;
    this.match.defuserCarrier = carrier === 'player' ? 'player' : carrier.id;
    this.match.defuserDropped = false;
    if (this.match.defuserMesh) this.scene.remove(this.match.defuserMesh);
    this.match.defuserMesh = null;
    this.match.defuserPos = null;
    this.log(`[DEFUSER RECOVERED] ${carrier === 'player' ? 'Player' : carrier.op.name} is carrying it.`);
    return true;
  }

  public updateDefuserInteraction(dt: number) {
    if (this.match.phase !== 'action') return;

    // 1. Attackers Planting Defuser near Objective Site
    if (this.player.side === 'atk' && this.player.alive && !this.match.defuserPlanted) {
      if (this.match.defuserDropped) this.recoverDefuser('player');
      const distToSite = Math.hypot(this.player.pos.x - this.objectivePos.x, this.player.pos.z - this.objectivePos.z);
      if (this.match.defuserCarrier === 'player' && distToSite < 4.0) {
        if (this.keys['Slash'] || this.keys['KeyE'] || this.keys['KeyF']) {
          this.match.plantProgress = Math.min(100, (this.match.plantProgress || 0) + dt * 25);
          if (Math.random() < 0.1) this.sound.customTone(700 + this.match.plantProgress * 4, 0.04, 'sine');
          if (this.match.plantProgress >= 100) {
            this.plantDefuser();
          }
          this.onStateUpdate?.();
        } else {
          if (this.match.plantProgress > 0) {
            this.match.plantProgress = Math.max(0, this.match.plantProgress - dt * 35);
            this.onStateUpdate?.();
          }
        }
      }
    }

    // 2. Defenders Disabling Defuser
    if (this.player.side === 'def' && this.player.alive && this.match.defuserPlanted && this.match.defuserPos) {
      const distToDefuser = this.player.pos.distanceTo(this.match.defuserPos);
      if (distToDefuser < 2.5) {
        if (this.keys['Slash'] || this.keys['KeyE'] || this.keys['KeyF']) {
          this.match.defuseProgress = Math.min(100, (this.match.defuseProgress || 0) + dt * 20);
          if (Math.random() < 0.1) this.sound.customTone(450 + this.match.defuseProgress * 5, 0.05, 'triangle');
          if (this.match.defuseProgress >= 100) {
            this.sound.secure();
            networkClient.notifyDefuserAction('defuse');
            this.endRound('def', 'defuser disabled');
          }
          this.onStateUpdate?.();
        } else {
          if (this.match.defuseProgress > 0) {
            this.match.defuseProgress = Math.max(0, this.match.defuseProgress - dt * 35);
            this.onStateUpdate?.();
          }
        }
      }
    }
  }

  public secureTick(dt: number) {
    if (this.match.phase !== 'action') return;
    const r = this.match.secureRadius;
    const atkNear = (this.player.side === 'atk' && this.player.alive && Math.hypot(this.player.pos.x - this.objectivePos.x, this.player.pos.z - this.objectivePos.z) < r) ||
      this.bots.some(b => b.alive && b.side === 'atk' && Math.hypot(b.mesh.position.x - this.objectivePos.x, b.mesh.position.z - this.objectivePos.z) < r);
    const defNear = (this.player.side === 'def' && this.player.alive && Math.hypot(this.player.pos.x - this.objectivePos.x, this.player.pos.z - this.objectivePos.z) < r) ||
      this.bots.some(b => b.alive && b.side === 'def' && Math.hypot(b.mesh.position.x - this.objectivePos.x, b.mesh.position.z - this.objectivePos.z) < r);

    if (atkNear && !defNear && !this.match.defuserPlanted) {
      this.match.secureTimer += dt;
      if (this.match.secureTimer >= this.match.secureNeeded) {
        this.sound.secure();
        this.endRound('atk', 'objective secured');
      }
    } else {
      this.match.secureTimer = Math.max(0, this.match.secureTimer - dt * 1.5);
    }
  }

  public updateViewmodel(dt: number, isMoving: boolean) {
    if (!this.viewmodelGroup) return;
    this.viewmodelBob += dt * (isMoving ? 9 : 2.2);
    const bobAmt = isMoving ? 0.018 : 0.004;
    const targetX = 0.14 + Math.sin(this.viewmodelBob * 0.5) * 0.004;
    const targetY = -0.15 + Math.sin(this.viewmodelBob) * bobAmt;
    this.viewmodelGroup.position.x += (targetX - this.viewmodelGroup.position.x) * Math.min(1, dt * 10);
    this.viewmodelGroup.position.y += (targetY - this.viewmodelGroup.position.y) * Math.min(1, dt * 10);

    if (this.viewmodelKick > 0) this.viewmodelKick = Math.max(0, this.viewmodelKick - dt * 7);
    this.viewmodelGroup.rotation.x = -this.viewmodelKick * 0.12;
    this.viewmodelGroup.position.z = -0.42 + this.viewmodelKick * 0.06;

    if (this.viewmodelFlash) {
      this.viewmodelFlash.material.opacity = Math.max(0, this.viewmodelFlash.material.opacity - dt * 9);
    }
  }

  public spawnImpact(point: THREE.Vector3, colorHex: number) {
    const count = 10;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = point.x; pos[i * 3 + 1] = point.y; pos[i * 3 + 2] = point.z;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: colorHex || 0xffcc66, size: 0.06, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.impactBursts.push({ points, vel, life: 0.4, maxLife: 0.4 });
  }

  public updateImpacts(dt: number) {
    for (let i = this.impactBursts.length - 1; i >= 0; i--) {
      const b = this.impactBursts[i];
      b.life -= dt;
      const posAttr = b.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < b.vel.length; j++) {
        b.vel[j].y -= 4 * dt;
        posAttr.array[j * 3] += b.vel[j].x * dt;
        posAttr.array[j * 3 + 1] += b.vel[j].y * dt;
        posAttr.array[j * 3 + 2] += b.vel[j].z * dt;
      }
      posAttr.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        this.scene.remove(b.points);
        this.impactBursts.splice(i, 1);
      }
    }

    // Update Debris pieces
    for (let i = this.debrisPieces.length - 1; i >= 0; i--) {
      const d = this.debrisPieces[i];
      d.life -= dt;
      d.vel.y -= 9.8 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;

      if (d.mesh.position.y <= 0.05) {
        d.mesh.position.y = 0.05;
        d.vel.set(0, 0, 0);
      }

      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debrisPieces.splice(i, 1);
      }
    }
  }

  public updatePhase(dt: number) {
    if (this.match.phase === 'prep') {
      this.match.phaseTimer -= dt;
      if (this.match.phaseTimer <= 0) {
        if (this.inDroneMode) {
          this.exitDroneMode();
        }
        this.match.phase = 'action';
        this.match.phaseTimer = this.match.actionLength;
        this.log('BREACH & INFILTRATE! Action Phase Started!');
      }
    } else if (this.match.phase === 'action') {
      if (this.match.defuserPlanted) {
        // When defuser is active, the round timer is superseded by defuser countdown!
        const prevT = this.match.defuserTimer;
        this.match.defuserTimer -= dt;
        if (Math.floor(prevT) !== Math.floor(this.match.defuserTimer) && this.match.defuserTimer > 0) {
          this.sound.customTone(this.match.defuserTimer < 10 ? 1100 : 800, 0.04, 'square');
        }
        if (this.match.defuserTimer <= 0) {
          this.sound.breachExplode();
          this.spawnBreachExplosion(this.match.defuserPos || this.objectivePos, new THREE.Vector3(0, 1, 0));
          this.endRound('atk', 'defuser detonated');
        }
      } else {
        this.match.phaseTimer -= dt;
        if (this.match.phaseTimer <= 0) {
          this.endRound('def', 'attackers ran out of time');
        }
      }
    } else if (this.match.phase === 'result') {
      this.match.phaseTimer -= dt;
      if (this.match.phaseTimer <= 0) {
        this.advanceMatch();
      }
    }
  }

  // Wraps setTimeout for any gadget effect that reads live game state (this.bots,
  // this.barricades, this.player) when it fires. The id is tracked so clearRoundEntities()
  // can cancel it if the round ends before the delay elapses — see the comment there.
  // Twitch's Shock Drone fire: a real bullet fired from the drone's own camera/barrel,
  // hitting the same things a normal gunshot would (bots, remote players, deployed gadgets,
  // security cameras, barricades, walls) via the same raycast-and-resolve approach as
  // raycastShot(), instead of the old narrow angle-check hitscan that only ever touched bots.
  public fireDroneGun() {
    if (!this.drone) return;
    this.drone.fireCooldown = 0.12;
    this.sound.shot();
    this.broadcastSound(this.drone.pos.clone(), this.player.side, 16);

    const eyePos = this.drone.getCameraPosition();
    const dir = new THREE.Vector3(-Math.sin(this.drone.yaw) * Math.cos(this.drone.pitch), Math.sin(this.drone.pitch), -Math.cos(this.drone.yaw) * Math.cos(this.drone.pitch)).normalize();
    const raycaster = new THREE.Raycaster(eyePos, dir, 0.02, 40);

    const enemySide = this.player.side === 'atk' ? 'def' : 'atk';
    const botTargets = this.bots.filter(b => b.alive && b.side === enemySide).map(b => b.hitMesh);

    const remoteTargets: THREE.Object3D[] = [];
    networkClient.remotePlayers.forEach(rp => {
      if (rp.alive && rp.side === enemySide && rp.mesh) {
        remoteTargets.push(rp.mesh);
      }
    });

    const barricadeMeshes = this.barricades.filter(b => !b.isBreached).map(b => b.mesh);
    const cameraMeshes = this.securityCameras.filter(c => !c.isDestroyed).map(c => c.hitMesh);
    const wallMeshes = this.colliderMeshes();
    const gadgetMeshes = gadgetSystem.gadgets.map(g => g.mesh);

    const allHits = raycaster.intersectObjects(
      ([...botTargets, ...barricadeMeshes, ...cameraMeshes, ...wallMeshes, ...remoteTargets, ...gadgetMeshes] as THREE.Object3D[]),
      true
    );
    allHits.sort((a, b) => a.distance - b.distance);
    const closest = allHits[0];

    const bulletDmg = 20;
    this.drawTracer(eyePos, dir, closest ? closest.distance : 40);

    if (!closest) {
      this.log('[TWITCH] Shock Drone fired — shot went wide.');
      return;
    }

    // Security camera hit
    const hitCam = this.securityCameras.find(c => !c.isDestroyed && (c.hitMesh === closest.object || c.mesh.getObjectById(closest.object.id)));
    if (hitCam) {
      hitCam.hp -= bulletDmg;
      this.spawnImpact(closest.point, 0x00e5ff);
      if (hitCam.hp <= 0) {
        hitCam.isDestroyed = true;
        hitCam.ledMat.color.setHex(0x111111);
        this.spawnBreachExplosion(hitCam.pos, new THREE.Vector3(0, -1, 0));
        this.sound.playShockZap();
        this.log(`[TWITCH] Shock Drone gunfire DESTROYED ${hitCam.name}!`);
      }
      return;
    }

    // Deployed gadget hit
    const hitGadget = gadgetSystem.findGadgetByObjectId(closest.object.id);
    if (hitGadget) {
      const destroyed = gadgetSystem.damageGadget(hitGadget.id, bulletDmg, this);
      this.spawnImpact(closest.point, 0xffaa00);
      this.sound.hit();
      if (destroyed) {
        this.log(`[TWITCH] Shock Drone gunfire destroyed ${hitGadget.name}!`);
      }
      return;
    }

    // Remote human player hit
    let hitRemote: any = null;
    networkClient.remotePlayers.forEach(rp => {
      if (rp.alive && rp.side === enemySide && rp.mesh) {
        if (rp.mesh === closest.object || rp.mesh.getObjectById(closest.object.id)) {
          hitRemote = rp;
        }
      }
    });
    if (hitRemote) {
      networkClient.notifyDamage(hitRemote.id, bulletDmg);
      this.spawnImpact(closest.point, 0xff2222);
      this.sound.hit();
      this.log(`[TWITCH] Shock Drone gunfire hit operative ${hitRemote.name} for ${bulletDmg} DMG!`);
      return;
    }

    // Bot hit
    const bot = this.bots.find(b => b.hitMesh === closest.object || b.mesh.getObjectById(closest.object.id));
    if (bot) {
      this.damageUnit(bot, bulletDmg);
      this.spawnImpact(closest.point, 0xff3333);
      this.log(`[TWITCH] Shock Drone gunfire hit ${bot.op.name} for ${bulletDmg} DMG!`);
      return;
    }

    // Barricade hit
    const barricade = this.barricades.find(b => !b.isBreached && b.mesh.getObjectById(closest.object.id));
    if (barricade) {
      barricade.hp -= bulletDmg;
      this.spawnSplinterDebris(closest.point, barricade.normal, 4);
      if (barricade.hp <= 0) {
        this.breachBarricade(barricade, false);
      }
      return;
    }

    this.spawnImpact(closest.point, 0xffcc66);
  }

  public scheduleTimeout(fn: () => void, delayMs: number): number {
    const id = window.setTimeout(fn, delayMs);
    this.pendingRoundTimeouts.push(id);
    return id;
  }

  public throwGrenade(type: 'frag' | 'flash' | 'smoke' | 'emp' | 'selma' | 'valkyrie_cam' | 'maestro_cam') {
    const fwd = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).normalize();
    const eyePos = this.camera.position.clone();

    const geo = new THREE.SphereGeometry(0.12, 10, 10);
    let matColor = 0x333333;
    if (type === 'flash') matColor = 0xffe27a;
    if (type === 'smoke') matColor = 0x94a3b8;
    if (type === 'emp') matColor = 0x00e5ff;
    if (type === 'selma') matColor = 0x3b82f6;
    if (type === 'valkyrie_cam') matColor = 0x10b981;
    if (type === 'maestro_cam') matColor = 0xef4444;

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: matColor, metalness: 0.85, roughness: 0.2 }));
    mesh.position.copy(eyePos).add(fwd.clone().multiplyScalar(0.4));
    this.scene.add(mesh);

    const pitchAngle = Math.max(-0.6, Math.min(0.8, this.player.pitch));
    const throwVel = fwd.clone().multiplyScalar(17).add(new THREE.Vector3(0, 5.5 + pitchAngle * 6, 0));

    this.throwableGrenades.push({
      id: `grenade_${Date.now()}_${Math.random()}`,
      type,
      pos: mesh.position,
      vel: throwVel,
      mesh,
      life: type === 'selma' ? 0.75 : ((type === 'valkyrie_cam' || type === 'maestro_cam') ? 999 : 2.2),
      ownerSide: this.player.side,
    });

    this.sound.playReloadSound();
    this.log(`[TACTICAL] ${type.toUpperCase()} THROWN!`);
  }

  public updateThrowableGrenades(dt: number) {
    for (let i = this.throwableGrenades.length - 1; i >= 0; i--) {
      const g = this.throwableGrenades[i];
      // Interception is evaluated against the actual moving object, before any fuse can fire.
      if (g.type !== 'valkyrie_cam' && g.type !== 'maestro_cam' && gadgetSystem.interceptProjectile(g, this)) {
        this.throwableGrenades.splice(i, 1);
        continue;
      }
      g.life -= dt;
      g.vel.y -= 13.5 * dt; // gravity
      
      const moveDist = g.vel.length() * dt;
      let hitSurface = false;

      if (moveDist > 0.001) {
        const rayDir = g.vel.clone().normalize();
        const raycaster = new THREE.Raycaster(g.pos, rayDir, 0.01, moveDist + 0.1);
        const wallMeshes = this.colliderMeshes();
        const barricadeMeshes = this.barricades.filter(b => !b.isBreached).map(b => b.mesh);
        const hits = raycaster.intersectObjects([...wallMeshes, ...barricadeMeshes], true);
        
        if (hits.length > 0) {
          const closestHit = hits[0];
          // Hit a wall/barricade!
          g.pos.copy(closestHit.point);
          hitSurface = true;
          if (g.type === 'valkyrie_cam' || g.type === 'maestro_cam') {
            if (closestHit.face) {
              g.hitNormal = closestHit.face.normal.clone().applyQuaternion(closestHit.object.quaternion).normalize();
            } else {
              g.hitNormal = new THREE.Vector3(0, 1, 0);
            }
            g.life = 0; // Trigger deployment immediately
          } else {
            // Bounce
            if (closestHit.face) {
              const normal = closestHit.face.normal.clone().applyQuaternion(closestHit.object.quaternion);
              g.vel.reflect(normal).multiplyScalar(0.5);
            } else {
              g.vel.y = -g.vel.y * 0.4;
            }
          }
        }
      }

      if (!hitSurface) {
        g.pos.addScaledVector(g.vel, dt);
      }
      g.mesh.position.copy(g.pos);

      // Floor bounce
      const floorH = this.getFloorHeight(g.pos.x, g.pos.z, g.pos.y);
      if (g.pos.y <= floorH + 0.12) {
        g.pos.y = floorH + 0.12;
        if (g.type === 'valkyrie_cam' || g.type === 'maestro_cam') {
          g.hitNormal = new THREE.Vector3(0, 1, 0);
          g.life = 0; // Trigger deployment immediately
        } else {
          g.vel.y = -g.vel.y * 0.45;
          g.vel.x *= 0.65;
          g.vel.z *= 0.65;
        }
      }

      // Timer detonation
      if (g.life <= 0) {
        this.detonateGrenade(g);
        this.scene.remove(g.mesh);
        this.throwableGrenades.splice(i, 1);
      }
    }
  }

  public detonateGrenade(g: any) {
    if (g.type === 'frag') {
      this.sound.breachExplode();
      this.spawnBreachExplosion(g.pos, new THREE.Vector3(0, 1, 0));
      this.bots.filter(b => b.alive && b.side !== g.ownerSide).forEach(b => this.damageUnit(b, 90));
      this.log('[FRAG] High-Explosive Frag Grenade detonated!');
    } else if (g.type === 'flash') {
      this.sound.playFlashbang();
      // Warden's Glance glasses grant full immunity to flashbangs — passive, so it's
      // checked here where the effect is applied rather than as an activated ability.
      this.bots.filter(b => b.alive && b.side !== g.ownerSide && b.op.id !== 'warden').forEach(b => { b.stunned = 4.5; });
      // BUG FIX: the human player never actually got flashed — only bots did. Stun the
      // player the same way if they're on the opposing side and within blast range, unless
      // they're playing Warden (same passive immunity bots get).
      if (
        this.player.alive &&
        this.player.side !== g.ownerSide &&
        this.player.op.id !== 'warden' &&
        this.player.pos.distanceTo(g.pos) < 10.0
      ) {
        this.player.stunned = Math.max(this.player.stunned, 4.5);
        this.flashWhiteout = 1.0;
        this.onStateUpdate?.();
      }
      this.log('[FLASHBANG] Strobe flashbang blinded hostiles!');
    } else if (g.type === 'smoke') {
      this.sound.playGasHiss(10);
      this.log('[SMOKE] Tactical smoke canister deployed!');
    } else if (g.type === 'emp') {
      this.sound.playEmpDischarge();
      this.empPulse(g.pos, 12);
      this.log('[EMP] Thatcher EMP blast disabled all electronics in radius!');
    } else if (g.type === 'selma') {
      this.sound.playGasHiss(2);
      this.log('[ACE] SELMA Aqua Breacher attached! Hydraulic sequential breaching engaged...');
      for (let seq = 1; seq <= 3; seq++) {
        this.scheduleTimeout(() => {
          this.sound.breachExplode();
          const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(g.pos) < 4.0);
          if (nearB) this.breachBarricade(nearB, false);
          this.spawnBreachExplosion(g.pos, new THREE.Vector3(0, 1, 0));
          this.bots.filter(b => b.alive && b.side !== g.ownerSide).forEach(b => this.damageUnit(b, 45));
          this.log(`[ACE] SELMA Hydraulic Blast #${seq} detonated!`);
        }, seq * 1100);
      }
    } else if (g.type === 'valkyrie_cam') {
      this.sound.playGadgetDeploy();
      const camId = `valk_cam_${Date.now()}`;

      const normal = g.hitNormal ? g.hitNormal.clone() : new THREE.Vector3(0, 1, 0);
      const camPos = g.pos.clone().add(normal.clone().multiplyScalar(0.08));

      const group = new THREE.Group();
      group.position.copy(camPos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Create a nice visible Black Eye ball model
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.8, roughness: 0.2 })
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.03, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      ring.rotation.x = Math.PI / 2;
      group.add(sphere, ring);
      this.scene.add(group);

      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.copy(camPos);
      this.scene.add(hitMesh);

      const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

      let yaw = this.player.yaw;
      let pitch = -0.2;
      if (g.hitNormal) {
        const dir = g.hitNormal.clone().normalize();
        yaw = Math.atan2(-dir.x, -dir.z);
        pitch = Math.asin(dir.y);
      }

      this.securityCameras.push({
        id: camId,
        name: `CAM-VALK: Black Eye #${this.securityCameras.length - 3}`,
        pos: camPos.clone().add(normal.clone().multiplyScalar(0.12)), // lens position slightly in front of wall
        rot: { yaw, pitch },
        mesh: group as any,
        hitMesh: hitMesh as any,
        ledMat,
        hp: 35,
        isDestroyed: false,
      });
      this.log('[VALKYRIE] Gyroscopic Black Eye Camera mounted on surface!');
    } else if (g.type === 'maestro_cam') {
      this.sound.playGadgetDeploy();
      const camId = `maestro_cam_${Date.now()}`;

      const normal = g.hitNormal ? g.hitNormal.clone() : new THREE.Vector3(0, 1, 0);
      const camPos = g.pos.clone().add(normal.clone().multiplyScalar(0.1));

      const group = new THREE.Group();
      group.position.copy(camPos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Heavy armored dome model
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x450a0a, metalness: 0.9, roughness: 0.15 })
      );
      const laserLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      laserLens.rotation.x = Math.PI / 2;
      laserLens.position.set(0, 0.08, 0.16);
      group.add(dome, laserLens);
      this.scene.add(group);

      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.copy(camPos);
      this.scene.add(hitMesh);

      const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

      let yaw = this.player.yaw;
      let pitch = -0.1;
      if (g.hitNormal) {
        const dir = g.hitNormal.clone().normalize();
        yaw = Math.atan2(-dir.x, -dir.z);
        pitch = Math.asin(dir.y);
      }

      this.securityCameras.push({
        id: camId,
        name: `CAM-MAESTRO: Evil Eye #${this.securityCameras.length - 3}`,
        pos: camPos.clone().add(normal.clone().multiplyScalar(0.15)), // lens position slightly in front of wall
        rot: { yaw, pitch },
        mesh: group as any,
        hitMesh: hitMesh as any,
        ledMat,
        hp: 120, // Heavily armored
        isDestroyed: false,
        isMaestro: true,
      });
      this.log('[MAESTRO] Heavily armored Evil Eye Laser Turret mounted on surface!');
    }
  }

  /** Applies the same temporary EMP state to deployables and the legacy camera system. */
  public empPulse(pos: THREE.Vector3, radius: number, seconds = 8) {
    gadgetSystem.disableElectronicsInRadius(pos, radius, this, seconds);
    const until = performance.now() + seconds * 1000;
    for (const camera of this.securityCameras) {
      if (!camera.isDestroyed && camera.pos.distanceTo(pos) <= radius) camera.empDisabledUntil = until;
    }
  }

  public getThrowableTypeForOperator(): 'valkyrie_cam' | 'maestro_cam' | null {
    if (!this.player.op) return null;
    if (this.player.op.id === 'valkyrie' || this.player.op.id === 'def_valkyrie') return 'valkyrie_cam';
    if (this.player.op.id === 'maestro' || this.player.op.id === 'def_maestro') return 'maestro_cam';
    // Mira's Black Mirror reuses the exact same valkyrie_cam mechanism (see the 'mira' case
    // in useAbility()) rather than a second camera implementation.
    if (this.player.op.id === 'mira') return 'valkyrie_cam';
    return null;
  }

  public executeThrow() {
    const type = this.getThrowableTypeForOperator();
    if (!type) return;

    if (this.player.gadgetCharges !== undefined && this.player.gadgetCharges <= 0) {
      this.log(`No remaining charges for ${this.player.op.gadgetName || 'ability'}!`);
      return;
    }
    if (this.player.abilityCooldown > 0) return;

    this.player.gadgetCharges = Math.max(0, (this.player.gadgetCharges || 1) - 1);
    this.player.abilityCooldown = 1.5; // fast throwing rate

    this.throwGrenade(type);
    this.onStateUpdate?.();
  }

  // Placement decal for an equipped breach charge — shown only while actively aiming
  // (mouse held down), same raycast plantBreachChargeAtAim() itself uses, so what you
  // see is exactly where it'll land when you release.
  public updateBreachPlantPreview() {
    if (!this.scene) return;
    if (!this.holdingBreachCharge || !this.isAimingThrow) {
      if (this.breachPreviewMesh) this.breachPreviewMesh.visible = false;
      return;
    }

    if (!this.breachPreviewMesh) {
      const geo = new THREE.RingGeometry(0.16, 0.22, 20);
      const mat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
      this.breachPreviewMesh = new THREE.Mesh(geo, mat);
      this.breachPreviewMesh.renderOrder = 9999;
      this.scene.add(this.breachPreviewMesh);
    }

    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
    const ray = new THREE.Raycaster(origin, dir, 0.1, 2.5);
    const barricadeMeshes = this.barricades.filter(b => !b.isBreached).map(b => b.mesh);
    const hits = ray.intersectObjects(barricadeMeshes, true);

    if (hits.length > 0) {
      const hit = hits[0];
      const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
      this.breachPreviewMesh.position.copy(hit.point).addScaledVector(normal, 0.02);
      this.breachPreviewMesh.lookAt(hit.point.clone().add(normal));
      (this.breachPreviewMesh.material as THREE.MeshBasicMaterial).color.setHex(0x22c55e);
      this.breachPreviewMesh.visible = true;
    } else {
      // Nothing valid in range — still show where it'd land at max range, tinted red.
      const p = origin.clone().addScaledVector(dir, 2.4);
      this.breachPreviewMesh.position.copy(p);
      this.breachPreviewMesh.lookAt(origin);
      (this.breachPreviewMesh.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
      this.breachPreviewMesh.visible = true;
    }
  }

  public updateTrajectoryPreview() {
    this.updateBreachPlantPreview();

    const type = this.getThrowableTypeForOperator();
    // Only draw the arc while actually aiming (mouse held down) with the camera equipped —
    // not just because it's equipped, so it doesn't clutter the view while walking around.
    if (!this.isHoldingThrow || !this.isAimingThrow || !type || !this.scene) {
      this.trajectoryPoints.forEach(m => { if (m) m.visible = false; });
      return;
    }

    // Clear and recreate if scene children changed
    const needsRecreate = this.trajectoryPoints.length === 0 || 
                          this.trajectoryPoints.some(m => !m || !this.scene.children.includes(m));

    if (needsRecreate) {
      this.trajectoryPoints.forEach(m => {
        if (m) {
          try { m.visible = false; this.scene.remove(m); } catch {}
          try { if (m.geometry) m.geometry.dispose(); } catch {}
          if (m.material) {
            try {
              if (Array.isArray(m.material)) {
                m.material.forEach(mat => mat.dispose());
              } else {
                m.material.dispose();
              }
            } catch {}
          }
        }
      });
      this.trajectoryPoints = [];

      const geom = new THREE.SphereGeometry(0.045, 6, 6);
      for (let j = 0; j < 25; j++) {
        const mat = new THREE.MeshBasicMaterial({ 
          color: type === 'valkyrie_cam' ? 0x10b981 : 0xef4444, 
          depthTest: false, 
          transparent: true, 
          opacity: 0.95 
        });
        const m = new THREE.Mesh(geom, mat);
        m.renderOrder = 9999;
        this.scene.add(m);
        this.trajectoryPoints.push(m);
      }
    }

    const color = type === 'valkyrie_cam' ? 0x10b981 : 0xef4444;
    const fwd = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).normalize();
    const p = this.camera.position.clone().add(fwd.clone().multiplyScalar(0.4));
    
    const pitchAngle = Math.max(-0.6, Math.min(0.8, this.player.pitch));
    const v = fwd.clone().multiplyScalar(17).add(new THREE.Vector3(0, 5.5 + pitchAngle * 6, 0));
    
    const gravity = 13.5;
    const step = 0.055;

    for (let j = 0; j < 25; j++) {
      const m = this.trajectoryPoints[j];
      if (!m) continue;
      m.position.copy(p);
      if (m.material && !(Array.isArray(m.material))) {
        (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      }
      m.visible = true;

      v.y -= gravity * step;
      p.addScaledVector(v, step);
    }
  }

  public fireMaestroLaser(activeCam: any) {
    if (activeCam.isDestroyed) return;

    // Laser firing cooldown check (e.g. 0.4 seconds)
    const now = performance.now();
    if (activeCam.lastFireTime && now - activeCam.lastFireTime < 400) return;
    activeCam.lastFireTime = now;

    // Play high-tech laser zap sound
    this.sfx(1200, 0.08, 'sawtooth', 0.12);

    // Calculate facing direction of the camera from its yaw and pitch
    const yaw = activeCam.rot.yaw;
    const pitch = activeCam.rot.pitch;
    const dir = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    // Perform a raycast from the camera lens
    const lensPos = activeCam.pos.clone().add(dir.clone().multiplyScalar(0.2));
    const ray = new THREE.Raycaster(lensPos, dir, 0.05, 100);

    const targets = [
      ...this.bots.filter(b => b.alive).map(b => b.mesh),
      ...this.colliderMeshes(),
      ...this.barricades.filter(b => !b.isBreached).map(b => b.mesh)
    ];
    const hits = ray.intersectObjects(targets, true);

    if (hits.length > 0) {
      const closest = hits[0];
      this.drawLaserTracer(lensPos, closest.point);
      this.spawnImpact(closest.point, 0xff3333);

      // Check if we hit a bot
      const hitObj = closest.object;
      const hitBot = this.bots.find(b => b.alive && (b.mesh === hitObj || b.mesh.getObjectById(hitObj.id) || b.mesh.getObjectByName(hitObj.name)));
      if (hitBot) {
        this.damageUnit(hitBot, 8); // 8 damage per zap
        this.log(`[MAESTRO EYE] Laser hit hostile ${hitBot.op.name} for 8 dmg!`);
      }
    } else {
      const end = lensPos.clone().add(dir.clone().multiplyScalar(40));
      this.drawLaserTracer(lensPos, end);
    }
  }

  public drawLaserTracer(origin: THREE.Vector3, end: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xff1122, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bulletTracers.push({ line, life: 0.1 });
  }

  public updateSpottedEnemies(dt: number) {
    this.spottedEnemies.forEach((info, key) => {
      info.decayTime -= dt;
      if (info.decayTime <= 0) {
        this.spottedEnemies.delete(key);
      }
    });

    // Sync from droneSpottedEnemies
    this.droneSpottedEnemies.forEach(id => {
      const bot = this.bots.find(b => b.id === id);
      if (bot && bot.alive) {
        this.spottedEnemies.set(id, {
          x: bot.mesh.position.x,
          y: bot.mesh.position.y,
          z: bot.mesh.position.z,
          decayTime: 5.0
        });
      }
    });
  }

  public updateWallhackPings(dt: number) {
    if (!this.scene) return;
    if (!this.wallhackPingGroup.parent) {
      this.scene.add(this.wallhackPingGroup);
    }

    // Clear previous pings
    while (this.wallhackPingGroup.children.length > 0) {
      const c = this.wallhackPingGroup.children[0];
      this.wallhackPingGroup.remove(c);
    }

    const enemySide = this.player.side === 'atk' ? 'def' : 'atk';
    const livingEnemies: THREE.Vector3[] = [];

    this.bots.filter(b => b.alive && b.side === enemySide).forEach(b => {
      livingEnemies.push(b.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    });

    networkClient.remotePlayers.forEach(rp => {
      if (rp.alive && rp.side === enemySide) {
        livingEnemies.push(rp.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
      }
    });

    // 1. Pulse Cardiac Sensor Wallhack
    if (this.player.isCardiacSensor && this.player.alive) {
      livingEnemies.forEach(pos => {
        if (this.player.pos.distanceTo(pos) <= 20.0) {
          const pingGeo = new THREE.OctahedronGeometry(0.32 + Math.sin(Date.now() * 0.012) * 0.07, 0);
          const pingMat = new THREE.MeshBasicMaterial({ color: 0xff1133, transparent: true, opacity: 0.95, depthTest: false });
          const pingMesh = new THREE.Mesh(pingGeo, pingMat);
          pingMesh.position.copy(pos);
          pingMesh.renderOrder = 9999;
          this.wallhackPingGroup.add(pingMesh);
        }
      });
    }

    // 2. Lion Sonar Scan Wallhack
    if (this.player.isLionScanning && this.player.alive) {
      livingEnemies.forEach(pos => {
        const pingGeo = new THREE.BoxGeometry(0.55, 1.0, 0.55);
        const pingMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.85, depthTest: false, wireframe: true });
        const pingMesh = new THREE.Mesh(pingGeo, pingMat);
        pingMesh.position.copy(pos);
        pingMesh.renderOrder = 9999;
        this.wallhackPingGroup.add(pingMesh);
      });
    }

    // 2b. Glaz Thermal Sight Wallhack — reuses this.player.isThermalVision, but Warden
    // flips the exact same flag for his own (unrelated) flash/smoke immunity toggle, so
    // this only renders pings when it's actually Glaz using it.
    if (this.player.isThermalVision && this.player.alive && this.player.op.id === 'glaz') {
      livingEnemies.forEach(pos => {
        if (this.player.pos.distanceTo(pos) <= 45.0) {
          const pingGeo = new THREE.SphereGeometry(0.3, 8, 8);
          const pingMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8, depthTest: false });
          const pingMesh = new THREE.Mesh(pingGeo, pingMat);
          pingMesh.position.copy(pos);
          pingMesh.renderOrder = 9999;
          this.wallhackPingGroup.add(pingMesh);
        }
      });
    }

    // 2c. IQ / Solis Electronics Detector Wallhack — BUG FIX: isElectronicsDetector was
    // being flipped by both operators' abilities but nothing ever rendered anything for
    // it, so the scanner didn't actually detect anything. Ping every enemy-owned
    // electronic gadget in range, same visual language as the other scan wallhacks.
    if (this.player.isElectronicsDetector && this.player.alive) {
      const enemySideForGadgets = this.player.side === 'atk' ? 'def' : 'atk';
      gadgetSystem.gadgets
        .filter(g => g.isElectronic && g.ownerSide === enemySideForGadgets && this.player.pos.distanceTo(g.pos) <= 30.0)
        .forEach(g => {
          const pingGeo = new THREE.TetrahedronGeometry(0.22 + Math.sin(Date.now() * 0.01) * 0.04, 0);
          const pingMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9, depthTest: false, wireframe: true });
          const pingMesh = new THREE.Mesh(pingGeo, pingMat);
          pingMesh.position.copy(g.pos).add(new THREE.Vector3(0, 0.3, 0));
          pingMesh.renderOrder = 9999;
          this.wallhackPingGroup.add(pingMesh);
        });
    }

    // 3. Drone & Camera Spotted Wallhack
    this.droneSpottedEnemies.forEach(enemyId => {
      const b = this.bots.find(b => b.alive && b.id === enemyId);
      if (b) {
        const pingGeo = new THREE.ConeGeometry(0.25, 0.45, 4);
        const pingMat = new THREE.MeshBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.95, depthTest: false });
        const pingMesh = new THREE.Mesh(pingGeo, pingMat);
        pingMesh.rotation.x = Math.PI;
        pingMesh.position.copy(b.mesh.position).add(new THREE.Vector3(0, 2.2, 0));
        pingMesh.renderOrder = 9999;
        this.wallhackPingGroup.add(pingMesh);
      }
    });
  }

  // Tab equip/holster toggle — press Tab once to equip whatever "the gadget" is for the
  // current operator, press it again to put it away and return to the weapon. No need to
  // hold the key down. This is intentionally NOT a menu/UI — it's a single-purpose equip
  // button:
  //  - Montagne/Blackbeard: raises/lowers their shield in place of a weapon.
  //  - Valkyrie/Maestro/Mira: equips their throwable camera in hand. Press-and-hold the
  //    left mouse button to aim (shows the trajectory arc), release to throw it — see
  //    onMouseDown()/onMouseUp() and updateTrajectoryPreview().
  //  - Any attacker with breach charges: equips one in hand. Press-and-hold to aim (shows
  //    a placement decal at exactly where it'll land), release to plant it — see
  //    updateBreachPlantPreview().
  //  - Everyone else: has no holdable item, so Tab does nothing — it's deliberately not a
  //    second [F], just the equip button for gadgets that can actually be held.
  public toggleHeldGadget() {
    if (!this.player.alive || this.inDroneMode || this.inCctvMode) return;
    if (this.match.phase !== 'action' && this.match.phase !== 'prep') return;
    const op = this.player.op;

    // 1. Shield operators
    if (op.id === 'montagne' || op.id === 'blackbeard') {
      const next = !this.player.shielded;
      this.player.shielded = next;
      if (op.id === 'montagne') this.player.isFullShieldExtended = next;
      this.sound.playGadgetDeploy();
      this.log(next
        ? (op.id === 'montagne' ? '[MONTAGNE] Le Roc Extended — 100% Frontal Bullet Immunity!' : '[BLACKBEARD] TARS Rifle Shield mounted!')
        : (op.id === 'montagne' ? '[MONTAGNE] Le Roc Retracted.' : '[BLACKBEARD] Rifle Shield removed.'));
      this.onStateUpdate?.();
      return;
    }

    // 2. Throwable-camera operators (Valkyrie/Maestro)
    const throwType = this.getThrowableTypeForOperator();
    if (throwType) {
      if (!this.isHoldingThrow) {
        if (this.player.gadgetCharges !== undefined && this.player.gadgetCharges <= 0) {
          this.log(`No remaining charges for ${this.player.op.gadgetName || 'ability'}!`);
          return;
        }
        if (this.player.abilityCooldown > 0) {
          this.log(`Ability recharging (${this.player.abilityCooldown.toFixed(1)}s remaining).`);
          return;
        }
      }
      this.isHoldingThrow = !this.isHoldingThrow;
      this.updateGadgetViewmodel();
      this.log(this.isHoldingThrow
        ? `${this.player.op.gadgetName || 'Camera'} equipped — hold click to aim, release to throw it.`
        : `${this.player.op.gadgetName || 'Camera'} holstered.`);
      return;
    }

    // 3. Attacker breach charges
    if (this.player.side === 'atk' && !this.player.activeBreachCharge) {
      if (!this.holdingBreachCharge && this.player.breachChargesLeft <= 0) {
        this.log('Out of Breach Charges!');
        return;
      }
      this.holdingBreachCharge = !this.holdingBreachCharge;
      this.updateGadgetViewmodel();
      this.log(this.holdingBreachCharge ? 'Breach Charge equipped — hold click to aim, release to plant it.' : 'Breach Charge holstered.');
      return;
    }

    // 4. Everyone else has no holdable/throwable item — Tab does nothing for them rather
    // than duplicating [F]'s ability button.
  }

  // Safety net: if the operator or side changed (loadout change) while something was held
  // via toggleHeldGadget(), make sure nothing stays stuck equipped for an operator/side that
  // no longer supports it.
  public updateHeldGadgets() {
    const op = this.player.op;
    if (this.player.shielded && op.id !== 'montagne' && op.id !== 'blackbeard') {
      this.player.shielded = false;
      this.player.isFullShieldExtended = false;
    }
    if (this.isHoldingThrow && !this.getThrowableTypeForOperator()) {
      this.isHoldingThrow = false;
      this.isAimingThrow = false;
      this.updateGadgetViewmodel();
    }
    if (this.holdingBreachCharge && (this.player.side !== 'atk' || !!this.player.activeBreachCharge)) {
      this.holdingBreachCharge = false;
      this.isAimingThrow = false;
      this.updateGadgetViewmodel();
    }
  }

  public useAbility() {
    if (!this.player.alive) return;
    if (this.player.stunned > 0) {
      this.log('Stunned — can\'t use gadgets right now!');
      return;
    }
    if (this.player.abilityCooldown > 0) {
      this.log(`Ability recharging (${this.player.abilityCooldown.toFixed(1)}s remaining).`);
      return;
    }
    if (this.player.gadgetCharges !== undefined && this.player.gadgetCharges <= 0) {
      this.log(`No remaining charges for ${this.player.op.gadgetName || 'ability'}!`);
      return;
    }

    const op = this.player.op;
    const fwd = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).normalize();
    const eyePos = this.player.pos.clone();
    const targetPos = eyePos.clone().add(fwd.clone().multiplyScalar(1.8));
    targetPos.y = this.getFloorHeight(targetPos.x, targetPos.z, eyePos.y - this.PLAYER_H) + 0.1;

    switch (op.id) {
      // --- ATTACKERS ---
      case 'sledge': {
        this.sound.playSledgeSmash();
        this.screenShakeIntensity = 0.6;
        const nearBarricade = this.barricades.find(b => !b.isBreached && b.position.distanceTo(eyePos) < 2.8);
        if (nearBarricade) {
          this.breachBarricade(nearBarricade, false);
          this.log('[SLEDGE] Tactical Breaching Hammer destroyed barricade!');
        } else {
          this.spawnSplinterDebris(eyePos.clone().add(fwd.clone().multiplyScalar(1.5)), fwd, 15);
          this.log('[SLEDGE] Tactical Breaching Hammer struck surface!');
        }
        // Melee takedown on close enemies
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(eyePos) < 2.4).forEach(b => {
          this.damageUnit(b, 100);
          this.log(`[SLEDGE] Melee takedown on ${b.op.name}!`);
        });
        this.player.abilityCooldown = 1.2;
        break;
      }
      case 'thatcher': {
        this.throwGrenade('emp');
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        break;
      }
      case 'ash': {
        this.sound.shot();
        this.sound.breachExplode();
        const impactPos = eyePos.clone().add(fwd.clone().multiplyScalar(10));
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(impactPos) < 3.5);
        if (nearB) this.breachBarricade(nearB, false);
        this.spawnBreachExplosion(impactPos, fwd.clone().negate());
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(impactPos) < 4.0).forEach(b => this.damageUnit(b, 65));
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[ASH] M120 CREM Breaching Round impacted target!');
        break;
      }
      case 'thermite': {
        this.sound.playGasHiss(2.5);
        this.log('[THERMITE] Exothermic charge planted! Sizzling... BREECHING!');
        this.scheduleTimeout(() => {
          if (!this.player.alive) return;
          this.sound.breachExplode();
          this.screenShakeIntensity = 0.8;
          const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(targetPos) < 3.0);
          if (nearB) this.breachBarricade(nearB, false);
          this.spawnBreachExplosion(targetPos, fwd);
          this.bots.filter(b => b.alive && b.mesh.position.distanceTo(targetPos) < 4.5).forEach(b => this.damageUnit(b, 90));
        }, 2200);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 6.0;
        break;
      }
      case 'twitch': {
        // Twitch's Shock Drone is piloted like the recon drone — reuses that exact same
        // ReconDrone class/camera-control system (this.drone/inDroneMode), just spawned from
        // a charge instead of the free prep-phase reserve, and flagged armed so left-click
        // (or holding it down) fires live rounds from its mounted gun (see fireDroneGun())
        // instead of doing nothing while piloting it.
        if (this.inDroneMode) {
          this.log('[TWITCH] Shock Drone already deployed and active.');
          break;
        }
        if ((this.player.gadgetCharges || 0) <= 0) {
          this.log('[TWITCH] No Shock Drones remaining.');
          break;
        }
        this.sound.playGadgetDeploy();
        // If her standing recon drone is still out, retire it cleanly first — otherwise its
        // mesh would be orphaned in the scene once this.drone gets reassigned below (still
        // visible, no longer updated, and no longer targetable by defenders shooting drones).
        if (this.drone && !this.drone.destroyed) {
          this.scene.remove(this.drone.mesh);
        }
        const fwdTwitch = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).normalize();
        const dropPosTwitch = this.player.pos.clone().add(fwdTwitch.multiplyScalar(1.0));
        dropPosTwitch.y = this.getFloorHeight(dropPosTwitch.x, dropPosTwitch.z, this.player.pos.y - this.PLAYER_H) + 0.055;
        this.drone = this.createSafeDrone(dropPosTwitch, this.player.yaw);
        this.drone.setArmed();
        this.scene.add(this.drone.mesh);
        this.inDroneMode = true;
        if (this.viewmodelGroup) this.viewmodelGroup.visible = false;
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 2.0;
        this.log('[TWITCH] Shock Drone deployed — piloting active. Left-click to fire, [ENTER]/[ESC] to return to your body.');
        this.onStateUpdate?.();
        break;
      }
      case 'montagne': {
        // Shield raise/lower is on [TAB] (see toggleHeldGadget()) instead of the ability key —
        // press Tab once to raise it, press again to lower it, so it doesn't cost a discrete "use".
        this.log('[MONTAGNE] Press [TAB] to raise/lower Le Roc shield.');
        break;
      }
      case 'glaz': {
        this.player.focusZoom = !this.player.focusZoom;
        this.player.isThermalVision = this.player.focusZoom;
        this.sound.playGadgetDeploy();
        this.player.abilityCooldown = 0.5;
        this.log(this.player.isThermalVision ? '[GLAZ] HDS Thermal Flip Sight Engaged — Enemies highlighted!' : '[GLAZ] Thermal Sight Disengaged.');
        break;
      }
      case 'fuze': {
        this.sound.playSledgeSmash();
        this.log('[FUZE] APM-6 Cluster Charge deployed! 5 explosive pucks launching!');
        for (let p = 1; p <= 5; p++) {
          this.scheduleTimeout(() => {
            this.sound.breachExplode();
            const puckPos = targetPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4));
            this.spawnBreachExplosion(puckPos, new THREE.Vector3(0, 1, 0));
            this.bots.filter(b => b.alive && b.mesh.position.distanceTo(puckPos) < 3.5).forEach(b => this.damageUnit(b, 55));
          }, p * 450);
        }
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 6.0;
        break;
      }
      case 'blitz': {
        this.sound.playFlashbang();
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(eyePos) < 8.0).forEach(b => {
          b.stunned = 4.0;
        });
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[BLITZ] G52-Tactical Flash Shield strobe flashed! Hostiles in cone blinded!');
        break;
      }
      case 'iq': {
        this.player.isElectronicsDetector = !this.player.isElectronicsDetector;
        this.sound.playPhoneBuzz();
        this.player.abilityCooldown = 0.5;
        this.log(this.player.isElectronicsDetector ? '[IQ] RED Electronics Detector active — scanning devices!' : '[IQ] Electronics Detector holstered.');
        break;
      }
      case 'buck': {
        this.sound.shot();
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(eyePos) < 3.2);
        if (nearB) this.breachBarricade(nearB, false);
        this.spawnSplinterDebris(eyePos.clone().add(fwd.clone().multiplyScalar(2)), fwd, 16);
        this.player.abilityCooldown = 0.8;
        this.log('[BUCK] Skeleton Key 12-Gauge breached target!');
        break;
      }
      case 'blackbeard': {
        // Same Tab-toggle change as Montagne above — see toggleHeldGadget().
        this.log('[BLACKBEARD] Press [TAB] to raise/lower the TARS rifle shield.');
        break;
      }
      case 'capitao': {
        this.sound.playGasHiss(7);
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(targetPos) < 4.0).forEach(b => this.damageUnit(b, 40));
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 3.5;
        this.log('[CAPITÃO] Asphyxiating fire bolt ignited target area!');
        break;
      }
      case 'hibana': {
        this.sound.breachExplode();
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(targetPos) < 3.0);
        if (nearB) this.breachBarricade(nearB, false);
        this.spawnSplinterDebris(targetPos, fwd, 12);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[HIBANA] X-KAIROS magnetic pellets detonated!');
        break;
      }
      case 'jackal': {
        // BUG FIX: only logged a name, never actually revealed anything. Reuses the same
        // real intel-reveal primitive as Zero above (droneSpottedEnemies + marker), for
        // the nearest enemy rather than the first one in array order, for a longer
        // tracking-style duration.
        this.sound.playHeartbeat();
        const enemySideJackal = this.player.side === 'atk' ? 'def' : 'atk';
        let tracked: BotUnit | null = null;
        let trackedD = Infinity;
        for (const b of this.bots) {
          if (!b.alive || b.side !== enemySideJackal) continue;
          const d = b.mesh.position.distanceTo(eyePos);
          if (d < trackedD) { trackedD = d; tracked = b; }
        }
        if (tracked) {
          this.droneSpottedEnemies.add(tracked.id);
          tracked.marker.visible = true;
          this.log(`[JACKAL] Eyenox visor scanned footprints! Hostile ${tracked.op.name} tagged!`);
          this.scheduleTimeout(() => {
            this.droneSpottedEnemies.delete(tracked!.id);
            if (tracked!.alive && !tracked!.isMate) tracked!.marker.visible = false;
          }, 15000);
        } else {
          this.log('[JACKAL] Eyenox visor scanning... No fresh prints found.');
        }
        this.player.abilityCooldown = 4.0;
        break;
      }
      case 'ying': {
        this.sound.playFlashbang();
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(targetPos) < 9.0).forEach(b => {
          b.stunned = 4.5;
        });
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[YING] Candela cluster flashed target sector!');
        break;
      }
      case 'zofia': {
        this.sound.breachExplode();
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(targetPos) < 3.5);
        if (nearB) this.breachBarricade(nearB, false);
        this.spawnSplinterDebris(targetPos, fwd, 12);
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(targetPos) < 5.0).forEach(b => {
          b.stunned = 3.5;
          this.damageUnit(b, 30);
        });
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 3.5;
        this.log('[ZOFIA] KS79 Lifeline concussion & breach round fired!');
        break;
      }
      case 'dokkaebi': {
        this.sound.playPhoneBuzz();
        this.player.isDokkaebiRinging = true;
        this.bots.filter(b => b.alive && b.side === 'def').forEach(b => {
          this.log(`[DOKKAEBI] [RING] Defender ${b.op.name}'s phone buzzing!`);
        });
        this.scheduleTimeout(() => { this.player.isDokkaebiRinging = false; }, 8000);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 15.0;
        this.log('[DOKKAEBI] Logic Bomb virus uploaded! Defender phones buzzing for 8s!');
        break;
      }
      case 'lion': {
        this.sound.playEmpDischarge();
        this.player.isLionScanning = true;
        this.log('[LION] EE-ONE-D Sonar Scan initiated! Stand still or be spotted!');
        this.scheduleTimeout(() => {
          this.bots.filter(b => b.alive && b.side === 'def' && b.state === 'ENGAGE').forEach(b => {
            this.log(`[LION] [PING] Moving defender ${b.op.name} detected on sonar!`);
          });
          this.player.isLionScanning = false;
        }, 4000);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 18.0;
        break;
      }
      case 'finka': {
        this.sound.playHeartbeat();
        this.player.hp = Math.min(125, this.player.hp + 25);
        this.bots.filter(b => b.alive && b.side === this.player.side).forEach(b => b.hp = Math.min(125, b.hp + 25));
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 15.0;
        this.log(`[FINKA] Adrenal Surge active! +25 HP overheal & zero recoil to squad! (HP: ${this.player.hp})`);
        break;
      }
      case 'maverick': {
        // BUG FIX: consumed cooldown, played a sound, logged success — but never actually
        // breached anything. Reuses the same soft-breach path Sledge/Buck use above.
        this.sound.playGasHiss(1.5);
        const mavB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(eyePos) < 2.8);
        if (mavB) {
          this.breachBarricade(mavB, false);
          this.log('[MAVERICK] Suri Torch melted murder hole through barrier!');
        } else {
          this.log('[MAVERICK] Suri Torch ignited — no surface in range.');
        }
        this.player.abilityCooldown = 2.0;
        break;
      }
      case 'nomad': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('airjab_mine', 'atk', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 3.0;
        this.log('[NOMAD] Airjab repulsion mine deployed on surface!');
        break;
      }
      case 'gridlock': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('trax_stingers', 'atk', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[GRIDLOCK] Trax Stingers caltrops deployed across floor!');
        break;
      }
      case 'nokk': {
        this.sound.playGadgetDeploy();
        this.player.isSilencedFootsteps = true;
        this.scheduleTimeout(() => { this.player.isSilencedFootsteps = false; }, 12000);
        this.player.abilityCooldown = 14.0;
        this.log('[NØKK] HEL Presence Reduction active — footsteps muted for 12s!');
        break;
      }
      case 'amaru': {
        this.sound.playSledgeSmash();
        this.player.pos.y = Math.min(this.player.pos.y + 3.2, 5.0);
        this.player.abilityCooldown = 6.0;
        this.log('[AMARU] Garra Hook propelled into target sector!');
        break;
      }
      case 'kali': {
        this.sound.breachExplode();
        this.empPulse(targetPos, 8);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[KALI] LV Explosive Lance detonated! Hostile gadgets destroyed!');
        break;
      }
      case 'iana': {
        // BUG FIX: consumed no charge, deployed nothing — just a log line. Reuses the
        // same real, destructible decoy gadget Alibi's Prisma uses (see the 'alibi' case
        // above) rather than inventing a second decoy system.
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('prisma_decoy', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 8.0;
        this.log('[IANA] Gemini Replicator holographic decoy deployed!');
        break;
      }
      case 'ace': {
        this.throwGrenade('selma');
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        break;
      }
      case 'zero': {
        // BUG FIX: no-op. Wired into the existing intel-reveal primitive (the same
        // droneSpottedEnemies / spottedEnemies wallhack-ping system the recon drone and
        // CCTV already use) instead of a fake camera object: find the nearest living
        // enemy, reveal their real position through walls for a few seconds.
        this.sound.playGadgetDeploy();
        const enemySideZero = this.player.side === 'atk' ? 'def' : 'atk';
        const scoutedTargets = this.bots.filter(b => b.alive && b.side === enemySideZero);
        let scouted: BotUnit | null = null;
        let bestD = Infinity;
        for (const b of scoutedTargets) {
          const d = b.mesh.position.distanceTo(eyePos);
          if (d < bestD) { bestD = d; scouted = b; }
        }
        if (scouted) {
          this.droneSpottedEnemies.add(scouted.id);
          scouted.marker.visible = true;
          this.log(`[ZERO] Argus drill camera bored through the wall — hostile ${scouted.op.name} spotted!`);
          this.scheduleTimeout(() => {
            this.droneSpottedEnemies.delete(scouted!.id);
            if (scouted!.alive && !scouted!.isMate) scouted!.marker.visible = false;
          }, 8000);
        } else {
          this.log('[ZERO] Argus drill camera found no hostiles in range.');
        }
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        break;
      }
      case 'flores': {
        this.sound.breachExplode();
        this.spawnBreachExplosion(targetPos, fwd);
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(targetPos) < 4.0).forEach(b => this.damageUnit(b, 60));
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 6.0;
        this.log('[FLORES] RCE-Ratero explosive drone detonated!');
        break;
      }
      case 'osa': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('clear_shield', 'atk', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        this.log('[OSA] Talon-8 Clear Shield mounted on floor!');
        break;
      }
      case 'sens': {
        // BUG FIX: no-op. R.O.U. is a physical blocking screen, so it reuses the same
        // solid, destructible, collidable gadget type Osa's Talon shield uses (see the
        // 'osa' case above and GadgetSystem.getMovementColliders()) rather than a fake
        // "screen" with no collider.
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('clear_shield', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        this.log('[SENS] R.O.U. Holographic light screen deployed!');
        break;
      }
      case 'grim': {
        // BUG FIX: no-op. Reuses the gas_grenade gadget type's already-working periodic
        // area-damage-over-time logic (see GadgetSystem.update()) for the Kawan swarm
        // instead of a sound effect with no world effect.
        this.sound.playGasHiss(5);
        gadgetSystem.deployGadget('gas_grenade', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        this.log('[GRIM] Kawan Hive deployed! Tracking swarm active!');
        break;
      }
      case 'brava': {
        // BUG FIX: no-op — printed "hijacked" without touching anything. This actually
        // reassigns the nearest enemy-owned electronic gadget to Brava's own side: its
        // trigger checks (findNearbyEnemy in GadgetSystem.update()) key off ownerSide, so
        // a hijacked device stops threatening Brava's team and starts threatening its old
        // owner's team instead — a real, mechanical hijack rather than a log line.
        this.sound.playShockZap();
        const enemySideBrava = this.player.side === 'atk' ? 'def' : 'atk';
        let hijackTarget: ActiveGadget | null = null;
        let hijackDist = Infinity;
        for (const g of gadgetSystem.gadgets) {
          if (g.ownerSide !== enemySideBrava || !g.isElectronic) continue;
          const d = g.pos.distanceTo(eyePos);
          if (d < 15 && d < hijackDist) { hijackDist = d; hijackTarget = g; }
        }
        if (hijackTarget) {
          hijackTarget.ownerSide = this.player.side;
          hijackTarget.ownerId = 'brava_hijack';
          this.log(`[BRAVA] Kludge drone hijacked enemy ${hijackTarget.name}!`);
        } else {
          this.log('[BRAVA] Kludge drone found no electronic device in range to hijack.');
        }
        this.player.abilityCooldown = 6.0;
        break;
      }
      case 'ram': {
        this.sound.playSledgeSmash();
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(targetPos) < 3.2);
        if (nearB) this.breachBarricade(nearB, false);
        this.player.abilityCooldown = 6.0;
        this.log('[RAM] BU-GI Auto-Breacher launched shredding obstacles!');
        break;
      }
      case 'deimos': {
        // BUG FIX: only logged a name, never marked anyone. Same reveal primitive as
        // Zero/Jackal above — DeathMARK exposes the nearest enemy's real position.
        this.sound.playHeartbeat();
        const enemySideDeimos = this.player.side === 'atk' ? 'def' : 'atk';
        let marked: BotUnit | null = null;
        let markedD = Infinity;
        for (const b of this.bots) {
          if (!b.alive || b.side !== enemySideDeimos) continue;
          const d = b.mesh.position.distanceTo(eyePos);
          if (d < markedD) { markedD = d; marked = b; }
        }
        if (marked) {
          this.droneSpottedEnemies.add(marked.id);
          marked.marker.visible = true;
          this.log(`[DEIMOS] DeathMARK locked onto ${marked.op.name} in 1v1 duel!`);
          this.scheduleTimeout(() => {
            this.droneSpottedEnemies.delete(marked!.id);
            if (marked!.alive && !marked!.isMate) marked!.marker.visible = false;
          }, 12000);
        } else {
          this.log('[DEIMOS] DeathMARK found no target to lock onto.');
        }
        this.player.abilityCooldown = 12.0;
        break;
      }
      case 'striker': {
        this.sound.breachExplode();
        this.spawnBreachExplosion(targetPos, fwd);
        this.player.abilityCooldown = 5.0;
        this.log('[STRIKER] Adaptable breach kit deployed!');
        break;
      }
      case 'rauora': {
        // BUG FIX: no-op. The D.O.M. panel is a physical piece of cover, so it reuses the
        // same solid/destructible/collidable barrier type Azami's Kiba barrier uses.
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('kiba_barrier', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        this.log('[RAUORA] D.O.M. tactical panel deployed!');
        break;
      }
      case 'solid_snake': {
        this.sound.playEmpDischarge();
        this.player.cloaked = true;
        this.scheduleTimeout(() => { this.player.cloaked = false; }, 10000);
        this.player.abilityCooldown = 15.0;
        this.log('[SOLID SNAKE] OctoCamo cloaking active & Chaff grenade deployed!');
        break;
      }
      case 'denari': {
        // BUG FIX: no-op. Real AoE repulsor effect: stuns and damages nearby enemies,
        // reusing the same bot.stunned + damageUnit/damagePlayer pattern Blitz/Ying/Echo
        // already use for their concussion effects above.
        this.sound.playEmpDischarge();
        let denariHit = 0;
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(eyePos) < 7.0).forEach(b => {
          b.stunned = Math.max(b.stunned, 2.5);
          this.damageUnit(b, 20);
          denariHit++;
        });
        this.log(denariHit > 0 ? `[DENARI] Acoustic shock repulsor staggered ${denariHit} hostile(s)!` : '[DENARI] Acoustic shock repulsor discharged — no hostiles in range.');
        this.player.abilityCooldown = 6.0;
        break;
      }

      // --- DEFENDERS ---
      case 'smoke': {
        this.throwGrenade('smoke');
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        break;
      }
      case 'mute': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('signal_disruptor', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[MUTE] GC90 Signal Disruptor jammer placed on floor!');
        break;
      }
      case 'castle': {
        this.sound.playGadgetDeploy();
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(targetPos) < 2.5);
        if (nearB) {
          nearB.hp = 180;
          this.log('[CASTLE] UTP1-Duster bulletproof armor panel reinforced doorway!');
        } else {
          this.log('[CASTLE] UTP1-Duster armor panel ready.');
        }
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        break;
      }
      case 'pulse': {
        this.sound.playHeartbeat();
        this.player.isCardiacSensor = !this.player.isCardiacSensor;
        this.player.abilityCooldown = 1.0;
        this.log(this.player.isCardiacSensor ? '[PULSE] HB-5 Cardiac Sensor scanning heartbeats through walls!' : '[PULSE] Cardiac Sensor holstered.');
        break;
      }
      case 'doc': {
        this.sound.playReloadSound();
        this.player.hp = Math.min(140, this.player.hp + 40);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 3.0;
        this.log(`[DOC] Stim dart injected! HP boosted to ${this.player.hp}!`);
        break;
      }
      case 'rook': {
        this.sound.playGadgetDeploy();
        this.player.shielded = true;
        this.bots.filter(b => b.alive && b.side === 'def').forEach(b => b.hp += 20);
        this.player.gadgetCharges = 0;
        this.player.abilityCooldown = 10.0;
        this.log('[ROOK] Ceramic Armor Pack deployed! Whole team equipped with armor plates!');
        break;
      }
      case 'jager': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('ads_defense', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[JÄGER] Magpie ADS defense system mounted!');
        break;
      }
      case 'bandit': {
        this.sound.playShockZap();
        gadgetSystem.deployGadget('shock_wire', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[BANDIT] CED-1 shock battery connected!');
        break;
      }
      case 'tachanka': {
        this.sound.playGasHiss(6);
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(targetPos) < 4.0).forEach(b => this.damageUnit(b, 35));
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 3.0;
        this.log('[TACHANKA] Shumikha incendiary fire covering corridor!');
        break;
      }
      case 'kapkan': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('entry_denial', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 3.0;
        this.log('[KAPKAN] EDD MK.II laser tripmine mounted on doorframe!');
        break;
      }
      case 'frost': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('welcome_mat', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 3.0;
        this.log('[FROST] Sterling Welcome Mat bear trap placed flat!');
        break;
      }
      case 'valkyrie': {
        // Placing the Black Eye cam moved to [TAB] (equip) + click (place) — see
        // toggleHeldGadget()/executeThrow() — instead of an instant, un-aimed throw here,
        // so [F] no longer double-throws the same gadget the Tab-equip flow already covers.
        this.log('[VALKYRIE] Press [TAB] to equip the Black Eye camera, then hold click to aim and release to throw it.');
        break;
      }
      case 'caveira': {
        this.player.isSilencedFootsteps = true;
        this.scheduleTimeout(() => { this.player.isSilencedFootsteps = false; }, 10000);
        this.player.abilityCooldown = 12.0;
        this.log('[CAVEIRA] Silent Step active — Stalking mode engaged!');
        break;
      }
      case 'echo': {
        this.sound.playEmpDischarge();
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(targetPos) < 6.0).forEach(b => {
          b.stunned = 4.0;
        });
        this.player.abilityCooldown = 6.0;
        this.log('[ECHO] Yokai acoustic hover drone ultrasonic burst fired!');
        break;
      }
      case 'mira': {
        // Same [TAB]-equip + click-to-place flow as Valkyrie above (see getThrowableTypeForOperator()) —
        // reuses the existing camera architecture instead of a separate one, and no longer
        // instant-throws on [F].
        this.log('[MIRA] Press [TAB] to equip the Black Mirror, then hold click to aim and release to throw it — view and control it from CCTV mode [6].');
        break;
      }
      case 'lesion': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('entry_denial', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[LESION] GU toxic needle mine deployed!');
        break;
      }
      case 'ela': {
        // BUG FIX: no-op. A concussion mine is functionally a tripwire — reuses the
        // already-working entry_denial trigger (same primitive Kapkan/Lesion/Fenrir use).
        this.sound.playFlashbang();
        gadgetSystem.deployGadget('entry_denial', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[ELA] Grzmot concussion mine mounted!');
        break;
      }
      case 'vigil': {
        this.sound.playPhoneBuzz();
        this.player.cloaked = true;
        this.scheduleTimeout(() => { this.player.cloaked = false; }, 12000);
        this.player.abilityCooldown = 15.0;
        this.log('[VIGIL] ERC-7 electronic cloak active — Drones jammed!');
        break;
      }
      case 'maestro': {
        // Same [TAB]-equip + click-to-place flow as Valkyrie/Mira above — the actual working
        // turret is the maestro_cam path: it sticks to a surface, joins this.securityCameras
        // with isMaestro:true, the player views and aims it through CCTV mode ([6],
        // toggleCctvMode/nextCctvCamera), and left-click calls fireMaestroLaser().
        this.log('[MAESTRO] Press [TAB] to equip the Evil Eye turret, then hold click to aim and release to throw it — view and fire it from CCTV mode [6].');
        break;
      }
      case 'alibi': {
        // BUG FIX: this consumed a charge and started the cooldown but never actually
        // deployed anything into the world — the "decoy" didn't exist.
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('prisma_decoy', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[ALIBI] Prisma holographic decoy deployed!');
        break;
      }
      case 'clash': {
        this.player.shielded = !this.player.shielded;
        this.sound.playShockZap();
        this.player.abilityCooldown = 2.0;
        this.log(this.player.shielded ? '[CLASH] CCE Electro-Riot Shield active — Taser armed!' : '[CLASH] CCE Shield holstered.');
        break;
      }
      case 'kaid': {
        this.sound.playShockZap();
        gadgetSystem.deployGadget('shock_wire', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[KAID] Rtila Electroclaw deployed!');
        break;
      }
      case 'mozzie': {
        // BUG FIX: no-op. Same real hijack mechanic as Brava above — reassigns the
        // nearest enemy electronic gadget's ownerSide so it stops threatening Mozzie's
        // team.
        this.sound.playShockZap();
        const enemySideMozzie = this.player.side === 'atk' ? 'def' : 'atk';
        let mozzieTarget: ActiveGadget | null = null;
        let mozzieDist = Infinity;
        for (const g of gadgetSystem.gadgets) {
          if (g.ownerSide !== enemySideMozzie || !g.isElectronic) continue;
          const d = g.pos.distanceTo(eyePos);
          if (d < 15 && d < mozzieDist) { mozzieDist = d; mozzieTarget = g; }
        }
        if (mozzieTarget) {
          mozzieTarget.ownerSide = this.player.side;
          mozzieTarget.ownerId = 'mozzie_hijack';
          this.log(`[MOZZIE] Pest hijacked enemy ${mozzieTarget.name}!`);
        } else {
          this.log('[MOZZIE] Pest found no electronic device in range to hijack.');
        }
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        break;
      }
      case 'warden': {
        this.player.isThermalVision = !this.player.isThermalVision;
        this.sound.playGadgetDeploy();
        this.player.abilityCooldown = 2.0;
        this.log(this.player.isThermalVision ? '[WARDEN] Glance Smart Glasses active — Immune to flash & smoke!' : '[WARDEN] Smart Glasses disengaged.');
        break;
      }
      case 'goyo': {
        // BUG FIX: no-op. Reuses gas_grenade's already-working periodic area-damage
        // field for the Volcán incendiary effect.
        this.sound.playGasHiss(6);
        gadgetSystem.deployGadget('gas_grenade', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[GOYO] Volcán incendiary canister mounted!');
        break;
      }
      case 'wamai': {
        this.sound.playEmpDischarge();
        gadgetSystem.deployGadget('ads_defense', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[WAMAI] Mag-NET defense disc deployed!');
        break;
      }
      case 'oryx': {
        this.sound.playSledgeSmash();
        this.player.vel.add(fwd.multiplyScalar(12));
        this.screenShakeIntensity = 0.7;
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(eyePos) < 2.5);
        if (nearB) this.breachBarricade(nearB, false);
        this.player.abilityCooldown = 5.0;
        this.log('[ORYX] Remah Dash kinetic burst forward!');
        break;
      }
      case 'melusi': {
        this.sound.playEmpDischarge();
        gadgetSystem.deployGadget('banshee_slow', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        this.log('[MELUSI] Banshee sonic defense pylon deployed!');
        break;
      }
      case 'aruni': {
        // BUG FIX: no-op. A laser gate that damages anyone crossing it is functionally
        // Kapkan's tripwire mine — reuses that already-working trigger+damage logic
        // (entry_denial) instead of a sound effect with no world object.
        this.sound.playShockZap();
        gadgetSystem.deployGadget('entry_denial', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        this.log('[ARUNI] Surya laser gate mounted over doorway!');
        break;
      }
      case 'thunderbird': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('kona_station', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 5.0;
        this.log('[THUNDERBIRD] Kona automated medical station deployed!');
        break;
      }
      case 'thorn': {
        // BUG FIX: no-op — consumed a charge and played a sound with no world effect.
        // GadgetSystem already has a fully-implemented 'razorbloom' type (real
        // trigger-on-proximity + 65 dmg + destroy, see GadgetSystem.update()); this case
        // just never called it.
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('razorbloom', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[THORN] Razorbloom shrapnel shell deployed!');
        break;
      }
      case 'azami': {
        this.sound.playGadgetDeploy();
        gadgetSystem.deployGadget('kiba_barrier', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[AZAMI] Kiba barrier expanded into bulletproof cover!');
        break;
      }
      case 'solis': {
        this.sound.playPhoneBuzz();
        this.player.isElectronicsDetector = !this.player.isElectronicsDetector;
        this.player.abilityCooldown = 1.0;
        this.log(this.player.isElectronicsDetector ? '[SOLIS] SPEC-IO electro-scanner active — scanning devices!' : '[SOLIS] Scanner off.');
        break;
      }
      case 'fenrir': {
        this.sound.playGasHiss(4);
        gadgetSystem.deployGadget('entry_denial', 'def', 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[FENRIR] F-NATT Dread Mine deployed!');
        break;
      }
      case 'tubarao': {
        // BUG FIX: no-op. A cryogenic freeze field is functionally a slow zone — reuses
        // the now-correctly-resetting banshee_slow field (see GadgetSystem.update(),
        // fixed this session) instead of a sound effect with no world object.
        this.sound.playGasHiss(4);
        gadgetSystem.deployGadget('banshee_slow', this.player.side, 'player', targetPos);
        this.player.gadgetCharges = (this.player.gadgetCharges || 1) - 1;
        this.player.abilityCooldown = 4.0;
        this.log('[TUBARÃO] Zoto cryogenic freeze canister detonated!');
        break;
      }
      case 'skopos': {
        // BUG FIX: no-op. V10 Pantheon shell-swap becomes a real reserve-ammo refill for
        // the current weapon — a genuine, verifiable state change instead of a log line.
        this.sound.playGadgetDeploy();
        const skoposW = this.currentWeapon();
        this.player.ammoReserve[skoposW.id] = skoposW.reserve;
        this.player.abilityCooldown = 5.0;
        this.log('[SKOPÓS] V10 Pantheon shell transfer complete! Reserve ammo replenished.');
        break;
      }
      case 'sentry': {
        this.sound.playGadgetDeploy();
        this.player.breachChargesLeft += 1;
        this.player.abilityCooldown = 8.0;
        this.log('[SENTRY] Fortification support kit deployed!');
        break;
      }
      case 'noor': {
        // BUG FIX: no-op. The Horus lance is an anti-intel EMP pulse combined with a
        // stun — reuses the temporary electronics-disable state and the same
        // gadgets in range) plus the same stun pattern used by Blitz/Denari above.
        this.sound.playEmpDischarge();
        this.empPulse(targetPos, 9);
        let noorHit = 0;
        this.bots.filter(b => b.alive && b.side !== this.player.side && b.mesh.position.distanceTo(targetPos) < 6.0).forEach(b => {
          b.stunned = Math.max(b.stunned, 2.0);
          noorHit++;
        });
        this.log(noorHit > 0 ? `[NOOR] Horus acoustic lance disabled nearby electronics and staggered ${noorHit} hostile(s)!` : '[NOOR] Horus acoustic lance discharged!');
        this.player.abilityCooldown = 5.0;
        break;
      }
      default: {
        this.log(`${op.name} activated: ${op.ability.split(' — ')[0]}`);
        this.player.abilityCooldown = 10;
        break;
      }
    }

    this.onStateUpdate?.();
  }

  /** Bot equivalent of throwGrenade() — same physics/detonation pipeline, sourced from
   * the bot's own position/facing instead of the player's camera. Lets bot Valkyrie/
   * Maestro/Zero actually place a working camera instead of doing nothing. */
  public throwGrenadeFromBot(bot: BotUnit, type: 'frag' | 'flash' | 'smoke' | 'emp' | 'valkyrie_cam' | 'maestro_cam') {
    const fwd = new THREE.Vector3(Math.sin(bot.mesh.rotation.y), 0, Math.cos(bot.mesh.rotation.y)).normalize();
    const eyePos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));

    const geo = new THREE.SphereGeometry(0.12, 10, 10);
    let matColor = 0x333333;
    if (type === 'valkyrie_cam') matColor = 0x10b981;
    if (type === 'maestro_cam') matColor = 0xef4444;
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: matColor, metalness: 0.85, roughness: 0.2 }));
    mesh.position.copy(eyePos).add(fwd.clone().multiplyScalar(0.4));
    this.scene.add(mesh);

    const throwVel = fwd.clone().multiplyScalar(13).add(new THREE.Vector3(0, 4.5, 0));
    this.throwableGrenades.push({
      id: `grenade_${Date.now()}_${Math.random()}`,
      type,
      pos: mesh.position,
      vel: throwVel,
      mesh,
      life: (type === 'valkyrie_cam' || type === 'maestro_cam') ? 999 : 2.2,
      ownerSide: bot.side,
    });
  }

  public triggerBotGadget(bot: BotUnit) {
    if (!bot.alive) return;
    const op = bot.op;
    const botPos = bot.mesh.position.clone();
    const botFwd = new THREE.Vector3(Math.sin(bot.mesh.rotation.y), 0, Math.cos(bot.mesh.rotation.y));
    const targetPos = botPos.clone().add(botFwd.clone().multiplyScalar(1.5));

    switch (op.id) {
      case 'kapkan':
        gadgetSystem.deployGadget('entry_denial', 'def', bot.op.name, targetPos);
        this.log(`[DEF-${op.name}] Mounted EDD tripmine on doorframe.`);
        break;
      case 'frost':
        gadgetSystem.deployGadget('welcome_mat', 'def', bot.op.name, targetPos);
        this.log(`[DEF-${op.name}] Placed Sterling Welcome Mat.`);
        break;
      case 'mute':
        gadgetSystem.deployGadget('signal_disruptor', 'def', bot.op.name, targetPos);
        this.log(`[DEF-${op.name}] Deployed GC90 Signal Disruptor.`);
        break;
      case 'jager':
        gadgetSystem.deployGadget('ads_defense', 'def', bot.op.name, targetPos);
        this.log(`[DEF-${op.name}] Mounted Magpie ADS interceptor.`);
        break;
      case 'bandit':
        gadgetSystem.deployGadget('shock_wire', 'def', bot.op.name, targetPos);
        this.log(`[DEF-${op.name}] Deployed CED-1 shock battery.`);
        break;
      case 'smoke':
        gadgetSystem.deployGadget('gas_grenade', 'def', bot.op.name, targetPos);
        this.sound.playGasHiss(6);
        this.log(`[DEF-${op.name}] Threw toxic gas canister!`);
        break;
      case 'doc':
        bot.hp = Math.min(100, bot.hp + 40);
        this.log(`[DEF-${op.name}] Stimmed self! HP restored to ${bot.hp}.`);
        break;
      case 'rook':
        this.bots.filter(b => b.alive && b.side === 'def').forEach(b => b.hp += 15);
        this.log(`[DEF-${op.name}] Deployed armor plates for team!`);
        break;
      case 'azami':
        gadgetSystem.deployGadget('kiba_barrier', 'def', bot.op.name, targetPos);
        this.log(`[DEF-${op.name}] Expanded Kiba barrier cover.`);
        break;
      case 'sledge': {
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(botPos) < 2.5);
        if (nearB) {
          this.breachBarricade(nearB, false);
          this.log(`[ATK-${op.name}] Smashed barricade with hammer!`);
        }
        break;
      }
      case 'thatcher':
        this.empPulse(targetPos, 10);
        this.sound.playEmpDischarge();
        this.log(`[ATK-${op.name}] Threw EMP grenade!`);
        break;
      case 'thermite':
      case 'ace': {
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(targetPos) < 2.5);
        if (nearB) {
          this.breachBarricade(nearB, false);
          this.log(`[ATK-${op.name}] Hard breach charge detonated!`);
        }
        break;
      }
      case 'finka':
        this.bots.filter(b => b.alive && b.side === 'atk').forEach(b => b.hp = Math.min(120, b.hp + 20));
        this.log(`[ATK-${op.name}] Adrenal Surge buffed attacking squad!`);
        break;
      case 'dokkaebi':
        this.sound.playPhoneBuzz();
        this.log(`[ATK-${op.name}] Logic Bomb uploaded!`);
        break;
      case 'lion':
        this.sound.playEmpDischarge();
        this.log(`[ATK-${op.name}] EE-ONE-D scan activated!`);
        break;
      // Operators whose player implementation is a physical deployable share the same
      // GadgetSystem primitive. Keeping this table here avoids a second bot-only gadget system.
      case 'nomad': case 'gridlock': case 'iana': case 'osa': case 'sens':
      case 'grim': case 'alibi': case 'lesion': case 'ela': case 'kaid':
      case 'wamai': case 'melusi': case 'thorn': case 'thunderbird': case 'goyo':
      case 'tubarao': case 'fenrir': case 'aruni':
      case 'castle': case 'mira': case 'rauora': case 'mozzie': {
        const gadgetByOperator: Record<string, string> = {
          nomad: 'airjab_mine', gridlock: 'trax_stingers', iana: 'prisma_decoy',
          osa: 'clear_shield', sens: 'clear_shield', grim: 'gas_grenade',
          alibi: 'prisma_decoy', lesion: 'entry_denial', ela: 'entry_denial',
          kaid: 'shock_wire', wamai: 'ads_defense', melusi: 'banshee_slow',
          thorn: 'razorbloom', thunderbird: 'kona_station', goyo: 'gas_grenade',
          tubarao: 'banshee_slow', fenrir: 'entry_denial', aruni: 'entry_denial',
          // Armor/ballistic panel and vision-blocking wall props all share the same
          // solid-cover primitive Azami's Kiba barrier already uses.
          castle: 'kiba_barrier', mira: 'kiba_barrier', rauora: 'kiba_barrier',
          // Mozzie's hijack is approximated as Mute's jammer primitive — same practical
          // effect on the attacker's drone (loses control in the radius).
          mozzie: 'signal_disruptor'
        };
        const type = gadgetByOperator[op.id];
        if (type) {
          gadgetSystem.deployGadget(type, bot.side, bot.id, targetPos, botFwd, this);
          this.log(`[${bot.side.toUpperCase()}-${op.name}] deployed ${type.replaceAll('_', ' ')}.`);
        }
        break;
      }
      // These player abilities all apply their meaningful effect to nearby hostiles.
      // Bots choose their current sighting/forward approach, then use the same damage/stun APIs.
      case 'ash': case 'fuze': case 'capitao': case 'ying': case 'zofia':
      case 'flores': case 'tachanka': case 'echo': case 'denari': case 'noor': case 'twitch': {
        const range = op.id === 'ying' ? 9 : (op.id === 'noor' ? 6 : 4.5);
        const damage = op.id === 'flores' ? 60 : (op.id === 'tachanka' ? 35 : (op.id === 'twitch' ? 30 : 40));
        this.bots.filter(unit => unit.alive && unit.side !== bot.side && unit.mesh.position.distanceTo(targetPos) <= range)
          .forEach(unit => { this.damageUnit(unit, damage); if (['ying', 'zofia', 'echo', 'denari', 'noor'].includes(op.id) && unit.op.id !== 'warden') unit.stunned = Math.max(unit.stunned, 2); });
        this.log(`[${bot.side.toUpperCase()}-${op.name}] used ${op.gadgetName || op.ability.split(' — ')[0]} on contact.`);
        break;
      }
      case 'blitz': case 'clash': {
        this.bots.filter(unit => unit.alive && unit.side !== bot.side && unit.op.id !== 'warden' && unit.mesh.position.distanceTo(botPos) < 7)
          .forEach(unit => unit.stunned = Math.max(unit.stunned, 2.5));
        break;
      }
      case 'maverick': case 'buck': case 'hibana': case 'ram': case 'oryx': {
        const barrier = this.barricades.find(b => !b.isBreached && b.position.distanceTo(botPos) < 3);
        if (barrier) this.breachBarricade(barrier, false);
        break;
      }
      case 'skopos':
        this.log(`[DEF-${op.name}] completed shell transfer.`);
        break;
      // Recon cameras: bot equivalent of throwGrenade('valkyrie_cam'/'maestro_cam'),
      // sourced from the bot's own facing instead of the player's camera. These join
      // this.securityCameras through the same detonateGrenade path the player uses.
      case 'valkyrie':
        this.throwGrenadeFromBot(bot, 'valkyrie_cam');
        this.log(`[DEF-${op.name}] Threw a Black Eye camera.`);
        break;
      case 'maestro':
        this.throwGrenadeFromBot(bot, 'maestro_cam');
        this.log(`[DEF-${op.name}] Mounted an Evil Eye turret camera.`);
        break;
      case 'zero':
        this.throwGrenadeFromBot(bot, 'valkyrie_cam');
        this.log(`[ATK-${op.name}] Fired an Argus drill camera.`);
        break;
      // Temporary damage-reduction shield, mirroring this.player.shielded — Montagne's
      // full shield blocks more effectively than Blackbeard's rifle shield, so it lasts longer.
      case 'montagne':
        bot.shielded = true;
        this.scheduleTimeout(() => { bot.shielded = false; }, 15000);
        this.log(`[ATK-${op.name}] Le Roc shield extended!`);
        break;
      case 'blackbeard':
        bot.shielded = true;
        this.scheduleTimeout(() => { bot.shielded = false; }, 8000);
        this.log(`[ATK-${op.name}] Rifle shield mounted!`);
        break;
      // Full sensory cloak, mirroring this.player.cloaked — hides from enemy perception
      // (drones, cameras, and direct sightlines) for the duration.
      case 'vigil':
        bot.cloaked = true;
        this.scheduleTimeout(() => { bot.cloaked = false; }, 12000);
        this.log(`[DEF-${op.name}] ERC-7 electronic cloak active!`);
        break;
      case 'nokk':
        bot.cloaked = true;
        this.scheduleTimeout(() => { bot.cloaked = false; }, 10000);
        this.log(`[ATK-${op.name}] HEL presence reduction active!`);
        break;
      case 'solid_snake':
        bot.cloaked = true;
        this.scheduleTimeout(() => { bot.cloaked = false; }, 10000);
        this.log(`[${bot.side.toUpperCase()}-${op.name}] Went into hiding... !`);
        break;
      // Movement burst approximating a grapple/dash gadget.
      case 'amaru':
        bot.speedBoost = 1.8;
        this.scheduleTimeout(() => { bot.speedBoost = 1; }, 2000);
        this.log(`[ATK-${op.name}] Garra Hook grapple burst!`);
        break;
      case 'caveira':
        bot.speedBoost = 1.3;
        this.scheduleTimeout(() => { bot.speedBoost = 1; }, 6000);
        this.log(`[DEF-${op.name}] Silent Step active.`);
        break;
      // Destroys the nearest hostile gadget outright — Kali's lance detonates gadgets
      // through walls without needing a hard breach.
      case 'kali': {
        const idx = gadgetSystem.gadgets.findIndex(g => g.ownerSide !== bot.side && g.pos.distanceTo(targetPos) < 6);
        if (idx !== -1) {
          const hit = gadgetSystem.gadgets[idx];
          this.log(`[ATK-${op.name}] LV Explosive Lance destroyed ${hit.name}!`);
          gadgetSystem.removeGadgetAt(idx);
        }
        break;
      }
      // Brava's hack is approximated as a small-radius EMP centered on the nearest
      // hostile gadget, using the same temporary-disable path Thatcher's EMP uses.
      case 'brava': {
        const nearGadget = gadgetSystem.gadgets.find(g => g.ownerSide !== bot.side && g.pos.distanceTo(targetPos) < 6);
        if (nearGadget) {
          this.empPulse(nearGadget.pos, 3, 10);
          this.log(`[ATK-${op.name}] Kludge Drone hacked ${nearGadget.name}!`);
        }
        break;
      }
      // Direct breach-or-EMP flex kit.
      case 'striker': {
        const nearB = this.barricades.find(b => !b.isBreached && b.position.distanceTo(targetPos) < 3.0);
        if (nearB) {
          this.breachBarricade(nearB, false);
          this.log(`[ATK-${op.name}] Adaptable kit: hard breach!`);
        } else {
          this.empPulse(targetPos, 8);
          this.log(`[ATK-${op.name}] Adaptable kit: EMP impact!`);
        }
        break;
      }
      // Extra team fortification, mirroring Rook's armor plate buff.
      case 'sentry':
        this.bots.filter(b => b.alive && b.side === 'def').forEach(b => b.hp = Math.min(120, b.hp + 15));
        this.log(`[DEF-${op.name}] Deployed fortification support kit!`);
        break;
      // Wallhack-style detection operators: rather than a UI overlay (meaningless for a
      // bot), this feeds the nearest hostile's real position straight into the bot's own
      // memory/confidence, so it behaves exactly as if it had actually detected them —
      // it will push or reposition toward that location.
      case 'iq': case 'solis': case 'pulse': case 'jackal': case 'deimos': {
        let nearestUnit: BotUnit | null = null;
        let nearestDist = Infinity;
        for (const u of this.bots) {
          if (!u.alive || u.side === bot.side) continue;
          const d = bot.mesh.position.distanceTo(u.mesh.position);
          if (d < 20 && d < nearestDist) { nearestDist = d; nearestUnit = u; }
        }
        const playerDist = (this.player.alive && this.player.side !== bot.side) ? bot.mesh.position.distanceTo(this.player.pos) : Infinity;
        const detectedPos = playerDist < nearestDist && playerDist < 20
          ? this.player.pos.clone()
          : (nearestUnit ? nearestUnit.mesh.position.clone() : null);
        if (detectedPos) {
          bot.memory.lastKnownPos = detectedPos;
          bot.memory.lastKnownTime = performance.now() / 1000;
          bot.memory.confidence = Math.max(bot.memory.confidence, 0.6);
        }
        this.log(`[${bot.side.toUpperCase()}-${op.name}] scanned for enemy signatures.`);
        break;
      }
      // Passive-only counters with nothing meaningful to actively trigger here (Warden's
      // flash immunity and Glaz's smoke-vision perk are handled where flashbangs/smoke
      // actually apply their effect, not as an activated ability).
      case 'warden': case 'glaz':
        this.log(`[${bot.side.toUpperCase()}-${op.name}] tactical eyewear engaged.`);
        break;
      default:
        this.log(`[${bot.side.toUpperCase()}-${op.name}] Activated tactical equipment.`);
        break;
    }
  }

  // ---------------------------------------------------------------------
  // 8. LAN MULTIPLAYER
  // ---------------------------------------------------------------------
  public connectLAN(url: string) {
    try {
      this.lanSocket = new WebSocket(url);
      this.lanSocket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'welcome') { this.lanId = msg.id; }
          if (msg.type === 'state') {
            Object.keys(msg.players).forEach(id => {
              if (id === this.lanId) return;
              const p = msg.players[id];
              if (!this.remotePlayers[id]) {
                const char = ModelFactory.createHumanoidOperator('atk', 0x5aff8a, 'ar');
                this.scene.add(char.root);
                this.remotePlayers[id] = { mesh: char.root, targetPos: new THREE.Vector3(), targetYaw: 0 };
              }
              const rp = this.remotePlayers[id];
              rp.targetPos.set(p.x, p.y, p.z);
              rp.targetYaw = p.yaw;
            });
          }
        } catch {}
      };
    } catch {}
  }

  public updateRemote(dt: number) {
    networkClient.update(dt);
  }

  // ---------------------------------------------------------------------
  // 9. ANIMATION LOOP
  // ---------------------------------------------------------------------
  private fpsAccum = 0;
  private fpsFrames = 0;
  private fpsDisplay = 0;

  public animate = () => {
    if (!this.running) return;
    this.animId = requestAnimationFrame(this.animate);
    if (!this.started) return;

    try {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.05);
      this.fpsAccum += dt;
      this.fpsFrames++;
      if (this.fpsAccum >= 0.5) {
        this.fpsDisplay = Math.round(this.fpsFrames / this.fpsAccum);
        this.status.fps = this.fpsDisplay;
        this.fpsAccum = 0;
        this.fpsFrames++;
      }

      this.updatePhase(dt);
      this.updateMovement(dt);
      this.updateHeldGadgets();
      this.updateTrajectoryPreview();
      this.updateSpottedEnemies(dt);

      // Camera FOV & ADS Smooth Transition
      const currentWpn = this.currentWeapon();
      const targetFov = this.player.focusZoom ? (currentWpn.isSniper ? 20 : 46) : 78;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 14);
      this.camera.updateProjectionMatrix();

      if (this.viewmodelGroup) {
        this.viewmodelGroup.visible = !this.inDroneMode && (!this.player.focusZoom || !currentWpn.isSniper);
      }

      // Automatic continuous fire for fully-automatic weapons (AR, SMG)
      if (this.isFiring && !this.inDroneMode && this.player.alive && this.match.phase === 'action') {
        const w = this.currentWeapon();
        if (w.auto) {
          this.tryFire();
        }
      }

      // Twitch's Shock Drone: keep firing live rounds while the mouse button is held
      if (this.isFiring && this.inDroneMode && this.drone && this.drone.canFire()) {
        this.fireDroneGun();
      }

      this.updateBots(dt);
      this.updateRemote(dt);

      if (this.player.abilityCooldown > 0) {
        this.player.abilityCooldown = Math.max(0, this.player.abilityCooldown - dt);
      }
      gadgetSystem.update(dt, this);

      if (this.animatedLights && this.animatedLights.length >= 2) {
        const t = performance.now() * 0.008;
        this.animatedLights[0].intensity = Math.sin(t) > 0 ? 3.5 : 0.2;
        this.animatedLights[1].intensity = Math.sin(t) <= 0 ? 3.5 : 0.2;
      }

      for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
        this.bulletTracers[i].life -= dt;
        if (this.bulletTracers[i].life <= 0) {
          this.scene.remove(this.bulletTracers[i].line);
          this.bulletTracers.splice(i, 1);
        }
      }

      this.updateImpacts(dt);
      this.renderer.render(this.scene, this.camera);
    } catch (err: any) {
      this.status.lastError = err?.message || String(err);
      console.error('[BreachProtocolEngine error]', err);
    }
  };

  public destroy() {
    this.running = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.removeEvents();
    networkClient.disconnect();
    if (this.lanSocket) {
      try { this.lanSocket.close(); } catch {}
    }
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
