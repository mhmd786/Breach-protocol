import * as THREE from 'three';

export interface NavNode {
  id: string;
  pos: THREE.Vector3;
  floor: number; // 0 for ground/1F, 1 for 2F, 0.5 for stairs
  neighbors: string[]; // Connected node IDs
  isCover?: boolean;
  roomName?: string;
  role?: 'attackerApproach' | 'defenderAnchor' | 'roamer' | 'breachApproach';
}

export class NavGraph {
  public nodes: Map<string, NavNode> = new Map();

  constructor() {
    this.buildHouseNavGraph();
  }

  /**
   * Rebuild a compact, map-owned tactical graph whenever a map is loaded. Nodes are derived
   * from that map's own spawns, objective, and real breach points (doors/windows), so no
   * coordinate from one map can leak into another, and bots actually route through the
   * map's real chokepoints instead of a handful of arbitrary offsets from the objective.
   */
  public configureMap(
    mapKey: string,
    attackers: [number, number][],
    defenders: [number, number][],
    objective: THREE.Vector3,
    breachPoints: Array<{ id: string; position: THREE.Vector3; isWindow: boolean }> = []
  ) {
    this.nodes.clear();
    const add = (id: string, pos: THREE.Vector3, roomName: string, role?: NavNode['role'], isCover = false) =>
      this.nodes.set(id, { id, pos, floor: pos.y > 1.8 ? 1 : 0, neighbors: [], roomName, role, isCover });
    const link = (a: string, b: string) => {
      const na = this.nodes.get(a); const nb = this.nodes.get(b);
      if (na && nb) {
        if (!na.neighbors.includes(b)) na.neighbors.push(b);
        if (!nb.neighbors.includes(a)) nb.neighbors.push(a);
      }
    };
    const dist = (a: string, b: string) => this.nodes.get(a)!.pos.distanceTo(this.nodes.get(b)!.pos);

    add(`${mapKey}:objective`, objective.clone(), 'Objective room', 'defenderAnchor', true);

    const atkIds = attackers.map(([x, z], i) => {
      const id = `${mapKey}:atk_spawn_${i}`;
      add(id, new THREE.Vector3(x, objective.y, z), `Attacker Spawn ${i + 1}`, 'attackerApproach');
      return id;
    });
    const defIds = defenders.map(([x, z], i) => {
      const id = `${mapKey}:def_spawn_${i}`;
      add(id, new THREE.Vector3(x, objective.y, z), `Defender Spawn ${i + 1}`, 'defenderAnchor', true);
      return id;
    });
    // Real breach points (doors/windows) are the map's own chokepoints, not a generic offset.
    const breachIds = breachPoints.map((b, i) => {
      const id = `${mapKey}:breach_${i}`;
      add(id, b.position.clone(), b.isWindow ? 'Window Breach' : 'Door Breach', 'breachApproach', true);
      return id;
    });

    if (breachIds.length > 0) {
      // Each attacker spawn routes toward its two closest breach points.
      atkIds.forEach(aid => {
        [...breachIds].sort((x, y) => dist(aid, x) - dist(aid, y)).slice(0, 2).forEach(bid => link(aid, bid));
      });
      // Breach points connect to the objective and to their nearest neighboring breach point,
      // so bots can rotate between entries instead of only ever using one.
      breachIds.forEach(bid => {
        link(bid, `${mapKey}:objective`);
        const nearest = [...breachIds].filter(x => x !== bid).sort((x, y) => dist(bid, x) - dist(bid, y))[0];
        if (nearest) link(bid, nearest);
      });
      // Defenders anchor near the objective and can rotate out to whichever breach point is closest to them.
      defIds.forEach(did => {
        link(did, `${mapKey}:objective`);
        const nearest = [...breachIds].sort((x, y) => dist(did, x) - dist(did, y))[0];
        if (nearest) link(did, nearest);
      });
    } else {
      // Fallback for a map with no breach data supplied: connect spawns straight to the objective.
      atkIds.forEach(aid => link(aid, `${mapKey}:objective`));
      defIds.forEach(did => link(did, `${mapKey}:objective`));
    }

    // A few rotation nodes around the objective itself so defenders don't all stack on one tile.
    add(`${mapKey}:roamer_west`, objective.clone().add(new THREE.Vector3(-4, 0, 0)), 'West rotation', 'roamer', true);
    add(`${mapKey}:roamer_east`, objective.clone().add(new THREE.Vector3(4, 0, 0)), 'East rotation', 'roamer', true);
    add(`${mapKey}:roamer_rear`, objective.clone().add(new THREE.Vector3(0, 0, 4)), 'Rear rotation', 'roamer');
    link(`${mapKey}:objective`, `${mapKey}:roamer_west`);
    link(`${mapKey}:objective`, `${mapKey}:roamer_east`);
    link(`${mapKey}:objective`, `${mapKey}:roamer_rear`);
  }

  /** Restores the hand-authored, room-level suburban house graph (see buildHouseNavGraph below). */
  public rebuildDefaultHouseGraph() {
    this.buildHouseNavGraph();
  }

  public getNodesByRole(role: NonNullable<NavNode['role']>): NavNode[] {
    return [...this.nodes.values()].filter(node => node.role === role);
  }

  /**
   * Defines realistic tactical waypoints throughout the enlarged House map,
   * spanning exterior approaches, entrances, drone vents, 1F rooms, stairs, and 2F rooms.
   */
  private buildHouseNavGraph() {
    const addNode = (id: string, x: number, y: number, z: number, floor: number, roomName: string, isCover = false) => {
      this.nodes.set(id, {
        id,
        pos: new THREE.Vector3(x, y, z),
        floor,
        neighbors: [],
        isCover,
        roomName
      });
    };

    const link = (id1: string, id2: string) => {
      const n1 = this.nodes.get(id1);
      const n2 = this.nodes.get(id2);
      if (n1 && n2) {
        if (!n1.neighbors.includes(id2)) n1.neighbors.push(id2);
        if (!n2.neighbors.includes(id1)) n2.neighbors.push(id1);
      }
    };

    // --- EXTERIOR APPROACHES (Ground floor, y ≈ 0) ---
    addNode('ext_spawn_street_center', 0, 0, -26, 0, 'Street Spawn');
    addNode('ext_spawn_street_west', -8, 0, -25, 0, 'Street West');
    addNode('ext_spawn_street_east', 8, 0, -25, 0, 'Street East');

    addNode('ext_swat_cover_west', -5.5, 0, -19, 0, 'SWAT Cruiser Cover', true);
    addNode('ext_swat_cover_east', 5.5, 0, -19, 0, 'Police Cover', true);

    addNode('ext_walkway_mid', 0, 0.15, -16, 0, 'Front Walkway');
    addNode('ext_porch_steps', 0, 0.18, -12, 0, 'Porch Steps');
    addNode('ext_porch_center', 0, 0.18, -10.2, 0, 'Front Porch');

    addNode('ext_alley_west_north', -15, 0, -14, 0, 'West Yard North');
    addNode('ext_alley_west_mid', -15, 0, 0, 0, 'West Alley');
    addNode('ext_alley_west_south', -15, 0, 14, 0, 'West Yard South');

    addNode('ext_alley_east_north', 15, 0, -14, 0, 'East Yard North');
    addNode('ext_alley_east_mid', 15, 0, 0, 0, 'East Alley');
    addNode('ext_alley_east_south', 15, 0, 14, 0, 'East Yard South');

    addNode('ext_patio_rear', 0, 0, 14, 0, 'Rear Patio');
    addNode('ext_patio_door_outside', 0, 0.05, 11.2, 0, 'Rear Door Approach');

    // --- 1F INTERIOR (y ≈ 0.02) ---
    // Front Entrance & Foyer
    addNode('1f_front_door', 0, 0.02, -8.8, 0, 'Front Entrance');
    addNode('1f_foyer_center', 0, 0.02, -6.5, 0, 'Main Foyer');
    addNode('1f_foyer_hall_west', -3.5, 0.02, -6.5, 0, 'Foyer Hallway West');
    addNode('1f_foyer_hall_east', 3.5, 0.02, -6.5, 0, 'Foyer Hallway East');

    // Living Room (West side 1F: x: -13 to -1, z: -8 to 2)
    addNode('1f_living_center', -7.5, 0.02, -3.5, 0, 'Living Room');
    addNode('1f_living_tv_cover', -10.5, 0.02, -5.5, 0, 'Living Room TV', true);
    addNode('1f_living_couch_cover', -5.0, 0.02, -2.0, 0, 'Living Room Couch', true);
    addNode('1f_living_window_north', -7.5, 0.02, -8.5, 0, 'Living North Window');

    // Dining & Kitchen (South-West 1F: x: -13 to -1, z: 2 to 10)
    addNode('1f_dining_center', -6.5, 0.02, 4.5, 0, 'Dining Room');
    addNode('1f_kitchen_island', -8.5, 0.02, 7.5, 0, 'Kitchen Island', true);
    addNode('1f_kitchen_sink', -11.0, 0.02, 8.5, 0, 'Kitchen Corner');
    addNode('1f_kitchen_door_patio', -4.0, 0.02, 9.8, 0, 'Kitchen Patio Door');

    // Central Corridor 1F
    addNode('1f_center_hall', 0, 0.02, 0, 0, '1F Central Hall');
    addNode('1f_rear_hall', 0, 0.02, 6.5, 0, '1F Rear Hallway');
    addNode('1f_rear_exit', 0, 0.02, 9.8, 0, '1F Rear Exit Door');

    // Garage (East side 1F: x: 3 to 13, z: -8 to 10)
    addNode('1f_garage_entrance_inside', 3.5, 0.03, -2.5, 0, 'Garage Interior Door');
    addNode('1f_garage_bay_north', 8.5, 0.03, -4.5, 0, 'Garage North Bay');
    addNode('1f_garage_car_cover', 8.5, 0.03, 0.5, 0, 'Garage Vehicle Cover', true);
    addNode('1f_garage_workbench', 11.5, 0.03, 5.5, 0, 'Garage Workbench', true);
    addNode('1f_garage_shutter_outside', 8.5, 0.03, -9.5, 0, 'Garage Shutter Door');

    // --- STAIRCASE (Connects 1F to 2F) ---
    addNode('stair_base_1f', 1.5, 0.02, -2.5, 0, 'Stairs Base 1F');
    addNode('stair_mid', 1.5, 1.75, 0.0, 0.5, 'Stairs Midpoint');
    addNode('stair_top_2f', 1.5, 3.45, 2.5, 1, 'Stairs Top 2F');

    // --- 2F INTERIOR (Floor height y ≈ 3.45) ---
    addNode('2f_hallway_center', 0, 3.45, 1.5, 1, '2F Hallway Center');
    addNode('2f_hallway_north', 0, 3.45, -3.5, 1, '2F Hallway North');
    addNode('2f_hallway_south', 0, 3.45, 6.5, 1, '2F Hallway South');

    // Master Bedroom (North-West 2F: x: -13 to -1, z: -9 to 0)
    addNode('2f_master_door', -2.5, 3.45, -3.5, 1, 'Master Bedroom Doorway');
    addNode('2f_master_center', -7.5, 3.45, -4.5, 1, 'Master Bedroom');
    addNode('2f_master_bed_cover', -10.0, 3.45, -6.5, 1, 'Master Bed Cover', true);
    addNode('2f_master_balcony_window', -7.5, 3.45, -8.8, 1, 'Master North Balcony');

    // Kids Bedroom (South-West 2F: x: -13 to -1, z: 1 to 9)
    addNode('2f_kids_door', -2.5, 3.45, 4.5, 1, 'Kids Bedroom Doorway');
    addNode('2f_kids_center', -7.5, 3.45, 5.5, 1, 'Kids Bedroom');
    addNode('2f_kids_closet_cover', -10.5, 3.45, 7.5, 1, 'Kids Closet Cover', true);

    // Bathroom (East North 2F: x: 3 to 13, z: -9 to -2)
    addNode('2f_bath_door', 3.5, 3.45, -3.5, 1, 'Bathroom Door');
    addNode('2f_bath_center', 7.5, 3.45, -5.5, 1, 'Bathroom Center');

    // BOMB SITE / VAULT (East South 2F: x: 3 to 13, z: -1 to 9) - PRIMARY OBJECTIVE
    addNode('2f_vault_door', 3.5, 3.45, 2.5, 1, 'Vault Entrance');
    addNode('2f_vault_center', 8.0, 3.45, 3.5, 1, 'Objective Vault Site (Bomb)');
    addNode('2f_vault_server_cover_1', 6.0, 3.45, 6.5, 1, 'Vault Server Rack A', true);
    addNode('2f_vault_server_cover_2', 10.5, 3.45, 6.5, 1, 'Vault Server Rack B', true);
    addNode('2f_vault_window_east', 12.5, 3.45, 3.5, 1, 'Vault East Rappel Window');

    // --- CONNECT NAV GRAPH EDGES ---
    // Exterior Street & Approaches
    link('ext_spawn_street_center', 'ext_walkway_mid');
    link('ext_spawn_street_west', 'ext_swat_cover_west');
    link('ext_spawn_street_east', 'ext_swat_cover_east');
    link('ext_swat_cover_west', 'ext_walkway_mid');
    link('ext_swat_cover_east', 'ext_walkway_mid');
    link('ext_walkway_mid', 'ext_porch_steps');
    link('ext_porch_steps', 'ext_porch_center');

    // Exterior Alleys & Yards
    link('ext_spawn_street_west', 'ext_alley_west_north');
    link('ext_alley_west_north', 'ext_alley_west_mid');
    link('ext_alley_west_mid', 'ext_alley_west_south');
    link('ext_alley_west_south', 'ext_patio_rear');

    link('ext_spawn_street_east', 'ext_alley_east_north');
    link('ext_alley_east_north', 'ext_alley_east_mid');
    link('ext_alley_east_mid', 'ext_alley_east_south');
    link('ext_alley_east_south', 'ext_patio_rear');

    link('ext_patio_rear', 'ext_patio_door_outside');

    // Exterior into House Entrances
    link('ext_porch_center', '1f_front_door');
    link('1f_front_door', '1f_foyer_center');

    link('ext_alley_east_north', '1f_garage_shutter_outside');
    link('1f_garage_shutter_outside', '1f_garage_bay_north');

    link('ext_patio_door_outside', '1f_rear_exit');
    link('1f_rear_exit', '1f_rear_hall');

    link('ext_patio_rear', '1f_kitchen_door_patio');
    link('1f_kitchen_door_patio', '1f_dining_center');

    // 1F Room Interconnections
    link('1f_foyer_center', '1f_foyer_hall_west');
    link('1f_foyer_center', '1f_foyer_hall_east');
    link('1f_foyer_center', '1f_center_hall');

    link('1f_foyer_hall_west', '1f_living_center');
    link('1f_living_center', '1f_living_tv_cover');
    link('1f_living_center', '1f_living_couch_cover');
    link('1f_living_center', '1f_living_window_north');
    link('1f_living_center', '1f_dining_center');

    link('1f_dining_center', '1f_kitchen_island');
    link('1f_kitchen_island', '1f_kitchen_sink');
    link('1f_dining_center', '1f_center_hall');

    link('1f_center_hall', '1f_rear_hall');
    link('1f_foyer_hall_east', '1f_garage_entrance_inside');
    link('1f_center_hall', '1f_garage_entrance_inside');

    link('1f_garage_entrance_inside', '1f_garage_bay_north');
    link('1f_garage_bay_north', '1f_garage_car_cover');
    link('1f_garage_car_cover', '1f_garage_workbench');

    // Staircase Navigation
    link('1f_center_hall', 'stair_base_1f');
    link('stair_base_1f', 'stair_mid');
    link('stair_mid', 'stair_top_2f');
    link('stair_top_2f', '2f_hallway_center');

    // 2F Room Interconnections
    link('2f_hallway_center', '2f_hallway_north');
    link('2f_hallway_center', '2f_hallway_south');

    link('2f_hallway_north', '2f_master_door');
    link('2f_master_door', '2f_master_center');
    link('2f_master_center', '2f_master_bed_cover');
    link('2f_master_center', '2f_master_balcony_window');

    link('2f_hallway_south', '2f_kids_door');
    link('2f_kids_door', '2f_kids_center');
    link('2f_kids_center', '2f_kids_closet_cover');

    link('2f_hallway_north', '2f_bath_door');
    link('2f_bath_door', '2f_bath_center');

    link('2f_hallway_center', '2f_vault_door');
    link('2f_hallway_south', '2f_vault_door');
    link('2f_vault_door', '2f_vault_center');
    link('2f_vault_center', '2f_vault_server_cover_1');
    link('2f_vault_center', '2f_vault_server_cover_2');
    link('2f_vault_center', '2f_vault_window_east');
  }

  /**
   * Finds the closest node in the navigation graph to a given 3D position,
   * taking into account vertical floor matching.
   */
  public getNearestNode(pos: THREE.Vector3, preferredFloor?: number): NavNode {
    let bestNode: NavNode | null = null;
    let bestDist = Infinity;

    const targetFloor = preferredFloor !== undefined ? preferredFloor : (pos.y > 1.8 ? 1 : 0);

    for (const node of this.nodes.values()) {
      // Floor affinity bonus
      const floorDiff = Math.abs(node.floor - targetFloor);
      const floorPenalty = floorDiff > 0.4 ? 15.0 : 0;

      const dist = pos.distanceTo(node.pos) + floorPenalty;
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    return bestNode || this.nodes.values().next().value as NavNode;
  }

  /**
   * Computes the shortest path between start and goal using A* (A-Star) search.
   * Returns an array of THREE.Vector3 waypoint coordinates.
   */
  public findPath(startPos: THREE.Vector3, goalPos: THREE.Vector3): THREE.Vector3[] {
    const startNode = this.getNearestNode(startPos);
    const goalNode = this.getNearestNode(goalPos);

    if (startNode.id === goalNode.id) {
      return [goalPos.clone()];
    }

    const openSet = new Set<string>([startNode.id]);
    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>();
    gScore.set(startNode.id, 0);

    const fScore = new Map<string, number>();
    fScore.set(startNode.id, startNode.pos.distanceTo(goalNode.pos));

    while (openSet.size > 0) {
      // Get node with lowest fScore in openSet
      let currentId = '';
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentId = id;
        }
      }

      if (currentId === goalNode.id) {
        // Reconstruct path
        const path: THREE.Vector3[] = [goalPos.clone()];
        let curr = currentId;
        while (cameFrom.has(curr)) {
          const node = this.nodes.get(curr)!;
          path.unshift(node.pos.clone());
          curr = cameFrom.get(curr)!;
        }
        return path;
      }

      openSet.delete(currentId);
      const currentNode = this.nodes.get(currentId)!;
      const currentG = gScore.get(currentId) ?? Infinity;

      for (const neighborId of currentNode.neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        const tentativeG = currentG + currentNode.pos.distanceTo(neighbor.pos);
        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + neighbor.pos.distanceTo(goalNode.pos));
          openSet.add(neighborId);
        }
      }
    }

    // Direct fallback if no path found
    return [goalPos.clone()];
  }

  /**
   * Finds the best defensive tactical cover node near a reference position.
   */
  public getDefensiveCoverNodes(nearPos: THREE.Vector3, maxDist = 8): NavNode[] {
    const covers: NavNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.isCover && node.pos.distanceTo(nearPos) <= maxDist) {
        covers.push(node);
      }
    }
    return covers;
  }
}

export const navGraph = new NavGraph();
