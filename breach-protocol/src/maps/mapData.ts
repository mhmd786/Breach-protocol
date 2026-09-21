import { DoorOrWindow, DeployableCamera, ObjectiveZone } from '../types/game';

export interface WallDefinition {
  id: string;
  material: 'drywall' | 'wood' | 'reinforced_metal' | 'structural';
  isBreachable: boolean;
  canReinforce: boolean;
  start: [number, number, number]; // [x, y, z]
  end: [number, number, number];
  height: number;
  thickness: number;
  segmentsX?: number;
  segmentsY?: number;
}

export interface MapData {
  id: string;
  name: string;
  codename: string;
  theme: string;
  type?: string;
  description: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  attackerSpawns: Array<{ x: number; y: number; z: number; name: string }>;
  defenderSpawns: Array<{ x: number; y: number; z: number; name: string }>;
  objectives: ObjectiveZone[];
  walls: WallDefinition[];
  doorsAndWindows: DoorOrWindow[];
  cameras: DeployableCamera[];
  rappelAnchors: Array<{
    id: string;
    position: { x: number; y: number; z: number };
    wallNormal: { x: number; y: number; z: number };
    height: number;
  }>;
}

export const COPPER_YARD_MAP: MapData = {
  id: 'copper_yard',
  name: 'Copper Yard',
  codename: 'CY-INDUSTRIAL',
  theme: 'Industrial Logistics & Telecom Facility',
  description: 'A two-story secure communications depot surrounded by parking bays, loading docks, and exterior utility corridors.',
  bounds: { minX: -45, maxX: 45, minZ: -45, maxZ: 45 },
  attackerSpawns: [
    { x: -32, y: 0.2, z: -28, name: 'Main Gate & Parking' },
    { x: 32, y: 0.2, z: -28, name: 'Loading Dock Approach' },
    { x: -28, y: 0.2, z: 32, name: 'Rear Service Alley' },
    { x: 28, y: 0.2, z: 30, name: 'East Maintenance Yard' }
  ],
  defenderSpawns: [
    { x: -4, y: 0.2, z: -4, name: 'Ground Floor Server Core' },
    { x: 6, y: 0.2, z: 4, name: 'Workshop Storage' },
    { x: -6, y: 4.4, z: 2, name: 'Upper Control Room' },
    { x: 4, y: 4.4, z: -4, name: 'Executive Archive' }
  ],
  objectives: [
    {
      id: 'site_a',
      name: 'Site A - Server Core (1F)',
      position: { x: -6, y: 0.2, z: -6 },
      radius: 4.5,
      state: 'neutral',
      progress: 0,
      armedTimeRemaining: 45
    },
    {
      id: 'site_b',
      name: 'Site B - Control Deck (2F)',
      position: { x: 5, y: 4.4, z: 5 },
      radius: 4.5,
      state: 'neutral',
      progress: 0,
      armedTimeRemaining: 45
    }
  ],
  // Strategic architectural walls
  walls: [
    // EXTERIOR STRUCTURAL WALLS (Building footprint: [-18, -18] to [18, 18])
    // Ground Floor Exterior
    { id: 'ext_south_1', material: 'structural', isBreachable: false, canReinforce: false, start: [-18, 0, -18], end: [-4, 0, -18], height: 4.2, thickness: 0.5 },
    { id: 'ext_south_2', material: 'structural', isBreachable: false, canReinforce: false, start: [4, 0, -18], end: [18, 0, -18], height: 4.2, thickness: 0.5 },
    { id: 'ext_north_1', material: 'structural', isBreachable: false, canReinforce: false, start: [-18, 0, 18], end: [18, 0, 18], height: 4.2, thickness: 0.5 },
    { id: 'ext_west_1', material: 'structural', isBreachable: false, canReinforce: false, start: [-18, 0, -18], end: [-18, 0, 18], height: 4.2, thickness: 0.5 },
    { id: 'ext_east_1', material: 'structural', isBreachable: false, canReinforce: false, start: [18, 0, -18], end: [18, 0, 18], height: 4.2, thickness: 0.5 },

    // 2nd Floor Exterior Walls (Y: 4.2 to 8.4)
    { id: 'ext_2f_south', material: 'structural', isBreachable: false, canReinforce: false, start: [-18, 4.2, -18], end: [18, 4.2, -18], height: 4.2, thickness: 0.5 },
    { id: 'ext_2f_north', material: 'structural', isBreachable: false, canReinforce: false, start: [-18, 4.2, 18], end: [18, 4.2, 18], height: 4.2, thickness: 0.5 },
    { id: 'ext_2f_west', material: 'structural', isBreachable: false, canReinforce: false, start: [-18, 4.2, -18], end: [-18, 4.2, 18], height: 4.2, thickness: 0.5 },
    { id: 'ext_2f_east', material: 'structural', isBreachable: false, canReinforce: false, start: [18, 4.2, -18], end: [18, 4.2, 18], height: 4.2, thickness: 0.5 },

    // GROUND FLOOR INTERIOR SOFT/REINFORCEABLE WALLS
    // Server Room Wall (Site A) - Soft Drywall that can be reinforced!
    { id: 'int_server_divider_1', material: 'drywall', isBreachable: true, canReinforce: true, start: [-18, 0, -2], end: [-2, 0, -2], height: 4.2, thickness: 0.25, segmentsX: 4, segmentsY: 2 },
    { id: 'int_server_divider_2', material: 'drywall', isBreachable: true, canReinforce: true, start: [-2, 0, -18], end: [-2, 0, -6], height: 4.2, thickness: 0.25, segmentsX: 3, segmentsY: 2 },
    // Workshop / Storage divider
    { id: 'int_workshop_1', material: 'wood', isBreachable: true, canReinforce: true, start: [0, 0, 0], end: [18, 0, 0], height: 4.2, thickness: 0.25, segmentsX: 4, segmentsY: 2 },
    { id: 'int_lobby_hallway', material: 'drywall', isBreachable: true, canReinforce: true, start: [-2, 0, 0], end: [-2, 0, 18], height: 4.2, thickness: 0.25, segmentsX: 4, segmentsY: 2 },

    // UPPER FLOOR (2F) INTERIOR BREACHABLE WALLS
    // Control Room (Site B) walls
    { id: 'int_control_1', material: 'drywall', isBreachable: true, canReinforce: true, start: [-2, 4.2, -2], end: [18, 4.2, -2], height: 4.2, thickness: 0.25, segmentsX: 4, segmentsY: 2 },
    { id: 'int_control_2', material: 'drywall', isBreachable: true, canReinforce: true, start: [0, 4.2, -2], end: [0, 4.2, 18], height: 4.2, thickness: 0.25, segmentsX: 4, segmentsY: 2 },
    { id: 'int_archive_soft', material: 'wood', isBreachable: true, canReinforce: true, start: [-18, 4.2, 4], end: [0, 4.2, 4], height: 4.2, thickness: 0.25, segmentsX: 4, segmentsY: 2 },
  ],
  doorsAndWindows: [
    // Ground floor doors
    { id: 'door_main_front', type: 'door', name: 'Front Entrance Doorway', position: { x: 0, y: 0, z: -18 }, rotation: 0, width: 2.8, height: 3.2, state: 'barricaded', health: 100, isExterior: true, hasRappelAnchor: false },
    { id: 'door_server_east', type: 'door', name: 'Server Core Access Door', position: { x: -2, y: 0, z: -4 }, rotation: Math.PI / 2, width: 2.2, height: 3.0, state: 'barricaded', health: 100, isExterior: false, hasRappelAnchor: false },
    { id: 'door_storage_west', type: 'door', name: 'Storage Hall Door', position: { x: 6, y: 0, z: 0 }, rotation: 0, width: 2.2, height: 3.0, state: 'barricaded', health: 100, isExterior: false, hasRappelAnchor: false },
    { id: 'door_rear_loading', type: 'door', name: 'Rear Service Loading Door', position: { x: 12, y: 0, z: 18 }, rotation: 0, width: 3.0, height: 3.2, state: 'barricaded', health: 100, isExterior: true, hasRappelAnchor: false },

    // Windows with Exterior Rappel Anchors
    { id: 'win_1f_server_south', type: 'window', name: 'Server Room 1F Window', position: { x: -10, y: 1.2, z: -18 }, rotation: 0, width: 2.2, height: 2.0, state: 'barricaded', health: 60, isExterior: true, hasRappelAnchor: true },
    { id: 'win_1f_east_yard', type: 'window', name: 'East Yard Workshop Window', position: { x: 18, y: 1.2, z: -8 }, rotation: Math.PI / 2, width: 2.2, height: 2.0, state: 'barricaded', health: 60, isExterior: true, hasRappelAnchor: true },
    { id: 'win_2f_control_south', type: 'window', name: 'Control Room 2F Window South', position: { x: 8, y: 5.4, z: -18 }, rotation: 0, width: 2.4, height: 2.2, state: 'barricaded', health: 60, isExterior: true, hasRappelAnchor: true },
    { id: 'win_2f_control_east', type: 'window', name: 'Control Room 2F Window East', position: { x: 18, y: 5.4, z: 6 }, rotation: Math.PI / 2, width: 2.4, height: 2.2, state: 'barricaded', health: 60, isExterior: true, hasRappelAnchor: true },
    { id: 'win_2f_archive_west', type: 'window', name: 'Archive 2F Window West', position: { x: -18, y: 5.4, z: 8 }, rotation: -Math.PI / 2, width: 2.4, height: 2.2, state: 'barricaded', health: 60, isExterior: true, hasRappelAnchor: true },
    { id: 'win_2f_north_alley', type: 'window', name: 'North Alley 2F Catwalk Window', position: { x: -4, y: 5.4, z: 18 }, rotation: Math.PI, width: 2.4, height: 2.2, state: 'barricaded', health: 60, isExterior: true, hasRappelAnchor: true }
  ],
  cameras: [
    { id: 'cam_ext_parking', name: 'CAM-01: Front Parking & Gate', team: 'defenders', position: { x: -17.5, y: 8.2, z: -17.5 }, rotation: { yaw: 0.78, pitch: -0.45 }, health: 50, isDestroyed: false, isStaticCCTV: true },
    { id: 'cam_ext_loading', name: 'CAM-02: East Loading Dock', team: 'defenders', position: { x: 17.5, y: 8.2, z: 17.5 }, rotation: { yaw: 3.92, pitch: -0.45 }, health: 50, isDestroyed: false, isStaticCCTV: true },
    { id: 'cam_int_1f_lobby', name: 'CAM-03: Ground Floor Main Lobby', team: 'defenders', position: { x: 1.0, y: 3.9, z: -17.0 }, rotation: { yaw: 3.14, pitch: -0.35 }, health: 50, isDestroyed: false, isStaticCCTV: true },
    { id: 'cam_int_1f_server', name: 'CAM-04: 1F Server Room Core', team: 'defenders', position: { x: -17.0, y: 3.9, z: -17.0 }, rotation: { yaw: 0.78, pitch: -0.35 }, health: 50, isDestroyed: false, isStaticCCTV: true },
    { id: 'cam_int_2f_control', name: 'CAM-05: 2F Control Room Site B', team: 'defenders', position: { x: 17.0, y: 8.1, z: 17.0 }, rotation: { yaw: 3.92, pitch: -0.35 }, health: 50, isDestroyed: false, isStaticCCTV: true }
  ],
  rappelAnchors: [
    { id: 'rap_south_west', position: { x: -10, y: 8.4, z: -18.2 }, wallNormal: { x: 0, y: 0, z: -1 }, height: 8.4 },
    { id: 'rap_south_east', position: { x: 8, y: 8.4, z: -18.2 }, wallNormal: { x: 0, y: 0, z: -1 }, height: 8.4 },
    { id: 'rap_east_1', position: { x: 18.2, y: 8.4, z: 6 }, wallNormal: { x: 1, y: 0, z: 0 }, height: 8.4 },
    { id: 'rap_west_1', position: { x: -18.2, y: 8.4, z: 8 }, wallNormal: { x: -1, y: 0, z: 0 }, height: 8.4 },
    { id: 'rap_north_1', position: { x: -4, y: 8.4, z: 18.2 }, wallNormal: { x: 0, y: 0, z: 1 }, height: 8.4 }
  ]
};

export const ALL_MAPS: MapData[] = [
  COPPER_YARD_MAP,
  {
    id: 'harbor_relay',
    name: 'Harbor Relay',
    codename: 'HR-SEAPORT',
    theme: 'Coastal Maritime Communications Center',
    description: 'A fortified port security station with crane yards, shipping container alleys, and a multi-level operations bridge.',
    bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
    attackerSpawns: COPPER_YARD_MAP.attackerSpawns,
    defenderSpawns: COPPER_YARD_MAP.defenderSpawns,
    objectives: COPPER_YARD_MAP.objectives,
    walls: COPPER_YARD_MAP.walls,
    doorsAndWindows: COPPER_YARD_MAP.doorsAndWindows,
    cameras: COPPER_YARD_MAP.cameras,
    rappelAnchors: COPPER_YARD_MAP.rappelAnchors
  },
  {
    id: 'old_metro',
    name: 'Old Metro',
    codename: 'OM-SUBTERRA',
    theme: 'Subterranean Transit Complex & Service Grid',
    description: 'An abandoned central transit station with maintenance tunnels, subway platforms, and escalators.',
    bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
    attackerSpawns: COPPER_YARD_MAP.attackerSpawns,
    defenderSpawns: COPPER_YARD_MAP.defenderSpawns,
    objectives: COPPER_YARD_MAP.objectives,
    walls: COPPER_YARD_MAP.walls,
    doorsAndWindows: COPPER_YARD_MAP.doorsAndWindows,
    cameras: COPPER_YARD_MAP.cameras,
    rappelAnchors: COPPER_YARD_MAP.rappelAnchors
  }
];
