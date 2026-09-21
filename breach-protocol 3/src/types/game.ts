export type Team = 'attackers' | 'defenders';

export type MatchPhase = 
  | 'menu'
  | 'lobby'
  | 'operator_select'
  | 'loadout_select'
  | 'drone_prep'        // Recon drone phase for attackers / Prep phase for defenders
  | 'action_phase'     // Infiltration, breaching, room clearing, objective execution
  | 'round_end'
  | 'match_end';

export type OperatorRole = string;

export interface Specialist {
  id: string;
  name: string;
  realName?: string;
  nationality?: string;
  background?: string;
  callsign: string;
  team: Team;
  role: OperatorRole;
  speed: 1 | 2 | 3;
  armor: 1 | 2 | 3;
  biography: string;
  abilityName: string;
  abilityDesc: string;
  abilityCharges: number;
  abilityCooldown: number; // seconds
  icon: string;
  primaryWeapons: string[];
  secondaryWeapons: string[];
  tacticalGadgets: string[];
  color: string;
}

export type WeaponType = 'assault_rifle' | 'carbine' | 'smg' | 'shotgun' | 'dmr' | 'pistol' | 'heavy_pistol';

export interface WeaponData {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  rpm: number;
  magSize: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  recoilVertical: number;
  recoilHorizontal: number;
  spread: number;
  adsZoom: number; // FOV multiplier e.g. 0.75
  adsSpeed: number; // transition seconds
  penetrationPower: number; // 1 to 5 (penetrates drywall, wood, etc.)
  soundProfile: 'heavy' | 'suppressed' | 'shotgun' | 'pistol' | 'rifle' | 'smg';
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  isLocalPlayer: boolean;
  team: Team;
  specialistId: string;
  primaryWeaponId: string;
  secondaryWeaponId: string;
  health: number;
  maxHealth: number;
  armor: number;
  isAlive: boolean;
  isCrouched: boolean;
  leanAngle: number; // -1 (left), 0 (center), +1 (right)
  isAiming: boolean;
  isSprinting: boolean;
  isRappelling: boolean;
  isControllingDrone: boolean;
  isViewingCamera: boolean;
  kills: number;
  deaths: number;
  score: number;
  ping: number;
  pos: { x: number; y: number; z: number };
  rot: { yaw: number; pitch: number };
  currentAmmo: number;
  reserveAmmo: number;
  abilityCharges: number;
  abilityCooldownTimer: number;
  reinforcedWallsRemaining: number;
  barricadesRemaining: number;
  droneActive: boolean;
  lastKnownPing?: { x: number; y: number; z: number; timestamp: number };
}

export type WallMaterial = 
  | 'drywall' 
  | 'wood' 
  | 'reinforced_metal' 
  | 'glass' 
  | 'structural' 
  | 'barricade_wood';

export interface BreakableWallSegment {
  id: string;
  wallId: string;
  row: number;
  col: number;
  isDestroyed: boolean;
  isReinforced: boolean;
  health: number;
  material: WallMaterial;
  center: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
}

export interface DoorOrWindow {
  id: string;
  type: 'door' | 'window';
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  width: number;
  height: number;
  state: 'closed' | 'open' | 'barricaded' | 'damaged' | 'broken' | 'destroyed';
  health: number;
  isExterior: boolean;
  hasRappelAnchor: boolean;
}

export interface DeployableCamera {
  id: string;
  name: string;
  team: Team;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  health: number;
  isDestroyed: boolean;
  isStaticCCTV: boolean;
}

export interface DroneObject {
  id: string;
  ownerId: string;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  velocity: { x: number; y: number; z: number };
  health: number;
  battery: number;
  isDestroyed: boolean;
}

export interface ObjectiveZone {
  id: string;
  name: string; // e.g. "Site A - Server Room", "Site B - Archives"
  position: { x: number; y: number; z: number };
  radius: number;
  state: 'neutral' | 'contested' | 'arming' | 'armed' | 'defusing' | 'defused';
  progress: number; // 0 to 100%
  armedTimeRemaining: number;
}

export interface SoundEvent {
  type: 'footstep' | 'gunshot' | 'explosion' | 'barricade' | 'glass' | 'drone' | 'reload' | 'rappel' | 'defuser';
  position: { x: number; y: number; z: number };
  volume: number;
  teamOrigin?: Team;
  timestamp: number;
}

export interface KillFeedEntry {
  id: string;
  killerName: string;
  killerTeam: Team;
  victimName: string;
  victimTeam: Team;
  weaponName: string;
  isHeadshot: boolean;
  timestamp: number;
}
