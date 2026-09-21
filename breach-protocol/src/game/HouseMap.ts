import * as THREE from 'three';
import { ProceduralTextures } from './TextureFactory';
import { buildWarehouseDistrict, buildOfficeTower, buildHarborVilla, buildAlpineChalet } from '../maps/NewMaps';

export interface DestructibleBarricade {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  width: number;
  height: number;
  isBreached: boolean;
  hp: number;
  normal: THREE.Vector3;
  isWindow: boolean;
  floor: number;
}

export interface RappelWall {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  wallX: number;
  wallZ: number;
  normal: THREE.Vector3;
  roofY: number;
  groundY: number;
}

export interface ColliderAABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  h?: number;
  temporary?: boolean;
  reinforced?: boolean;
  name?: string;
}

export class HouseMapBuilder {
  public static buildHouse(scene: THREE.Scene, mapKey: string = 'suburban_house'): {
    colliders: ColliderAABB[];
    barricades: DestructibleBarricade[];
    rappelWalls: RappelWall[];
    objectivePos: THREE.Vector3;
    spawnsAtk: [number, number][];
    spawnsDef: [number, number][];
    animatedLights: THREE.PointLight[];
  } {
    // Structurally different maps (own footprint, rooms, spawns, objective) live in NewMaps.ts
    if (mapKey === 'warehouse') return buildWarehouseDistrict(scene);
    if (mapKey === 'office_tower') return buildOfficeTower(scene);
    if (mapKey === 'harbor_villa') return buildHarborVilla(scene);
    if (mapKey === 'chalet') return buildAlpineChalet(scene);

    const colliders: ColliderAABB[] = [];
    const barricades: DestructibleBarricade[] = [];
    const rappelWalls: RappelWall[] = [];
    const animatedLights: THREE.PointLight[] = [];

    // Custom colors & styles depending on the Map Key:
    // suburban_house: Sunset warm lighting
    // harbor_villa: Bright mid-day coastal look
    // chalet: Snowy cold night sky with warm windows
    let wallColor = 0xece5d8; // Default warm drywall
    let extBrickColor = 0xa35544; // Default red brick
    let roofColor = 0x2a3036; // Default dark asphalt
    
    if (mapKey === 'harbor_villa') {
      wallColor = 0xe4e9f0; // Clean light-blue/gray
      extBrickColor = 0xd0c4b8; // Clean beige sand brick
      roofColor = 0x1f3c4d; // Blueish maritime roof
    } else if (mapKey === 'chalet') {
      wallColor = 0xd6e4ff; // Winter frosty blue
      extBrickColor = 0x566573; // Gray slate alpine stone
      roofColor = 0x1c2833; // Frosty black roof
    }

    // -------------------------------------------------------------
    // 1. PROCEDURAL HIGH-RESOLUTION PBR TEXTURES & MATERIALS
    // -------------------------------------------------------------
    const brickTex = ProceduralTextures.createBrickTexture(8, 6);
    const woodFloorTex = ProceduralTextures.createWoodFloorTexture(10, 8);
    const tileTex = ProceduralTextures.createTileTexture(6, 6);
    const roofTex = ProceduralTextures.createRoofShingleTexture(12, 10);
    const drywallLivingTex = ProceduralTextures.createDrywallTexture(0xece5d8, 8, 6);
    const drywallBedTex = ProceduralTextures.createDrywallTexture(0xd9e2ec, 8, 6);
    const roadTex = ProceduralTextures.createRoadAsphaltTexture(1, 6);
    const concreteTex = ProceduralTextures.createConcreteTexture(6, 6);
    const carpetTex = ProceduralTextures.createCarpetTexture();
    const hazardTapeTex = ProceduralTextures.createHazardTapeTexture();
    const serverRackTex = ProceduralTextures.createServerRackTexture();

    const wallExtMat = new THREE.MeshStandardMaterial({
      map: brickTex,
      color: extBrickColor,
      roughness: 0.82,
      metalness: 0.12
    });
    const wallIntMat = new THREE.MeshStandardMaterial({
      map: drywallLivingTex,
      color: wallColor,
      roughness: 0.88,
      metalness: 0.05
    });
    const wallBedMat = new THREE.MeshStandardMaterial({
      map: drywallBedTex,
      color: mapKey === 'chalet' ? 0xcce0ff : 0xd9e2ec,
      roughness: 0.88,
      metalness: 0.05
    });
    const wallVaultMat = new THREE.MeshStandardMaterial({
      color: 0x222a30,
      roughness: 0.45,
      metalness: 0.65
    });
    const floorWoodMat = new THREE.MeshStandardMaterial({
      map: woodFloorTex,
      roughness: 0.35,
      metalness: 0.12
    });
    const floorTileMat = new THREE.MeshStandardMaterial({
      map: tileTex,
      roughness: 0.35,
      metalness: 0.18
    });
    const floorConcreteMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.7,
      metalness: 0.2
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: roofTex,
      color: roofColor,
      roughness: 0.75,
      metalness: 0.15
    });
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.85,
      metalness: 0.15
    });
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x2b4c25,
      roughness: 0.95
    });
    const curbMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.8,
      metalness: 0.15
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x231a12,
      roughness: 0.55
    });
    const whiteTrimMat = new THREE.MeshStandardMaterial({
      color: 0xdedede,
      roughness: 0.5
    });
    const metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e22,
      roughness: 0.35,
      metalness: 0.85
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.05,
      metalness: 0.95,
      transmission: 0.75
    });

    // -------------------------------------------------------------
    // HELPER: Exact 3D AABB Solid Wall without artificial expansion
    // -------------------------------------------------------------
    const addWall = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material = wallExtMat,
      addCol = true
    ) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      if (addCol) {
        colliders.push({
          minX: x - w / 2,
          maxX: x + w / 2,
          minY: y,
          maxY: y + h,
          minZ: z - d / 2,
          maxZ: z + d / 2,
          h: y + h
        });
      }
      return mesh;
    };

    // Helper: Add wooden plank barricade (doors/windows)
    const addBarricade = (
      id: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      isWindow: boolean,
      normal: THREE.Vector3,
      floorNum: number
    ) => {
      const group = new THREE.Group();
      group.position.set(x, y + h / 2, z);

      const plankMat = new THREE.MeshStandardMaterial({ color: 0x785232, roughness: 0.85 });

      // Frame
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.12), trimMat);
      frameL.position.set(-w / 2 + 0.05, 0, 0);
      const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.12), trimMat);
      frameR.position.set(w / 2 - 0.05, 0, 0);
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.12), trimMat);
      frameTop.position.set(0, h / 2 - 0.05, 0);
      group.add(frameL, frameR, frameTop);

      // Wooden Planks (for door barricades, leave a 0.30m clearance gap for recon drone access)
      const bottomGap = isWindow ? 0.0 : 0.30;
      const numPlanks = Math.floor((h - bottomGap) / 0.22);
      for (let i = 0; i < numPlanks; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.18, 0.045), plankMat);
        plank.position.set(0, -h / 2 + bottomGap + 0.10 + i * 0.22, (i % 2 === 0 ? 0.015 : -0.015));
        plank.castShadow = true;
        group.add(plank);
      }

      // Tactical Yellow Hazard Caution Tape
      const tape = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.9, 0.08, 0.055),
        new THREE.MeshBasicMaterial({ map: hazardTapeTex })
      );
      tape.position.set(0, 0, 0.03);
      group.add(tape);

      const isXAxis = Math.abs(normal.x) > 0.5;
      if (isXAxis) {
        group.rotation.y = Math.PI / 2;
      }

      scene.add(group);

      const barricade: DestructibleBarricade = {
        id,
        mesh: group,
        position: new THREE.Vector3(x, y + h / 2, z),
        width: w,
        height: h,
        isBreached: false,
        hp: 120,
        normal,
        isWindow,
        floor: floorNum
      };

      barricades.push(barricade);

      // Barricade collision box (doors leave 0.30m clearance at bottom for recon drone access)
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
    };

    // -------------------------------------------------------------
    // 2. OUTDOOR PERIMETER, ROADS, TREES & TACTICAL SWAT COVER
    // -------------------------------------------------------------
    // Vast Green Lawn
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), grassMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.receiveShadow = true;
    scene.add(lawn);

    // Front Asphalt Street with lane striping (Z: -32 to -22)
    const street = new THREE.Mesh(new THREE.PlaneGeometry(100, 12), roadMat);
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, 0.02, -26);
    street.receiveShadow = true;
    scene.add(street);

    // Concrete Curbs & Sidewalk
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(100, 0.14, 3.5), curbMat);
    sidewalk.position.set(0, 0.07, -18.25);
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);

    // Paver Walkway from Sidewalk to Front Porch
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 8.5), floorTileMat);
    walkway.position.set(0, 0.075, -13.25);
    walkway.receiveShadow = true;
    scene.add(walkway);

    // Front Porch Deck & Overhang (Z = -9.8 to -9.0)
    const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.18, 2.0), floorWoodMat);
    porchDeck.position.set(0, 0.09, -10.0);
    porchDeck.receiveShadow = true;
    scene.add(porchDeck);

    // Porch White Architectural Pillars
    for (let px = -2.6; px <= 2.6; px += 5.2) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, 0.24), whiteTrimMat);
      pillar.position.set(px, 1.4, -10.8);
      pillar.castShadow = true;
      scene.add(pillar);
      colliders.push({ minX: px - 0.2, maxX: px + 0.2, minY: 0, maxY: 2.8, minZ: -11.0, maxZ: -10.6, h: 2.8 });
    }

    // Porch Overhang Roof
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 2.4), roofMat);
    porchRoof.position.set(0, 2.9, -10.0);
    porchRoof.castShadow = true;
    scene.add(porchRoof);

    // Porch Lantern Light
    const porchLight = new THREE.PointLight(0xffdf99, 1.6, 12, 2);
    porchLight.position.set(0, 2.6, -9.5);
    scene.add(porchLight);

    // SWAT Command Cruiser with animated dual lightbars
    const swatVan = new THREE.Group();
    swatVan.position.set(-5.5, 0, -23);

    const vanBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.8, 5.8),
      new THREE.MeshStandardMaterial({ color: 0x11161a, metalness: 0.85, roughness: 0.3 })
    );
    vanBody.position.set(0, 1.15, 0);
    vanBody.castShadow = true;

    // SWAT Bull Bar / Push Bumper
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.3), metalDarkMat);
    pushBar.position.set(0, 0.7, 3.0);

    // Wheels
    for (let wx of [-1.35, 1.35]) {
      for (let wz of [-1.8, 1.8]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.28, 14), metalDarkMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.44, wz);
        swatVan.add(wheel);
      }
    }

    const sirenRed = new THREE.PointLight(0xff0022, 3.0, 20, 2);
    sirenRed.position.set(-0.6, 2.35, 0.4);
    const sirenBlue = new THREE.PointLight(0x0044ff, 3.0, 20, 2);
    sirenBlue.position.set(0.6, 2.35, 0.4);

    swatVan.add(vanBody, pushBar, sirenRed, sirenBlue);
    scene.add(swatVan);
    animatedLights.push(sirenRed, sirenBlue);
    colliders.push({ minX: -7.0, maxX: -4.0, minY: 0, maxY: 2.3, minZ: -26.2, maxZ: -19.8, h: 2.3 });

    // Tactical Concrete Jersey Barriers (Cover for Attackers)
    const addJerseyBarrier = (bx: number, bz: number, ry = 0) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, 0.5, bz);
      bGroup.rotation.y = ry;
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.6), curbMat);
      bMesh.castShadow = true;
      const bTape = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.12, 0.62), new THREE.MeshBasicMaterial({ map: hazardTapeTex }));
      bTape.position.y = 0.2;
      bGroup.add(bMesh, bTape);
      scene.add(bGroup);
      const rad = 1.45;
      colliders.push({ minX: bx - rad, maxX: bx + rad, minY: 0, maxY: 1.05, minZ: bz - 0.32, maxZ: bz + 0.32, h: 1.05 });
    };

    // Keep central approach path (X: -2.5 to 2.5) clear from spawn to porch while providing flanking cover
    addJerseyBarrier(-4.5, -17.5, 0.15);
    addJerseyBarrier(4.8, -17.5, -0.15);
    addJerseyBarrier(-10.5, -19.0, -0.2);

    // Realistic 3D Trees with Layered Volumetric Foliage
    const addTree = (tx: number, tz: number, scale = 1) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);

      // Bark Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 * scale, 0.5 * scale, 3.5 * scale, 8),
        new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 })
      );
      trunk.position.set(0, 1.75 * scale, 0);
      trunk.castShadow = true;
      tree.add(trunk);

      // Foliage Canopies
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1f3c1a, roughness: 0.85 });
      for (let l = 0; l < 3; l++) {
        const rad = (2.2 - l * 0.45) * scale;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(rad, 2.6 * scale, 7), foliageMat);
        leaves.position.set(0, (3.2 + l * 1.5) * scale, 0);
        leaves.castShadow = true;
        tree.add(leaves);
      }

      scene.add(tree);
      colliders.push({ minX: tx - 0.5 * scale, maxX: tx + 0.5 * scale, minY: 0, maxY: 6.0, minZ: tz - 0.5 * scale, maxZ: tz + 0.5 * scale, h: 6 });
    };

    addTree(-16, -14, 1.1);
    addTree(16, -14, 1.2);
    addTree(-18, 6, 1.3);
    addTree(18, 6, 1.1);
    addTree(-10, 16, 1.25);
    addTree(10, 16, 1.2);

    // Perimeter Iron Picket Fence with Brick Pillars
    addWall(0, 0, -34, 68, 2.0, 0.25, trimMat);
    addWall(0, 0, 34, 68, 2.0, 0.25, trimMat);
    addWall(34, 0, 0, 0.25, 2.0, 68, trimMat);
    addWall(-34, 0, 0, 0.25, 2.0, 68, trimMat);

    // -------------------------------------------------------------
    // 3. MAIN 2-STORY RESIDENTIAL HOUSE (24m x 18m, 6.4m high)
    // -------------------------------------------------------------
    const H_WALL = 6.4;
    const F1_Y = 0;
    const F2_Y = 3.2;

    // Ground Floor Living & Kitchen Parquet Wood / Tile
    const f1Floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), floorWoodMat);
    f1Floor.rotation.x = -Math.PI / 2;
    f1Floor.position.set(0, 0.02, 0);
    f1Floor.receiveShadow = true;
    scene.add(f1Floor);

    // Garage Concrete Slab (X: 3 to 12, Z: -9 to 9)
    const garageFloor = new THREE.Mesh(new THREE.PlaneGeometry(9, 18), floorConcreteMat);
    garageFloor.rotation.x = -Math.PI / 2;
    garageFloor.position.set(7.5, 0.03, 0);
    garageFloor.receiveShadow = true;
    scene.add(garageFloor);

    // -------------------------------------------------------------
    // SECOND FLOOR SLAB WITH STAIRWELL OPENING CUTOUT
    // Stair opening is at: X: 0.6 to 2.4, Z: -3.2 to 2.2
    // -------------------------------------------------------------
    // Left Floor Plate (X: -12 to 0.6, width: 12.6m)
    const f2Left = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.25, 18), floorWoodMat);
    f2Left.position.set(-5.7, F2_Y + 0.125, 0);
    f2Left.receiveShadow = true;
    scene.add(f2Left);

    // Right Floor Plate (X: 2.4 to 12, width: 9.6m)
    const f2Right = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.25, 18), floorTileMat);
    f2Right.position.set(7.2, F2_Y + 0.125, 0);
    f2Right.receiveShadow = true;
    scene.add(f2Right);

    // North Floor Plate bridging front (X: 0.6 to 2.4, Z: -9 to -3.2, depth: 5.8m)
    const f2Front = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 5.8), floorWoodMat);
    f2Front.position.set(1.5, F2_Y + 0.125, -6.1);
    f2Front.receiveShadow = true;
    scene.add(f2Front);

    // South Floor Plate bridging back (X: 0.6 to 2.4, Z: 2.2 to 9, depth: 6.8m)
    const f2Back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 6.8), floorWoodMat);
    f2Back.position.set(1.5, F2_Y + 0.125, 5.6);
    f2Back.receiveShadow = true;
    scene.add(f2Back);

    // 2F Stairwell Safety Guardrails (prevents falling over edge on 2F, leaves top opening for stepping onto 2F)
    const railWest = addWall(0.6, F2_Y + 0.25, -0.5, 0.08, 1.0, 5.4, trimMat);
    const railEast = addWall(2.4, F2_Y + 0.25, -0.5, 0.08, 1.0, 5.4, trimMat);
    // Front safety rail protecting stair opening
    addWall(1.5, F2_Y + 0.25, -3.2, 1.8, 1.0, 0.08, trimMat);

    // Roof Slab with Asphalt Shingles
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(24.8, 0.35, 18.8), roofMat);
    roofSlab.position.set(0, H_WALL + 0.175, 0);
    roofSlab.receiveShadow = true;
    scene.add(roofSlab);

    // Roof Parapet / Rappel Anchor Wall (only collides on roof level Y >= 6.4)
    addWall(0, H_WALL + 0.35, -9.2, 24.8, 0.9, 0.3, trimMat);
    addWall(0, H_WALL + 0.35, 9.2, 24.8, 0.9, 0.3, trimMat);
    addWall(-12.2, H_WALL + 0.35, 0, 0.3, 0.9, 18.8, trimMat);
    addWall(12.2, H_WALL + 0.35, 0, 0.3, 0.9, 18.8, trimMat);

    // -------------------------------------------------------------
    // 4. EXTERIOR WALLS & ENTRY INFILTRATION POINTS
    // -------------------------------------------------------------
    // FRONT WALL (Z = -9)
    // Left segment: X from -12 to -1.0 (width = 11.0m)
    addWall(-6.5, F1_Y, -9, 11.0, 3.2, 0.4, wallExtMat);
    addWall(-6.5, F2_Y, -9, 11.0, 3.2, 0.4, wallExtMat);

    // Right side: Between front door (X: 1.0) and garage door (X: 5.8)
    addWall(3.4, F1_Y, -9, 4.8, 3.2, 0.4, wallExtMat);
    // Garage door lintel above opening (X: 5.8 to 9.2, leaves Y: 0 to 2.6 clear for roll-up door)
    addWall(7.5, F1_Y + 2.6, -9, 3.4, 0.6, 0.4, wallExtMat);
    // Wall right of garage door (X: 9.2 to 12.0)
    addWall(10.6, F1_Y, -9, 2.8, 3.2, 0.4, wallExtMat);
    // 2F Front Wall Right (solid bedroom/vault wall)
    addWall(6.5, F2_Y, -9, 11.0, 3.2, 0.4, wallExtMat);

    // Front Entry Doorway at X: 0, Z: -9 (width = 2.0m, height = 2.4m)
    // Door lintel (only blocks Y from 2.4 to 3.2, leaves full 2.4m clearance underneath!)
    addWall(0, F1_Y + 2.4, -9, 2.0, 0.8, 0.4, wallExtMat);
    addBarricade('door_front', 0, F1_Y, -9, 2.0, 2.4, false, new THREE.Vector3(0, 0, -1), 1);

    // 2nd Floor Master Bedroom Rappel Window Barricade at X: 0, Z: -9
    // Sill from 3.2 to 4.0, Window from 4.0 to 5.8, Lintel from 5.8 to 6.4
    addWall(0, F2_Y, -9, 2.0, 0.8, 0.4, wallExtMat);
    addWall(0, F2_Y + 2.6, -9, 2.0, 0.6, 0.4, wallExtMat);
    addBarricade('win_front_2f', 0, F2_Y + 0.8, -9, 2.0, 1.8, true, new THREE.Vector3(0, 0, -1), 2);

    // Garage Main Roll-Up Door at X: 7.5, Z: -9
    addBarricade('door_garage', 7.5, F1_Y, -9, 3.4, 2.6, false, new THREE.Vector3(0, 0, -1), 1);

    // BACK WALL (Z = +9)
    // Left segment: X from -12 to -1.2 (width 10.8m)
    addWall(-6.6, 0, 9, 10.8, H_WALL, 0.4, wallExtMat);
    // Right segment: X from 1.2 to 12 (width 10.8m)
    addWall(6.6, 0, 9, 10.8, H_WALL, 0.4, wallExtMat);

    // Back Patio 1F Doorway (X = 0, Z = +9, width 2.4m, height 2.4m)
    addWall(0, F1_Y + 2.4, 9, 2.4, 0.8, 0.4, wallExtMat);
    addBarricade('win_back_patio', 0, F1_Y, 9, 2.4, 2.4, false, new THREE.Vector3(0, 0, 1), 1);

    // Back 2F Window
    addWall(0, F2_Y, 9, 2.4, 0.8, 0.4, wallExtMat);
    addWall(0, F2_Y + 2.6, 9, 2.4, 0.6, 0.4, wallExtMat);
    addBarricade('win_back_2f', 0, F2_Y + 0.8, 9, 2.4, 1.8, true, new THREE.Vector3(0, 0, 1), 2);

    // WEST EXTERIOR WALL (X = -12) - Infiltration Flank
    // Continuous seamless exterior wall from Z: -9 to -2, and Z: 0 to +9
    addWall(-12, 0, -5.5, 0.4, H_WALL, 7.0, wallExtMat);
    addWall(-12, 0, 4.5, 0.4, H_WALL, 9.0, wallExtMat);
    // 2F West Rappel Window centered at Z: -1 (spans Z: -2 to 0, completely closing the wall gap!)
    addWall(-12, F1_Y, -1, 0.4, 3.2, 2.0, wallExtMat);
    addWall(-12, F2_Y, -1, 0.4, 0.8, 2.0, wallExtMat);
    addWall(-12, F2_Y + 2.6, -1, 0.4, 0.6, 2.0, wallExtMat);
    addBarricade('win_west_2f', -12, F2_Y + 0.8, -1, 2.0, 1.8, true, new THREE.Vector3(-1, 0, 0), 2);

    // EAST EXTERIOR WALL (X = +12) - Garage Flank
    // Continuous seamless exterior wall from Z: -9 to 0, and Z: 2 to +9
    addWall(12, 0, -4.5, 0.4, H_WALL, 9.0, wallExtMat);
    addWall(12, 0, 5.5, 0.4, H_WALL, 7.0, wallExtMat);
    // 2F East Rappel Window centered at Z: +1 (spans Z: 0 to 2, completely closing the wall gap!)
    addWall(12, F1_Y, 1, 0.4, 3.2, 2.0, wallExtMat);
    addWall(12, F2_Y, 1, 0.4, 0.8, 2.0, wallExtMat);
    addWall(12, F2_Y + 2.6, 1, 0.4, 0.6, 2.0, wallExtMat);
    addBarricade('win_east_2f', 12, F2_Y + 0.8, 1, 2.0, 1.8, true, new THREE.Vector3(1, 0, 0), 2);

    // -------------------------------------------------------------
    // 5. INTERIOR ROOM ARCHITECTURE & WALLS (WATERTIGHT & ENCLOSED)
    // -------------------------------------------------------------
    // Foyer & Living Room Partition (X = -3)
    // North wall segment (Z: -9 to -3)
    addWall(-3, F1_Y, -6, 0.25, 3.2, 6.0, wallIntMat);
    // Interior door header (leaves Z: -3 to -1 open for walking!)
    addWall(-3, F1_Y + 2.4, -2, 0.25, 0.8, 2.0, wallIntMat);
    // South wall segment (Z: -1 to +1)
    addWall(-3, F1_Y, 0, 0.25, 3.2, 2.0, wallIntMat);

    // Living Room & Kitchen Wide Open Archway (Z = +1, X: -12 to -3)
    addWall(-10.5, F1_Y, 1, 3.0, 3.2, 0.25, wallIntMat);
    // Archway Header (clearance underneath from X: -9 to -6)
    addWall(-7.5, F1_Y + 2.6, 1, 3.0, 0.6, 0.25, wallIntMat);
    addWall(-4.5, F1_Y, 1, 3.0, 3.2, 0.25, wallIntMat);

    // Kitchen & Hallway Dividing Wall (X = -3, Z: +1 to +9)
    addWall(-3, F1_Y, 2.5, 0.25, 3.2, 3.0, wallIntMat);
    // Kitchen door header (leaves Z: 4 to 6 open for doorway!)
    addWall(-3, F1_Y + 2.4, 5.0, 0.25, 0.8, 2.0, wallIntMat);
    addWall(-3, F1_Y, 7.5, 0.25, 3.2, 3.0, wallIntMat);

    // Garage Dividing Wall (X = +3, Z: -9 to +9)
    // Front segment: Z: -9 to +1
    addWall(3, F1_Y, -4, 0.25, 3.2, 10.0, wallIntMat);
    // Interior garage door header (leaves Z: 1 to 3 open!)
    addWall(3, F1_Y + 2.4, 2, 0.25, 0.8, 2.0, wallIntMat);
    // Rear segment: Z: +3 to +9
    addWall(3, F1_Y, 6, 0.25, 3.2, 6.0, wallIntMat);

    // -------------------------------------------------------------
    // 6. STAIRCASE (SMOOTH CLIMBING FROM 1F TO 2F)
    // -------------------------------------------------------------
    // Stair runs from Z = -3.2 (y = 0) to Z = 2.2 (y = 3.2)
    // Width = 1.6m (X: 0.7 to 2.3)
    for (let s = 0; s < 12; s++) {
      const stepH = 0.27;
      const stepD = 0.45;
      const currentH = (s + 1) * stepH;
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, currentH, stepD), trimMat);
      step.position.set(1.5, currentH / 2, -3.0 + s * stepD);
      step.castShadow = true;
      step.receiveShadow = true;
      scene.add(step);
    }

    // -------------------------------------------------------------
    // 7. SECOND FLOOR ROOMS (MASTER BEDROOM, SOUTH SUITE, VAULT, LAB)
    // -------------------------------------------------------------
    // 2F West Interior Wall along X = -1.0 (separates West rooms from Hallway)
    // Master Bedroom front segment (Z: -9 to -3)
    addWall(-1.0, F2_Y, -6.0, 0.25, 3.2, 6.0, wallBedMat);
    // Master Bedroom door header (leaves Z: -3.0 to -1.2 open for 1.8m doorway!)
    addWall(-1.0, F2_Y + 2.4, -2.1, 0.25, 0.8, 1.8, wallBedMat);
    // Master Bedroom rear segment (Z: -1.2 to +2.0)
    addWall(-1.0, F2_Y, 0.4, 0.25, 3.2, 3.2, wallBedMat);
    // Master Bedroom South Wall along Z = +2.0 (X: -12 to -1.0)
    addWall(-6.5, F2_Y, 2.0, 11.0, 3.2, 0.25, wallBedMat);

    // South Suite / Tactical Armory along X = -1.0 (Z: +2.0 to +9.0)
    addWall(-1.0, F2_Y, 3.25, 0.25, 3.2, 2.5, wallBedMat);
    // South Suite door header (leaves Z: 4.5 to 6.3 open for 1.8m doorway!)
    addWall(-1.0, F2_Y + 2.4, 5.4, 0.25, 0.8, 1.8, wallBedMat);
    addWall(-1.0, F2_Y, 7.65, 0.25, 3.2, 2.7, wallBedMat);

    // 2F East Interior Wall along X = +3.0 (separates Biohazard Vault & Lab from Hallway)
    // Biohazard Vault front segment (Z: -9 to +1.6)
    addWall(3.0, F2_Y, -3.7, 0.25, 3.2, 10.6, wallVaultMat);
    // Biohazard Vault Door Header (leaves Z: 1.6 to 3.4 open for Vault doorway!)
    addWall(3.0, F2_Y + 2.4, 2.5, 0.25, 0.8, 1.8, wallVaultMat);
    // Vault Barricade directly on hallway opening
    addBarricade('door_obj_site', 3.0, F2_Y, 2.5, 1.8, 2.4, false, new THREE.Vector3(-1, 0, 0), 2);
    // Vault dividing wall segment (Z: 3.4 to 4.0)
    addWall(3.0, F2_Y, 3.7, 0.25, 3.2, 0.6, wallVaultMat);
    // Vault South Dividing Wall along Z = +4.0 (X: +3.0 to +12.0)
    addWall(7.5, F2_Y, 4.0, 9.0, 3.2, 0.25, wallVaultMat);

    // East Server Lab along X = +3.0 (Z: +4.0 to +9.0)
    addWall(3.0, F2_Y, 4.75, 0.25, 3.2, 1.5, wallVaultMat);
    // East Lab door header (leaves Z: 5.5 to 7.3 open for doorway!)
    addWall(3.0, F2_Y + 2.4, 6.4, 0.25, 0.8, 1.8, wallVaultMat);
    addWall(3.0, F2_Y, 8.15, 0.25, 3.2, 1.7, wallVaultMat);

    // -------------------------------------------------------------
    // 8. RICH ARCHITECTURAL LIGHTING (REALISTIC INTERIOR FIXTURES)
    // -------------------------------------------------------------
    const addCeilingLight = (lx: number, ly: number, lz: number, color = 0xfffae6, intensity = 1.8, dist = 10) => {
      // Modern recessed downlight fixture
      const fixture = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 })
      );
      fixture.position.set(lx, ly, lz);
      const bulb = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffee })
      );
      bulb.rotation.x = Math.PI / 2;
      bulb.position.set(lx, ly - 0.03, lz);
      scene.add(fixture, bulb);

      const light = new THREE.PointLight(color, intensity, dist, 2);
      light.position.set(lx, ly - 0.2, lz);
      scene.add(light);
      return light;
    };

    // Foyer Warm Downlight
    addCeilingLight(0, F1_Y + 3.15, -6, 0xffe8c0, 1.6, 9);
    // Living Room Warm Ambient
    addCeilingLight(-7.5, F1_Y + 3.15, -4, 0xfff0d0, 1.9, 11);
    // Kitchen Clean Bright White
    addCeilingLight(-7.5, F1_Y + 3.15, 5, 0xffffff, 2.0, 11);
    // Garage Industrial Fluorescent Cool Glow
    const garageLight = addCeilingLight(7.5, F1_Y + 3.15, 0, 0xccedff, 2.2, 13);
    // 2F Hallway Light
    addCeilingLight(1.5, F2_Y + 3.15, 0, 0xffe8c0, 1.5, 8);
    // 2F Master Bedroom Soft Amber
    addCeilingLight(-6, F2_Y + 3.15, -6.5, 0xffdfb0, 1.6, 9);

    // -------------------------------------------------------------
    // 9. HIGH-DETAIL FURNITURE & TACTICAL PROPS
    // -------------------------------------------------------------
    // Living Room: Woven Persian Area Rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.2), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.9 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-7.5, F1_Y + 0.03, -4);
    rug.receiveShadow = true;
    scene.add(rug);

    // Living Room: Modern Leather Sectional Sofa
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x2b221c, roughness: 0.45, metalness: 0.1 });
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 1.1), sofaMat);
    sofa.position.set(-7.5, F1_Y + 0.425, -4.8);
    sofa.castShadow = true;
    scene.add(sofa);
    colliders.push({ minX: -8.8, maxX: -6.2, minY: 0, maxY: 0.85, minZ: -5.35, maxZ: -4.25, h: 0.85 });

    // Glass & Oak Coffee Table
    const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.85), trimMat);
    coffeeTable.position.set(-7.5, F1_Y + 0.21, -3.2);
    coffeeTable.castShadow = true;
    scene.add(coffeeTable);
    colliders.push({ minX: -8.3, maxX: -6.7, minY: 0, maxY: 0.45, minZ: -3.65, maxZ: -2.75, h: 0.45 });

    // Wall-Mounted 65" Curved Tactical TV Screen
    const tv = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.08), metalDarkMat);
    tv.position.set(-7.5, F1_Y + 1.8, -8.75);
    const tvScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 1.1),
      new THREE.MeshBasicMaterial({ color: 0x0a2233 })
    );
    tvScreen.position.set(-7.5, F1_Y + 1.8, -8.7);
    scene.add(tv, tvScreen);

    // Fireplace with Glowing Hearth
    const fireplace = new THREE.Group();
    fireplace.position.set(-11.75, F1_Y, -4);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 2.2), brickMat(brickTex));
    mantel.position.set(0, 0.7, 0);
    const fireGlow = new THREE.PointLight(0xff6611, 2.2, 7, 2);
    fireGlow.position.set(0.3, 0.45, 0);
    fireplace.add(mantel, fireGlow);
    scene.add(fireplace);
    animatedLights.push(fireGlow);
    colliders.push({ minX: -12.0, maxX: -11.4, minY: 0, maxY: 1.4, minZ: -5.1, maxZ: -2.9, h: 1.4 });

    // Kitchen: Polished Granite Island Counter
    const island = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.95, 1.3), floorTileMat);
    island.position.set(-7.5, F1_Y + 0.475, 5.2);
    island.castShadow = true;
    scene.add(island);
    colliders.push({ minX: -9.2, maxX: -5.8, minY: 0, maxY: 0.95, minZ: 4.55, maxZ: 5.85, h: 0.95 });

    // Stainless Steel Double-Door Refrigerator
    const fridge = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.1, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xd0d7de, metalness: 0.85, roughness: 0.25 })
    );
    fridge.position.set(-11.2, F1_Y + 1.05, 7.5);
    fridge.castShadow = true;
    scene.add(fridge);
    colliders.push({ minX: -11.8, maxX: -10.6, minY: 0, maxY: 2.1, minZ: 7.0, maxZ: 8.0, h: 2.1 });

    // Garage: Tactical Cruiser / SUV
    const suv = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.6, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x181f25, metalness: 0.8, roughness: 0.3 })
    );
    suv.position.set(7.5, F1_Y + 0.8, 1);
    suv.castShadow = true;
    scene.add(suv);
    colliders.push({ minX: 6.3, maxX: 8.7, minY: 0, maxY: 1.6, minZ: -1.4, maxZ: 3.4, h: 1.6 });

    // Garage Workbench with Tool Chest
    const workbench = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 3.2), trimMat);
    workbench.position.set(11.4, F1_Y + 0.475, -5.0);
    workbench.castShadow = true;
    scene.add(workbench);
    colliders.push({ minX: 11.0, maxX: 12.0, minY: 0, maxY: 0.95, minZ: -6.6, maxZ: -3.4, h: 0.95 });

    // 2F Master Bedroom: King Bed & Pillows
    const bedGroup = new THREE.Group();
    bedGroup.position.set(-7.5, F2_Y, -6.5);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 2.2), new THREE.MeshStandardMaterial({ color: 0xdce4ec, roughness: 0.8 }));
    mattress.position.set(0, 0.35, 0);
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.15), trimMat);
    headboard.position.set(0, 0.7, -1.05);
    bedGroup.add(mattress, headboard);
    scene.add(bedGroup);
    colliders.push({ minX: -8.6, maxX: -6.4, minY: F2_Y, maxY: F2_Y + 0.8, minZ: -7.6, maxZ: -5.4, h: F2_Y + 0.8 });

    // -------------------------------------------------------------
    // 10. OBJECTIVE: 2F BIOHAZARD NUCLEAR ISOTOPE VAULT & SERVERS
    // -------------------------------------------------------------
    // Server Racks along Vault Wall
    for (let s = -1; s <= 1; s += 2) {
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 2.4, 1.2),
        new THREE.MeshStandardMaterial({ map: serverRackTex, metalness: 0.6, roughness: 0.4 })
      );
      rack.position.set(7.5, F2_Y + 1.2, s * 2.8);
      rack.castShadow = true;
      scene.add(rack);
      colliders.push({ minX: 7.1, maxX: 7.9, minY: F2_Y, maxY: F2_Y + 2.4, minZ: s * 2.8 - 0.6, maxZ: s * 2.8 + 0.6, h: F2_Y + 2.4 });
    }

    // Hexagonal Hazard Pedestal & Biohazard Vault Containment Container
    const objGroup = new THREE.Group();
    objGroup.position.set(6.0, F2_Y, 0);

    const bioBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xe6a117, metalness: 0.7, roughness: 0.3 })
    );
    bioBox.position.set(0, 0.55, 0);
    bioBox.castShadow = true;

    // Glowing Holographic Radioactive Isotope Core
    const isotope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.55, 14),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc })
    );
    isotope.position.set(0, 1.35, 0);

    // Hazard Rotating Beacon Light
    const objLight = new THREE.PointLight(0x00ffcc, 2.8, 9, 2);
    objLight.position.set(0, 1.5, 0);
    animatedLights.push(objLight);

    objGroup.add(bioBox, isotope, objLight);
    scene.add(objGroup);
    colliders.push({ minX: 5.0, maxX: 7.0, minY: F2_Y, maxY: F2_Y + 1.6, minZ: -1.0, maxZ: 1.0, h: F2_Y + 1.6, name: 'biohazard_container' });

    // -------------------------------------------------------------
    // 11. EXTERIOR RAPPEL WALLS (FOUR SIDES FOR TACTICAL ASCENT)
    // -------------------------------------------------------------
    rappelWalls.push({
      id: 'rappel_front',
      minX: -11.5,
      maxX: 11.5,
      minZ: -10.5,
      maxZ: -8.8,
      wallX: 0,
      wallZ: -9.0,
      normal: new THREE.Vector3(0, 0, -1),
      roofY: H_WALL + 0.175,
      groundY: 0
    });

    rappelWalls.push({
      id: 'rappel_west',
      minX: -13.5,
      maxX: -11.8,
      minZ: -8.5,
      maxZ: 8.5,
      wallX: -12.0,
      wallZ: 0,
      normal: new THREE.Vector3(-1, 0, 0),
      roofY: H_WALL + 0.175,
      groundY: 0
    });

    rappelWalls.push({
      id: 'rappel_east',
      minX: 11.8,
      maxX: 13.5,
      minZ: -8.5,
      maxZ: 8.5,
      wallX: 12.0,
      wallZ: 0,
      normal: new THREE.Vector3(1, 0, 0),
      roofY: H_WALL + 0.175,
      groundY: 0
    });

    rappelWalls.push({
      id: 'rappel_back',
      minX: -11.5,
      maxX: 11.5,
      minZ: 8.8,
      maxZ: 10.5,
      wallX: 0,
      wallZ: 9.0,
      normal: new THREE.Vector3(0, 0, 1),
      roofY: H_WALL + 0.175,
      groundY: 0
    });

    return {
      colliders,
      barricades,
      rappelWalls,
      objectivePos: new THREE.Vector3(6.0, F2_Y + 0.25, 0), // top of 2F slab, not embedded in it
      spawnsAtk: [
        [-2, -25],
        [2, -25],
        [-6, -25],
        [6, -25]
      ],
      spawnsDef: [
        [6.0, -1.5],
        [8.5, 1.0],
        [4.5, 1.5],
        [-6.5, -4.0],
        [1.0, 5.0]
      ],
      animatedLights
    };
  }
}

function brickMat(tex: THREE.Texture) {
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.1 });
}
