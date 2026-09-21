import * as THREE from 'three';
import { ProceduralTextures } from './TextureFactory';

/**
 * ModelFactory: Generates ultra-detailed tactical humanoid operators and authentic firearms
 * featuring two-tone metallic PBR finishes, holographic optics, quad-tube NVGs,
 * MOLLE plate carriers, combat radios, and realistic anatomical proportions.
 */
export class ModelFactory {
  // High-contrast tactical materials
  private static gunReceiverMat = new THREE.MeshStandardMaterial({
    color: 0x22272c,
    roughness: 0.28,
    metalness: 0.85
  });
  private static gunSteelMat = new THREE.MeshStandardMaterial({
    color: 0x5a636e,
    roughness: 0.22,
    metalness: 0.95
  });
  private static gunPolymerMat = new THREE.MeshStandardMaterial({
    color: 0x181b1e,
    roughness: 0.8,
    metalness: 0.15
  });
  private static gunTanMat = new THREE.MeshStandardMaterial({
    color: 0x6e624f, // Flat Dark Earth (FDE)
    roughness: 0.65,
    metalness: 0.2
  });
  private static opticGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.6,
    roughness: 0.05,
    metalness: 0.9,
    transmission: 0.85
  });
  private static reticleMat = new THREE.MeshBasicMaterial({ color: 0xff1833 });
  private static skinMat = new THREE.MeshStandardMaterial({ color: 0xd69c79, roughness: 0.7 });
  private static balaclavaMat = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.85 });
  private static helmetMat = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.4, metalness: 0.35 });
  private static nvgLensMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

  /**
   * Creates an authentic modern tactical firearm with crisp geometry,
   * two-tone finishes, Picatinny/M-LOK rails, optics, and magazine.
   */
  public static createTacticalWeapon(weaponType: string = 'ar', isFirstPerson: boolean = false): THREE.Group {
    const gun = new THREE.Group();
    const s = isFirstPerson ? 1.0 : 1.15; // Prominent scale in third-person so weapons are clearly visible!

    const fdeMat = ModelFactory.gunTanMat;
    const steelMat = ModelFactory.gunSteelMat;
    const polymerMat = ModelFactory.gunPolymerMat;
    const receiverMat = ModelFactory.gunReceiverMat;
    const glassMat = ModelFactory.opticGlassMat;
    const reticleMat = ModelFactory.reticleMat;

    if (weaponType === 'l85a2') {
      // L85A2 - British Bullpup (Mag behind grip)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.1 * s, 0.44 * s), fdeMat);
      body.position.set(0, 0.02 * s, 0);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.13 * s, 0.06 * s), polymerMat);
      grip.position.set(0, -0.07 * s, -0.08 * s);
      grip.rotation.x = -0.28;
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.18 * s, 0.08 * s), polymerMat);
      mag.position.set(0, -0.09 * s, 0.12 * s); // magazine behind grip
      mag.rotation.x = 0.15;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.28 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03 * s, -0.32 * s);
      const scopeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.05 * s, 0.26 * s), steelMat);
      scopeHandle.position.set(0, 0.085 * s, -0.02 * s);
      gun.add(body, grip, mag, barrel, scopeHandle);
    } 
    else if (weaponType === 'ak12') {
      // AK-12 - Russian tactical rifle (curved magazine, black ribbed polymer)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.085 * s, 0.36 * s), receiverMat);
      body.position.set(0, 0.02 * s, 0);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.08 * s);
      grip.rotation.x = -0.35;
      const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.22 * s, 0.07 * s), polymerMat);
      curvedMag.position.set(0, -0.11 * s, -0.08 * s);
      curvedMag.rotation.x = 0.35; // curved magazine in front of grip
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055 * s, 0.06 * s, 0.22 * s), polymerMat);
      handguard.position.set(0, 0.01 * s, -0.25 * s);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.25 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02 * s, -0.42 * s);
      gun.add(body, grip, curvedMag, handguard, barrel);
    } 
    else if (weaponType === 'f2') {
      // FAMAS F2 - French Bullpup (Huge top carrying handle)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.11 * s, 0.4 * s), receiverMat);
      body.position.set(0, 0.01 * s, 0);
      const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.08 * s, 0.36 * s), polymerMat);
      carryHandle.position.set(0, 0.09 * s, -0.02 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.12 * s, 0.055 * s), polymerMat);
      grip.position.set(0, -0.07 * s, -0.05 * s);
      grip.rotation.x = -0.25;
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.16 * s, 0.07 * s), polymerMat);
      mag.position.set(0, -0.08 * s, 0.1 * s); // bullpup magazine
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.18 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.015 * s, -0.26 * s);
      gun.add(body, carryHandle, grip, mag, barrel);
    }
    else if (weaponType === 'sc3000k') {
      // SC3000K - Futuristic Splinter Cell Rifle (integrated suppressor & olive green)
      const oliveMat = new THREE.MeshStandardMaterial({ color: 0x334435, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.095 * s, 0.34 * s), oliveMat);
      body.position.set(0, 0.02 * s, 0);
      const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 0.28 * s, 8), receiverMat);
      suppressor.rotation.x = Math.PI / 2;
      suppressor.position.set(0, 0.02 * s, -0.32 * s);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.15 * s, 0.06 * s), polymerMat);
      mag.position.set(0, -0.08 * s, -0.05 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.08 * s);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.12 * s, 8), receiverMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.08 * s, -0.04 * s);
      gun.add(body, suppressor, mag, grip, scope);
    }
    else if (weaponType === 'm4' || weaponType === 'carbine416' || weaponType === 'ar') {
      // M4 & Carbine416 / Standard AR
      const colorMat = weaponType === 'm4' ? fdeMat : receiverMat;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.08 * s, 0.32 * s), colorMat);
      body.position.set(0, 0.02 * s, 0);
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.058 * s, 0.065 * s, 0.24 * s), polymerMat);
      handguard.position.set(0, 0.015 * s, -0.25 * s);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.24 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02 * s, -0.42 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.06 * s);
      grip.rotation.x = -0.3;
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.034 * s, 0.16 * s, 0.06 * s), polymerMat);
      mag.position.set(0, -0.09 * s, -0.06 * s);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.036 * s, 0.08 * s, 0.2 * s), polymerMat);
      stock.position.set(0, -0.01 * s, 0.24 * s);
      const optic = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.05 * s, 0.08 * s), receiverMat);
      optic.position.set(0, 0.065 * s, -0.05 * s);
      gun.add(body, handguard, barrel, grip, mag, stock, optic);
    }
    else if (weaponType === 'mp5' || weaponType === 'mpx' || weaponType === 't5smg' || weaponType === 'scorpion' || weaponType === 'smg') {
      // SUBMACHINE GUNS
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.08 * s, 0.28 * s), receiverMat);
      body.position.set(0, 0.015 * s, 0);
      const thinBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.16 * s, 8), steelMat);
      thinBarrel.rotation.x = Math.PI / 2;
      thinBarrel.position.set(0, 0.015 * s, -0.22 * s);
      const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.18 * s, 0.05 * s), polymerMat);
      curvedMag.position.set(0, -0.09 * s, -0.04 * s);
      curvedMag.rotation.x = 0.22;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.12 * s, 0.045 * s), polymerMat);
      grip.position.set(0, -0.065 * s, 0.06 * s);
      grip.rotation.x = -0.32;
      const retractingStock = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.07 * s, 0.18 * s), polymerMat);
      retractingStock.position.set(0, -0.01 * s, 0.22 * s);
      const optic = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.045 * s, 0.07 * s), receiverMat);
      optic.position.set(0, 0.06 * s, -0.04 * s);
      gun.add(body, thinBarrel, curvedMag, grip, retractingStock, optic);
    }
    else if (weaponType === 'dmr417' || weaponType === 'csrx300' || weaponType === 'bosg') {
      // DMR / SNIPER RIFLES (Incredibly long precision barrels & sniper optics)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.09 * s, 0.42 * s), receiverMat);
      body.position.set(0, 0.02 * s, 0);
      const longPrecisionBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.55 * s, 8), steelMat);
      longPrecisionBarrel.rotation.x = Math.PI / 2;
      longPrecisionBarrel.position.set(0, 0.02 * s, -0.48 * s);
      const massiveScope = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.012 * s, 0.24 * s, 8), polymerMat);
      massiveScope.rotation.x = Math.PI / 2;
      massiveScope.position.set(0, 0.08 * s, -0.05 * s);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.1 * s, 0.24 * s), polymerMat);
      stock.position.set(0, -0.015 * s, 0.32 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.13 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.08 * s);
      const shortMag = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.12 * s, 0.05 * s), polymerMat);
      shortMag.position.set(0, -0.075 * s, -0.06 * s);
      gun.add(body, longPrecisionBarrel, massiveScope, stock, grip, shortMag);
    }
    else if (weaponType === 'alda' || weaponType === 'p641') {
      // LIGHT MACHINE GUNS (LMGs - massive ammunition boxes & long cooling vents)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.11 * s, 0.44 * s), receiverMat);
      body.position.set(0, 0.03 * s, 0);
      const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.48 * s, 8), steelMat);
      heavyBarrel.rotation.x = Math.PI / 2;
      heavyBarrel.position.set(0, 0.03 * s, -0.46 * s);
      const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.16 * s, 0.14 * s), polymerMat); // large ammo container
      ammoBox.position.set(0.02 * s, -0.11 * s, -0.04 * s);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.12 * s, 0.22 * s), polymerMat);
      stock.position.set(0, 0, 0.32 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.06 * s, 0.1 * s);
      gun.add(body, heavyBarrel, ammoBox, stock, grip);
    }
    else if (weaponType === 'm590a1' || weaponType === 'sgcqb' || weaponType === 'shotgun') {
      // SHOTGUNS
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.09 * s, 0.36 * s), receiverMat);
      body.position.set(0, 0.01 * s, 0);
      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.44 * s, 8), steelMat);
      magTube.rotation.x = Math.PI / 2;
      magTube.position.set(0, -0.02 * s, -0.32 * s);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.48 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025 * s, -0.34 * s);
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * s, 0.028 * s, 0.18 * s, 8), polymerMat);
      pump.rotation.x = Math.PI / 2;
      pump.position.set(0, -0.02 * s, -0.24 * s);
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.015 * s, 0.05 * s, 0.15 * s), polymerMat);
      saddle.position.set(0.04 * s, 0.01 * s, -0.02 * s);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.11 * s, 0.28 * s), polymerMat);
      stock.position.set(0, -0.03 * s, 0.28 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.09 * s, 0.08 * s);
      gun.add(body, magTube, barrel, pump, saddle, stock, grip);
    } 
    else if (weaponType === 'hammer') {
      // Breaching Hammer
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 0.85 * s, 10), polymerMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0, 0.1 * s);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.16 * s, 0.28 * s), receiverMat);
      head.position.set(0, 0.08 * s, -0.32 * s);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.17 * s, 0.04 * s), steelMat);
      face.position.set(0, 0.08 * s, -0.47 * s);
      gun.add(handle, head, face);
    } 
    else if (weaponType === 'shield') {
      // Ballistic Shield
      const shieldBody = new THREE.Mesh(new THREE.BoxGeometry(0.68 * s, 1.0 * s, 0.08 * s), receiverMat);
      shieldBody.position.set(0, 0, -0.15 * s);
      const frameBezel = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.28 * s, 0.1 * s), steelMat);
      frameBezel.position.set(0, 0.28 * s, -0.15 * s);
      const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.22 * s, 0.06 * s), glassMat);
      windowGlass.position.set(0, 0.28 * s, -0.15 * s);
      const strobeArray = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.06 * s, 0.04 * s), new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.9 }));
      strobeArray.position.set(0, -0.38 * s, -0.11 * s);
      const shieldHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.42 * s, 10), steelMat);
      shieldHandle.rotation.x = Math.PI / 2;
      shieldHandle.position.set(0, 0, 0.06 * s);
      gun.add(shieldBody, frameBezel, windowGlass, strobeArray, shieldHandle);
    } 
    else if (weaponType === 'smg11') {
      // SMG-11 - Compact Machine Pistol (magazine is in handgrip)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.06 * s, 0.18 * s), receiverMat);
      body.position.set(0, 0.02 * s, 0);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009 * s, 0.009 * s, 0.08 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02 * s, -0.12 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.12 * s, 0.042 * s), polymerMat);
      grip.position.set(0, -0.06 * s, 0.02 * s);
      const extendedMag = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.15 * s, 0.036 * s), polymerMat);
      extendedMag.position.set(0, -0.12 * s, 0.02 * s); // extends far below grip
      gun.add(body, barrel, grip, extendedMag);
    }
    else if (weaponType === 'mag44') {
      // MAG-44 Scoped Magnum Revolver (silver chrome with scope)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.05 * s, 0.16 * s), steelMat); // chrome body
      body.position.set(0, 0.01 * s, -0.02 * s);
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.07 * s, 8), steelMat); // drum cylinder
      cylinder.rotation.x = Math.PI / 2;
      cylinder.position.set(0, 0, -0.04 * s);
      const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.18 * s, 8), steelMat);
      longBarrel.rotation.x = Math.PI / 2;
      longBarrel.position.set(0, 0.01 * s, -0.16 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.09 * s, 0.04 * s), new THREE.MeshStandardMaterial({ color: 0x543118, roughness: 0.8 })); // redwood grip
      grip.rotation.x = -0.28;
      grip.position.set(0, -0.05 * s, 0.03 * s);
      const tacticalScope = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.12 * s, 8), receiverMat);
      tacticalScope.rotation.x = Math.PI / 2;
      tacticalScope.position.set(0, 0.04 * s, -0.04 * s);
      gun.add(body, cylinder, longBarrel, grip, tacticalScope);
    }
    else {
      // Fallback Sidearm (tactical pistol P9 / default)
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.045 * s, 0.16 * s), steelMat);
      slide.position.set(0, 0.01 * s, -0.02 * s);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.045 * s, 0.15 * s), receiverMat);
      frame.position.set(0, -0.02 * s, -0.01 * s);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032 * s, 0.09 * s, 0.04 * s), polymerMat);
      grip.position.set(0, -0.06 * s, 0.03 * s);
      grip.rotation.x = -0.28;
      const torch = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.022 * s, 0.06 * s), receiverMat);
      torch.position.set(0, -0.04 * s, -0.06 * s);
      gun.add(slide, frame, grip, torch);
    }

    gun.traverse(c => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    return gun;
  }

  /**
   * Creates a fully rigged, high-fidelity human operator:
   * Anatomical head, balaclava, quad-tube panoramic NVGs, FAST helmet with Velcro,
   * Crye JPC plate carrier with MOLLE pouches, radio, combat belt, arms properly grasping
   * the weapon facing forward +Z, Crye G3 pants with kneepads, and combat boots.
   */
  public static createHumanoidOperator(side: 'atk' | 'def', accentColor: number, weaponType: string = 'ar'): {
    root: THREE.Group;
    torsoGroup: THREE.Group;
    headGroup: THREE.Group;
    armsGroup: THREE.Group;
    weaponGroup: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    hitMesh: THREE.Mesh;
    muzzlePoint: THREE.Object3D;
  } {
    const root = new THREE.Group();

    // Procedural Camo & Tactical Materials
    const camoTex = ProceduralTextures.createCamoTexture(side);
    const uniformMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.72,
      metalness: 0.15
    });
    const vestMat = new THREE.MeshStandardMaterial({
      color: side === 'atk' ? 0x222a28 : 0x242d38,
      roughness: 0.65,
      metalness: 0.25
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.5
    });

    // 1. Torso & Heavy Modular Plate Carrier
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.95, 0);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26), uniformMat);
    chest.position.set(0, 0.15, 0);
    chest.castShadow = true;

    // Ceramic SAPI Armor Plates (Front & Back)
    const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.09), vestMat);
    plateFront.position.set(0, 0.16, 0.13);
    plateFront.castShadow = true;

    const plateBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.09), vestMat);
    plateBack.position.set(0, 0.16, -0.13);
    plateBack.castShadow = true;

    // 3 STANAG Rifle Magazine Pouches on chest
    for (let i = -1; i <= 1; i++) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.075), vestMat);
      pouch.position.set(i * 0.105, 0.1, 0.19);
      torsoGroup.add(pouch);
    }

    // Team Armband on shoulders (High visual identification)
    const armBandMat = new THREE.MeshBasicMaterial({ color: side === 'atk' ? 0x00ff88 : 0x00aaff });
    const armBandL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), armBandMat);
    armBandL.position.set(-0.25, 0.32, 0);
    const armBandR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), armBandMat);
    armBandR.position.set(0.25, 0.32, 0);
    torsoGroup.add(armBandL, armBandR);

    // Operator Ident Patch on Chest
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.02), accentMat);
    badge.position.set(0, 0.31, 0.18);
    torsoGroup.add(badge);

    // Combat Radio & Whip Antenna
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.06), this.gunPolymerMat);
    radio.position.set(-0.15, 0.28, -0.16);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 6), this.gunPolymerMat);
    antenna.position.set(-0.15, 0.46, -0.16);
    antenna.rotation.z = -0.15;
    torsoGroup.add(radio, antenna);

    // Tactical Assault Backpack on Back Plate
    const assaultPack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.36, 0.14), vestMat);
    assaultPack.position.set(0, 0.18, -0.22);
    assaultPack.castShadow = true;
    torsoGroup.add(assaultPack);

    // Combat Application Tourniquet (CAT) on Upper Chest
    const tqMat = new THREE.MeshBasicMaterial({ color: 0xcc2200 });
    const tourniquet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.025), tqMat);
    tourniquet.position.set(0.12, 0.26, 0.185);
    torsoGroup.add(tourniquet);

    // Stun / Smoke Grenades on Duty Belt
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x3d4a3e, metalness: 0.8, roughness: 0.3 });
    for (let g = 0; g < 2; g++) {
      const grenade = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.11, 8), grenadeMat);
      grenade.position.set(-0.18 - g * 0.05, -0.12, 0.12);
      torsoGroup.add(grenade);
    }

    // Tactical Duty Belt with Holster & Pouch
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.28), this.gunPolymerMat);
    belt.position.set(0, -0.12, 0);
    torsoGroup.add(chest, plateFront, plateBack, belt);

    // Invisible Hit Mesh for raycast bullet registration
    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 1.8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.set(0, 0.9, 0);
    root.add(hitMesh);

    // 2. Head with FAST Ballistic Helmet, Quad-Tube Panoramic NVGs, Balaclava & Headset
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.42, 0);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 10), this.balaclavaMat);
    neck.position.set(0, 0, 0);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 14), this.balaclavaMat);
    head.position.set(0, 0.13, 0);

    const eyeBand = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.06), this.skinMat);
    eyeBand.position.set(0, 0.14, 0.13);

    // Ballistic FAST Helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.65), this.helmetMat);
    helmet.position.set(0, 0.15, -0.01);
    helmet.castShadow = true;

    // GPNVG-18 Quad-Tube Night Vision Goggles (4 panoramic tubes with glowing lenses)
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.08), this.gunReceiverMat);
    nvgMount.position.set(0, 0.23, 0.15);
    headGroup.add(nvgMount);

    for (let tube = 0; tube < 4; tube++) {
      const angle = (tube - 1.5) * 0.18;
      const tx = (tube - 1.5) * 0.045;
      const nvgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 10), this.gunPolymerMat);
      nvgTube.rotation.set(Math.PI / 2, 0, angle);
      nvgTube.position.set(tx, 0.22, 0.21);

      const nvgLens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), this.nvgLensMat);
      nvgLens.position.set(tx, 0.22, 0.272);
      headGroup.add(nvgTube, nvgLens);
    }

    // Tactical Headset
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), this.gunPolymerMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.175, 0.13, 0);
    const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), this.gunPolymerMat);
    earR.rotation.z = Math.PI / 2;
    earR.position.set(0.175, 0.13, 0);
    const boomMic = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 6), this.gunPolymerMat);
    boomMic.rotation.x = Math.PI / 3;
    boomMic.position.set(-0.15, 0.08, 0.1);

    headGroup.add(neck, head, eyeBand, helmet, earL, earR, boomMic);
    torsoGroup.add(headGroup);

    // 3. Arms & Tactical Combat Gloves Holding Weapon
    const armsGroup = new THREE.Group();
    armsGroup.position.set(0, 0.28, 0);

    // Right Arm (Pistol Grip / Trigger Hand)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.24, 0, 0);
    const rUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.062, 0.32, 8), uniformMat);
    rUpper.position.set(0, -0.12, 0.06);
    rUpper.rotation.set(0.5, 0, -0.18);

    const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.3, 8), uniformMat);
    rForearm.position.set(-0.06, -0.24, 0.26);
    rForearm.rotation.set(1.18, -0.25, 0);

    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.1), this.gunPolymerMat);
    rGlove.position.set(-0.1, -0.26, 0.4);
    rightArmGroup.add(rUpper, rForearm, rGlove);

    // Left Arm (Support Hand on Foregrip)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.24, 0, 0);
    const lUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.062, 0.32, 8), uniformMat);
    lUpper.position.set(0.05, -0.12, 0.08);
    lUpper.rotation.set(0.58, 0, 0.36);

    const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.32, 8), uniformMat);
    lForearm.position.set(0.15, -0.22, 0.34);
    lForearm.rotation.set(1.32, 0.6, 0);

    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.1), this.gunPolymerMat);
    lGlove.position.set(0.2, -0.21, 0.48);
    leftArmGroup.add(lUpper, lForearm, lGlove);

    // Tactical Weapon Held Prominently in Hands (Facing Forward +Z)
    const weaponGroup = new THREE.Group();
    const gunMesh = this.createTacticalWeapon(weaponType, false);
    // Weapon in ModelFactory points towards -Z, so rotating by Math.PI points it forward towards +Z!
    gunMesh.rotation.y = Math.PI;
    gunMesh.position.set(0.08, -0.12, 0.36);
    weaponGroup.add(gunMesh);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0.08, -0.1, 1.15);
    weaponGroup.add(muzzlePoint);

    armsGroup.add(rightArmGroup, leftArmGroup, weaponGroup);
    torsoGroup.add(armsGroup);

    // 4. Legs with Crye Precision Combat Pants & Treaded Boots
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.13, 0.52, 0);

    const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 8), uniformMat);
    lThigh.position.set(0, -0.12, 0);

    const lKnee = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.07), vestMat);
    lKnee.position.set(0, -0.3, 0.07);

    const lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.46, 8), uniformMat);
    lShin.position.set(0, -0.45, 0);

    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.25), this.gunPolymerMat);
    lBoot.position.set(0, -0.65, 0.04);
    leftLeg.add(lThigh, lKnee, lShin, lBoot);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.13, 0.52, 0);

    const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 8), uniformMat);
    rThigh.position.set(0, -0.12, 0);

    // Safariland Drop-Leg Holster with Backup Pistol on Right Thigh
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.12), this.gunPolymerMat);
    holster.position.set(0.1, -0.14, 0);
    const sidearm = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.1, 0.07), this.gunSteelMat);
    sidearm.position.set(0.1, -0.04, 0.03);
    sidearm.rotation.x = -0.35;
    rightLeg.add(holster, sidearm);

    const rKnee = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.07), vestMat);
    rKnee.position.set(0, -0.3, 0.07);

    const rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.46, 8), uniformMat);
    rShin.position.set(0, -0.45, 0);

    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.25), this.gunPolymerMat);
    rBoot.position.set(0, -0.65, 0.04);
    rightLeg.add(rThigh, rKnee, rShin, rBoot);

    root.add(torsoGroup, leftLeg, rightLeg);

    root.traverse(c => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    return { root, torsoGroup, headGroup, armsGroup, weaponGroup, leftLeg, rightLeg, hitMesh, muzzlePoint };
  }

  /**
   * First Person Viewmodel Rig with detailed combat sleeves, knuckles, and weapon
   */
  public static createFirstPersonRig(weaponType: string = 'ar'): {
    root: THREE.Group;
    weaponGroup: THREE.Group;
    flashSprite: THREE.Sprite;
    barrelTip: THREE.Object3D;
  } {
    const root = new THREE.Group();

    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x222a30, roughness: 0.8 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.7, metalness: 0.2 });

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.36, 10), uniformMat);
    rightForearm.position.set(0.18, -0.26, -0.15);
    rightForearm.rotation.set(1.2, -0.15, -0.3);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.065, 0.11), gloveMat);
    rightHand.position.set(0.14, -0.22, -0.28);
    rightHand.rotation.set(0.3, -0.1, -0.2);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.44, 10), uniformMat);
    leftForearm.position.set(-0.16, -0.3, -0.22);
    leftForearm.rotation.set(1.15, 0.5, 0.4);

    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.065, 0.11), gloveMat);
    leftHand.position.set(-0.06, -0.24, -0.42);
    leftHand.rotation.set(0.4, 0.3, 0.3);

    // Carbon-fiber Knuckle Protectors & Tactical Watch
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, metalness: 0.9 });
    const rKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.04), carbonMat);
    rKnuckles.position.set(0, 0.035, 0.01);
    rightHand.add(rKnuckles);

    const lKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.04), carbonMat);
    lKnuckles.position.set(0, 0.035, 0.01);
    leftHand.add(lKnuckles);

    // Tactical Operator Watch on Left Wrist
    const watchGroup = new THREE.Group();
    watchGroup.position.set(0, 0.12, 0);
    const watchStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 10), carbonMat);
    const watchDial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 10), carbonMat);
    watchDial.position.set(0, 0, 0.048);
    watchDial.rotation.x = Math.PI / 2;
    const watchScreen = new THREE.Mesh(new THREE.CircleGeometry(0.014, 8), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    watchScreen.position.set(0, 0, 0.054);
    watchGroup.add(watchStrap, watchDial, watchScreen);
    leftForearm.add(watchGroup);

    const weaponGroup = new THREE.Group();
    const gun = this.createTacticalWeapon(weaponType, true);
    gun.position.set(0.14, -0.15, -0.42);
    gun.rotation.set(0.02, -0.04, 0);
    weaponGroup.add(gun);

    const barrelTip = new THREE.Object3D();
    barrelTip.position.set(0.14, -0.13, -0.96);
    weaponGroup.add(barrelTip);

    // Muzzle Flash
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,220,1)');
      grd.addColorStop(0.3, 'rgba(255,190,70,0.9)');
      grd.addColorStop(1, 'rgba(255,110,20,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 64, 64);
    }
    const flashTex = new THREE.CanvasTexture(c);
    const flashMat = new THREE.SpriteMaterial({
      map: flashTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false
    });
    const flashSprite = new THREE.Sprite(flashMat);
    flashSprite.scale.set(0.48, 0.48, 1);
    flashSprite.position.set(0.14, -0.13, -0.98);
    weaponGroup.add(flashSprite);

    root.add(rightForearm, rightHand, leftForearm, leftHand, weaponGroup);
    return { root, weaponGroup, flashSprite, barrelTip };
  }

  /**
   * Hand-held gadget rig, used in place of the weapon rig while a throwable/placeable
   * gadget is being held (e.g. holding [G] to place a Valkyrie/Maestro camera). Reuses
   * the same forearm/hand/watch setup as the weapon rig so the arms don't visibly jump
   * when swapping between the two, but the right hand carries a small gadget model
   * instead of a rifle.
   */
  public static createGadgetViewRig(kind: 'camera' = 'camera'): {
    root: THREE.Group;
    gadgetGroup: THREE.Group;
  } {
    const root = new THREE.Group();

    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x222a30, roughness: 0.8 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.7, metalness: 0.2 });

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.36, 10), uniformMat);
    rightForearm.position.set(0.16, -0.28, -0.22);
    rightForearm.rotation.set(1.35, -0.1, -0.2);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.065, 0.11), gloveMat);
    rightHand.position.set(0.13, -0.22, -0.36);
    rightHand.rotation.set(0.5, -0.05, -0.1);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.04, 0.3, 10), uniformMat);
    leftForearm.position.set(0.07, -0.3, -0.32);
    leftForearm.rotation.set(1.4, 0.25, -0.1);

    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.1), gloveMat);
    leftHand.position.set(0.1, -0.24, -0.42);
    leftHand.rotation.set(0.45, 0.15, 0);

    const gadgetGroup = new THREE.Group();
    gadgetGroup.position.set(0.12, -0.17, -0.44);

    // Small black-eye-style device: dark dome body, a glowing lens, and two thin legs
    // — a compact stand-in for whichever camera type the operator actually places.
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.4, metalness: 0.6 });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5, metalness: 0.5 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), bodyMat);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.05);
    gadgetGroup.add(body, lens);

    for (const lx of [-0.035, 0.035]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), legMat);
      leg.position.set(lx, -0.045, 0.02);
      leg.rotation.z = lx < 0 ? 0.4 : -0.4;
      gadgetGroup.add(leg);
    }

    root.add(rightForearm, rightHand, leftForearm, leftHand, gadgetGroup);
    return { root, gadgetGroup };
  }

  /**
   * High-Fidelity Tactical Defuser Case
   * Pelican briefcase with digital countdown LED, motherboard, keypads, and blinking beacon
   */
  public static createDefuserCase(): {
    root: THREE.Group;
    beaconLight: THREE.PointLight;
    screenMesh: THREE.Mesh;
  } {
    const root = new THREE.Group();

    // Pelican Hard Case Shell (Tactical Orange/Yellow)
    const caseMat = new THREE.MeshStandardMaterial({
      color: 0xcc7700,
      roughness: 0.45,
      metalness: 0.3
    });
    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x161a1d,
      roughness: 0.85
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x333b42,
      roughness: 0.35,
      metalness: 0.8
    });

    // Lower Tray
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.38), caseMat);
    tray.position.set(0, 0.06, 0);
    tray.castShadow = true;
    tray.receiveShadow = true;
    root.add(tray);

    // Inner Electronics Chassis
    const innerChassis = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.34), interiorMat);
    innerChassis.position.set(0, 0.11, 0);
    root.add(innerChassis);

    // Open Propped Hinged Lid
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.38), caseMat);
    lid.position.set(0, 0.22, -0.16);
    lid.rotation.x = -Math.PI / 3;
    lid.castShadow = true;
    root.add(lid);

    // Digital LED Countdown Screen
    const screenGeo = new THREE.PlaneGeometry(0.18, 0.08);
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 128;
    screenCanvas.height = 64;
    const sctx = screenCanvas.getContext('2d');
    if (sctx) {
      sctx.fillStyle = '#051008';
      sctx.fillRect(0, 0, 128, 64);
      sctx.fillStyle = '#00ff66';
      sctx.font = 'bold 26px monospace';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillText('ACTIVE', 64, 32);
    }
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.rotation.x = -Math.PI / 2;
    screenMesh.position.set(-0.1, 0.132, 0);
    root.add(screenMesh);

    // Dual Rubber Keypads
    for (let k = 0; k < 2; k++) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.08), metalMat);
      pad.position.set(0.12, 0.13, -0.06 + k * 0.12);
      root.add(pad);
    }

    // Radio Link Stalk Antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 6), metalMat);
    antenna.position.set(0.21, 0.26, -0.12);
    antenna.rotation.z = 0.15;
    root.add(antenna);

    // Tactical Pulsing LED Beacon
    const beaconGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(-0.21, 0.14, -0.12);
    root.add(beaconMesh);

    const beaconLight = new THREE.PointLight(0x00ff88, 1.5, 3.5);
    beaconLight.position.set(-0.21, 0.16, -0.12);
    root.add(beaconLight);

    return { root, beaconLight, screenMesh };
  }
}
