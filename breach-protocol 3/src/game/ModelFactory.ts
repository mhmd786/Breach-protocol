import * as THREE from 'three';
import { ProceduralTextures } from './TextureFactory';
import { WeaponSkin, SkinManager } from './SkinShopData';

/**
 * ModelFactory: Generates ultra-detailed, AAA-grade tactical humanoid operators and authentic firearms.
 * Features:
 * - Precision Picatinny / M-LOK rail geometry with individual notches
 * - Realistic EOTech holographic optics with anti-reflective glass & illuminated reticle
 * - PEQ-15 tactical laser illuminator modules
 * - Slotted compensators, multi-baffle muzzle brakes, and knurled suppressors
 * - Magpul PMAGs with waffle rib textures & ranger plates
 * - FAST high-cut ballistic helmets with ARC accessory rails, Wilcox NVG mounts, and rear battery counterweights
 * - Quad-tube GPNVG-18 panoramic night vision with glowing ocular lenses
 * - Crye JPC 2.0 plate carriers with skeletal cummerbunds, PTT radio units, hydration tubes & CAT tourniquets
 * - Mechanix tactical combat gloves with rubberized knuckle plates & wrist cinch straps
 * - AirFlex integrated knee pad shells and sculpted combat boots
 */
export class ModelFactory {
  // Shared PBR tactical materials
  private static gunReceiverMat = new THREE.MeshStandardMaterial({
    color: 0x202428,
    roughness: 0.32,
    metalness: 0.88
  });
  private static gunSteelMat = new THREE.MeshStandardMaterial({
    color: 0x58606b,
    roughness: 0.22,
    metalness: 0.95
  });
  private static gunPolymerMat = new THREE.MeshStandardMaterial({
    color: 0x14171a,
    roughness: 0.78,
    metalness: 0.18
  });
  private static gunTanMat = new THREE.MeshStandardMaterial({
    color: 0x6e624f, // Flat Dark Earth (FDE)
    roughness: 0.65,
    metalness: 0.22
  });
  private static opticGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.55,
    roughness: 0.04,
    metalness: 0.92,
    transmission: 0.88,
    ior: 1.5
  });
  private static ballisticShieldGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa5f3fc,
    transparent: true,
    opacity: 0.16,
    roughness: 0.03,
    metalness: 0.02,
    transmission: 0.96,
    ior: 1.45,
    depthWrite: false
  });
  private static reticleMat = new THREE.MeshBasicMaterial({ color: 0xff1b35 });
  private static brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.18,
    metalness: 0.96
  });
  private static skinMat = new THREE.MeshStandardMaterial({ color: 0xd69c79, roughness: 0.72 });
  private static balaclavaMat = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.88 });
  private static helmetMat = new THREE.MeshStandardMaterial({ color: 0x282e34, roughness: 0.42, metalness: 0.38 });
  private static nvgLensMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
  private static railMat = new THREE.MeshStandardMaterial({ color: 0x191c1f, roughness: 0.35, metalness: 0.85 });

  private static getMaterialsForSkin(skin?: WeaponSkin) {
    if (!skin || skin.id === 'default') {
      return {
        fdeMat: ModelFactory.gunTanMat,
        steelMat: ModelFactory.gunSteelMat,
        polymerMat: ModelFactory.gunPolymerMat,
        receiverMat: ModelFactory.gunReceiverMat,
        glassMat: ModelFactory.opticGlassMat,
        reticleMat: ModelFactory.reticleMat,
        brassMat: ModelFactory.brassMat
      };
    }

    const { colors } = skin;
    const isBlackIce = skin.id.includes('black_ice');
    let biVariant: 'blue' | 'green' | 'purple' | 'red' = 'blue';
    if (skin.id.includes('green')) biVariant = 'green';
    else if (skin.id.includes('purple')) biVariant = 'purple';
    else if (skin.id.includes('red')) biVariant = 'red';

    const blackIceTex = isBlackIce ? ProceduralTextures.createBlackIceTexture(biVariant) : undefined;

    const receiverMat = new THREE.MeshStandardMaterial({
      color: isBlackIce ? 0xffffff : colors.primary,
      map: blackIceTex,
      roughness: isBlackIce ? 0.02 : colors.roughness,
      metalness: isBlackIce ? 0.95 : colors.metalness,
      emissive: isBlackIce ? (biVariant === 'green' ? 0x00ff88 : biVariant === 'purple' ? 0xbf5af2 : biVariant === 'red' ? 0xff3b30 : 0x00d4ff) : (colors.emissive || 0x000000),
      emissiveIntensity: isBlackIce ? 0.75 : (colors.emissive ? 0.85 : 0)
    });

    const fdeMat = new THREE.MeshStandardMaterial({
      color: isBlackIce ? 0xffffff : colors.secondary,
      map: blackIceTex,
      roughness: isBlackIce ? 0.04 : Math.min(0.9, colors.roughness + 0.12),
      metalness: isBlackIce ? 0.92 : Math.max(0.1, colors.metalness * 0.72),
      emissive: isBlackIce ? (biVariant === 'green' ? 0x00aa55 : biVariant === 'purple' ? 0x8822aa : biVariant === 'red' ? 0xaa2222 : 0x0088cc) : 0x000000,
      emissiveIntensity: isBlackIce ? 0.45 : 0
    });

    const steelMat = new THREE.MeshStandardMaterial({
      color: isBlackIce ? 0xdff9ff : colors.accent,
      roughness: 0.03,
      metalness: 0.99,
      emissive: isBlackIce ? 0x00e1ff : 0x000000,
      emissiveIntensity: isBlackIce ? 0.85 : 0
    });

    const reticleColor = skin.rarity === 'black_ice' ? 0x00f0ff : (skin.rarity === 'legendary' ? 0xffd700 : 0xff1833);
    const reticleMat = new THREE.MeshBasicMaterial({ color: reticleColor });

    return {
      fdeMat,
      steelMat,
      polymerMat: ModelFactory.gunPolymerMat,
      receiverMat,
      glassMat: ModelFactory.opticGlassMat,
      reticleMat,
      brassMat: ModelFactory.brassMat
    };
  }

  public static createTacticalWeaponWithSkin(weaponType: string = 'ar', skin?: WeaponSkin, isFirstPerson: boolean = false): THREE.Group {
    return this.createTacticalWeapon(weaponType, isFirstPerson, skin);
  }

  /**
   * Builds an authentic Picatinny rail section with individual grooved slots
   */
  private static createPicatinnyRail(length: number, width: number = 0.026, s: number = 1.0): THREE.Group {
    const railGroup = new THREE.Group();
    const baseHeight = 0.009 * s;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width * s, baseHeight, length * s),
      this.railMat
    );
    railGroup.add(base);

    // Individual rail recoil ribs
    const slotCount = Math.floor(length / 0.016);
    const ribGeo = new THREE.BoxGeometry(width * s * 1.05, 0.004 * s, 0.007 * s);
    for (let i = 0; i < slotCount; i++) {
      const z = -((length * s) / 2) + 0.008 * s + i * (0.016 * s);
      const rib = new THREE.Mesh(ribGeo, this.railMat);
      rib.position.set(0, baseHeight / 2 + 0.002 * s, z);
      railGroup.add(rib);
    }
    return railGroup;
  }

  /**
   * Builds an authentic EOTech XPS3 holographic optical sight
   */
  private static createHolographicSight(s: number = 1.0, reticleMat: THREE.Material): THREE.Group {
    const sight = new THREE.Group();

    // Sight base mount with cross-bolt clamp
    const mount = new THREE.Mesh(
      new THREE.BoxGeometry(0.04 * s, 0.014 * s, 0.09 * s),
      this.gunPolymerMat
    );
    mount.position.set(0, 0.007 * s, 0);

    const clampBolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.046 * s, 8),
      this.gunSteelMat
    );
    clampBolt.rotation.z = Math.PI / 2;
    clampBolt.position.set(0, 0.007 * s, 0.015 * s);

    // Protective aluminum outer hood
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.048 * s, 0.045 * s, 0.08 * s),
      this.gunReceiverMat
    );
    hood.position.set(0, 0.034 * s, 0);

    // Optical sight window cut-out
    const innerGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.034 * s, 0.032 * s, 0.004 * s),
      this.opticGlassMat
    );
    innerGlass.position.set(0, 0.034 * s, 0);

    // Illuminated holographic reticle (68 MOA circle with 1 MOA center dot)
    const reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.007 * s, 0.0085 * s, 16),
      reticleMat
    );
    reticleRing.position.set(0, 0.034 * s, 0.003 * s);

    const reticleDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.0022 * s, 8),
      reticleMat
    );
    reticleDot.position.set(0, 0.034 * s, 0.0032 * s);

    // Battery compartment cylinder on right side
    const batteryTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0075 * s, 0.0075 * s, 0.065 * s, 8),
      this.gunPolymerMat
    );
    batteryTube.rotation.x = Math.PI / 2;
    batteryTube.position.set(0.027 * s, 0.02 * s, 0.005 * s);

    sight.add(mount, clampBolt, hood, innerGlass, reticleRing, reticleDot, batteryTube);
    return sight;
  }

  /**
   * Builds an authentic PEQ-15 tactical laser illuminator module
   */
  private static createPeqModule(s: number = 1.0): THREE.Group {
    const peq = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.034 * s, 0.022 * s, 0.075 * s),
      this.gunTanMat
    );
    box.position.set(0, 0.011 * s, 0);

    // Dual laser apertures (Visible red laser + IR illuminator)
    const irAperture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045 * s, 0.0045 * s, 0.008 * s, 8),
      this.gunSteelMat
    );
    irAperture.rotation.x = Math.PI / 2;
    irAperture.position.set(-0.008 * s, 0.011 * s, -0.04 * s);

    const visAperture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003 * s, 0.003 * s, 0.008 * s, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0033 })
    );
    visAperture.rotation.x = Math.PI / 2;
    visAperture.position.set(0.008 * s, 0.011 * s, -0.04 * s);

    // Rotary selector switch
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.005 * s, 8),
      this.gunPolymerMat
    );
    dial.position.set(0.006 * s, 0.024 * s, 0.01 * s);

    peq.add(box, irAperture, visAperture, dial);
    return peq;
  }

  /**
   * Builds an authentic slotted compensator / muzzle brake
   */
  private static createMuzzleBrake(radius: number, length: number, s: number = 1.0): THREE.Group {
    const brake = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.15 * s, radius * 1.15 * s, length * s, 10),
      this.gunSteelMat
    );
    brake.add(body);

    // Machined gas dispersion ports
    const portCount = 3;
    for (let p = 0; p < portCount; p++) {
      const port = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 2.4 * s, 0.005 * s, 0.006 * s),
        this.gunPolymerMat
      );
      port.position.set(0, -length * 0.3 * s + p * (length * 0.28 * s), 0);
      brake.add(port);
    }
    return brake;
  }

  /**
   * Creates an authentic modern tactical firearm with crisp geometry,
   * two-tone finishes, Picatinny/M-LOK rails, optics, and magazine.
   */
  public static createTacticalWeapon(weaponType: string = 'ar', isFirstPerson: boolean = false, skin?: WeaponSkin): THREE.Group {
    const gun = new THREE.Group();
    const s = isFirstPerson ? 1.0 : 1.18; // Prominent scale in third-person

    const mats = this.getMaterialsForSkin(skin);
    const { fdeMat, steelMat, polymerMat, receiverMat, reticleMat, brassMat } = mats;

    // Helper: adds an ejection port on the right side with visible chambered brass
    const addEjectionPort = (xPos: number, yPos: number, zPos: number, len: number = 0.07, h: number = 0.022) => {
      const portCavity = new THREE.Mesh(
        new THREE.BoxGeometry(0.006 * s, h * s, len * s),
        polymerMat
      );
      portCavity.position.set(xPos * s, yPos * s, zPos * s);

      const brassRound = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0045 * s, 0.0045 * s, (len * 0.6) * s, 8),
        brassMat
      );
      brassRound.rotation.x = Math.PI / 2;
      brassRound.position.set(xPos * s - 0.002 * s, yPos * s, zPos * s);
      gun.add(portCavity, brassRound);
    };

    // Helper: adds textured magazine ribs (waffle PMAG style)
    const addMagazineRibs = (magMesh: THREE.Mesh, ribCount: number = 4) => {
      for (let r = 0; r < ribCount; r++) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.042 * s, 0.007 * s, 0.068 * s),
          polymerMat
        );
        rib.position.set(0, -0.04 * s + r * 0.03 * s, 0);
        magMesh.add(rib);
      }
    };

    if (weaponType === 'l85a2') {
      // L85A2 - British Bullpup (Mag behind grip)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.1 * s, 0.44 * s), fdeMat);
      body.position.set(0, 0.02 * s, 0);

      const upperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.062 * s, 0.05 * s, 0.42 * s), receiverMat);
      upperReceiver.position.set(0, 0.075 * s, -0.01 * s);

      const topRail = this.createPicatinnyRail(0.24, 0.028, s);
      topRail.position.set(0, 0.105 * s, -0.04 * s);

      const holo = this.createHolographicSight(s * 0.95, reticleMat);
      holo.position.set(0, 0.112 * s, -0.04 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.13 * s, 0.06 * s), polymerMat);
      grip.position.set(0, -0.07 * s, -0.08 * s);
      grip.rotation.x = -0.28;

      const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.02 * s, 0.004 * s, 6, 12, Math.PI), steelMat);
      triggerGuard.position.set(0, -0.045 * s, -0.05 * s);
      triggerGuard.rotation.x = Math.PI;

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.18 * s, 0.08 * s), polymerMat);
      mag.position.set(0, -0.09 * s, 0.13 * s); // magazine behind grip
      mag.rotation.x = 0.14;
      addMagazineRibs(mag, 4);

      // Bullpup buttpad
      const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.055 * s, 0.13 * s, 0.035 * s), polymerMat);
      buttpad.position.set(0, 0.01 * s, 0.23 * s);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.3 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.035 * s, -0.34 * s);

      const brake = this.createMuzzleBrake(0.014, 0.045, s);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(0, 0.035 * s, -0.49 * s);

      addEjectionPort(0.034, 0.04, 0.1, 0.065, 0.022);
      gun.add(body, upperReceiver, topRail, holo, grip, triggerGuard, mag, buttpad, barrel, brake);
    }
    else if (weaponType === 'ak12') {
      // AK-12 - Modern Russian tactical assault rifle
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.085 * s, 0.36 * s), receiverMat);
      body.position.set(0, 0.02 * s, 0);

      const ribbedDustCover = new THREE.Mesh(new THREE.BoxGeometry(0.058 * s, 0.04 * s, 0.28 * s), steelMat);
      ribbedDustCover.position.set(0, 0.07 * s, 0.02 * s);

      const topRail = this.createPicatinnyRail(0.28, 0.026, s);
      topRail.position.set(0, 0.094 * s, -0.04 * s);

      const holo = this.createHolographicSight(s * 0.95, reticleMat);
      holo.position.set(0, 0.102 * s, -0.04 * s);

      const peq = this.createPeqModule(s * 0.85);
      peq.position.set(0, 0.094 * s, -0.22 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.08 * s);
      grip.rotation.x = -0.35;

      const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.22 * s, 0.07 * s), polymerMat);
      curvedMag.position.set(0, -0.11 * s, -0.08 * s);
      curvedMag.rotation.x = 0.35; // curved magazine in front of grip
      addMagazineRibs(curvedMag, 5);

      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.056 * s, 0.065 * s, 0.24 * s), polymerMat);
      handguard.position.set(0, 0.015 * s, -0.26 * s);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.28 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02 * s, -0.44 * s);

      const brake = this.createMuzzleBrake(0.016, 0.05, s);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(0, 0.02 * s, -0.58 * s);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.09 * s, 0.22 * s), polymerMat);
      stock.position.set(0, 0.01 * s, 0.26 * s);

      addEjectionPort(0.032, 0.035, -0.02, 0.06, 0.02);
      gun.add(body, ribbedDustCover, topRail, holo, peq, grip, curvedMag, handguard, barrel, brake, stock);
    }
    else if (weaponType === 'f2') {
      // FAMAS F2 - French Bullpup (High top carrying handle)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.11 * s, 0.4 * s), receiverMat);
      body.position.set(0, 0.01 * s, 0);

      const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.08 * s, 0.36 * s), polymerMat);
      carryHandle.position.set(0, 0.095 * s, -0.02 * s);

      const rail = this.createPicatinnyRail(0.18, 0.025, s);
      rail.position.set(0, 0.14 * s, -0.03 * s);

      const holo = this.createHolographicSight(s * 0.9, reticleMat);
      holo.position.set(0, 0.146 * s, -0.03 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.12 * s, 0.055 * s), polymerMat);
      grip.position.set(0, -0.07 * s, -0.05 * s);
      grip.rotation.x = -0.25;

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.16 * s, 0.07 * s), steelMat);
      mag.position.set(0, -0.08 * s, 0.11 * s);
      addMagazineRibs(mag, 3);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.22 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.015 * s, -0.28 * s);

      const brake = this.createMuzzleBrake(0.014, 0.04, s);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(0, 0.015 * s, -0.4 * s);

      addEjectionPort(0.035, 0.03, 0.08, 0.055, 0.02);
      gun.add(body, carryHandle, rail, holo, grip, mag, barrel, brake);
    }
    else if (weaponType === 'sc3000k') {
      // SC3000K - Futuristic Stealth Rifle (monolithic suppressor & tactical styling)
      const oliveMat = new THREE.MeshStandardMaterial({ color: 0x304032, roughness: 0.55 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.095 * s, 0.36 * s), oliveMat);
      body.position.set(0, 0.02 * s, 0);

      const topRail = this.createPicatinnyRail(0.3, 0.028, s);
      topRail.position.set(0, 0.075 * s, -0.05 * s);

      const holo = this.createHolographicSight(s * 0.95, reticleMat);
      holo.position.set(0, 0.084 * s, -0.05 * s);

      // Heavy Integral Suppressor with heat knurling
      const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.024 * s, 0.024 * s, 0.32 * s, 12), receiverMat);
      suppressor.rotation.x = Math.PI / 2;
      suppressor.position.set(0, 0.02 * s, -0.34 * s);

      for (let k = 0; k < 4; k++) {
        const knurl = new THREE.Mesh(new THREE.TorusGeometry(0.0245 * s, 0.002 * s, 6, 12), steelMat);
        knurl.position.set(0, 0.02 * s, -0.24 * s - k * 0.06 * s);
        gun.add(knurl);
      }

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.16 * s, 0.065 * s), polymerMat);
      mag.position.set(0, -0.085 * s, -0.05 * s);
      addMagazineRibs(mag, 4);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046 * s, 0.12 * s, 0.052 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.08 * s);
      grip.rotation.x = -0.32;

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.085 * s, 0.22 * s), polymerMat);
      stock.position.set(0, 0.01 * s, 0.24 * s);

      addEjectionPort(0.034, 0.03, -0.03, 0.055, 0.022);
      gun.add(body, topRail, holo, suppressor, mag, grip, stock);
    }
    else if (weaponType === 'm4' || weaponType === 'carbine416' || weaponType === 'ar') {
      // M4 / HK416 / Standard AR
      const colorMat = weaponType === 'm4' ? fdeMat : receiverMat;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.07 * s, 0.28 * s), colorMat);
      lower.position.set(0, 0.005 * s, 0.02 * s);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.058 * s, 0.05 * s, 0.3 * s), colorMat);
      upper.position.set(0, 0.055 * s, -0.01 * s);

      const topRail = this.createPicatinnyRail(0.32, 0.026, s);
      topRail.position.set(0, 0.084 * s, -0.06 * s);

      const holo = this.createHolographicSight(s * 0.95, reticleMat);
      holo.position.set(0, 0.092 * s, -0.06 * s);

      const peq = this.createPeqModule(s * 0.85);
      peq.position.set(0, 0.084 * s, -0.22 * s);

      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.056 * s, 0.065 * s, 0.24 * s), polymerMat);
      handguard.position.set(0, 0.02 * s, -0.25 * s);

      // Angled foregrip (AFG) on bottom rail
      const afg = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.045 * s, 0.11 * s), polymerMat);
      afg.position.set(0, -0.028 * s, -0.23 * s);
      afg.rotation.x = -0.3;

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.28 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025 * s, -0.44 * s);

      const brake = this.createMuzzleBrake(0.014, 0.045, s);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(0, 0.025 * s, -0.58 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.07 * s);
      grip.rotation.x = -0.32;

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036 * s, 0.17 * s, 0.068 * s), polymerMat);
      mag.position.set(0, -0.095 * s, -0.06 * s);
      addMagazineRibs(mag, 4);

      // Telescopic SOPMOD crane stock
      const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.2 * s, 8), steelMat);
      bufferTube.rotation.x = Math.PI / 2;
      bufferTube.position.set(0, 0.035 * s, 0.22 * s);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.095 * s, 0.18 * s), polymerMat);
      stock.position.set(0, 0.015 * s, 0.26 * s);

      addEjectionPort(0.032, 0.045, -0.03, 0.065, 0.022);
      gun.add(lower, upper, topRail, holo, peq, handguard, afg, barrel, brake, grip, mag, bufferTube, stock);
    }
    else if (weaponType === 'mp5' || weaponType === 'mpx' || weaponType === 't5smg' || weaponType === 'scorpion' || weaponType === 'smg') {
      // SUBMACHINE GUNS (MP5 / MPX style)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.052 * s, 0.08 * s, 0.28 * s), receiverMat);
      body.position.set(0, 0.02 * s, 0);

      const topRail = this.createPicatinnyRail(0.2, 0.024, s);
      topRail.position.set(0, 0.066 * s, -0.03 * s);

      const holo = this.createHolographicSight(s * 0.88, reticleMat);
      holo.position.set(0, 0.074 * s, -0.03 * s);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * s, 0.011 * s, 0.2 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02 * s, -0.24 * s);

      const triLugBrake = this.createMuzzleBrake(0.012, 0.035, s);
      triLugBrake.rotation.x = Math.PI / 2;
      triLugBrake.position.set(0, 0.02 * s, -0.34 * s);

      // Curved 9mm stick magazine
      const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.028 * s, 0.2 * s, 0.048 * s), steelMat);
      curvedMag.position.set(0, -0.1 * s, -0.05 * s);
      curvedMag.rotation.x = 0.22;

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.12 * s, 0.045 * s), polymerMat);
      grip.position.set(0, -0.065 * s, 0.06 * s);
      grip.rotation.x = -0.32;

      const tropicalHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.065 * s, 0.16 * s), polymerMat);
      tropicalHandguard.position.set(0, 0.005 * s, -0.16 * s);

      // Collapsible twin wire stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.032 * s, 0.07 * s, 0.2 * s), steelMat);
      stock.position.set(0, 0.01 * s, 0.22 * s);

      addEjectionPort(0.028, 0.035, -0.02, 0.045, 0.018);
      gun.add(body, topRail, holo, barrel, triLugBrake, curvedMag, grip, tropicalHandguard, stock);
    }
    else if (weaponType === 'dmr417' || weaponType === 'csrx300' || weaponType === 'bosg') {
      // DMR / SNIPER RIFLES (High magnification sniper scope & long fluted barrel)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.095 * s, 0.44 * s), receiverMat);
      body.position.set(0, 0.025 * s, 0);

      const topRail = this.createPicatinnyRail(0.38, 0.028, s);
      topRail.position.set(0, 0.08 * s, -0.06 * s);

      // Sniper Variable Optic with dual mounting rings and adjustment turrets
      const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.013 * s, 0.28 * s, 10), receiverMat);
      scopeTube.rotation.x = Math.PI / 2;
      scopeTube.position.set(0, 0.12 * s, -0.05 * s);

      const objectiveLens = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.016 * s, 0.06 * s, 10), steelMat);
      objectiveLens.rotation.x = Math.PI / 2;
      objectiveLens.position.set(0, 0.12 * s, -0.19 * s);

      const scopeGlass = new THREE.Mesh(new THREE.CircleGeometry(0.018 * s, 10), this.opticGlassMat);
      scopeGlass.position.set(0, 0.12 * s, -0.221 * s);

      const turretElevation = new THREE.Mesh(new THREE.CylinderGeometry(0.007 * s, 0.007 * s, 0.015 * s, 8), steelMat);
      turretElevation.position.set(0, 0.14 * s, -0.05 * s);

      // Long fluted precision barrel
      const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013 * s, 0.013 * s, 0.6 * s, 8), steelMat);
      longBarrel.rotation.x = Math.PI / 2;
      longBarrel.position.set(0, 0.028 * s, -0.52 * s);

      // Massive multi-chamber muzzle brake
      const bigBrake = this.createMuzzleBrake(0.017, 0.075, s);
      bigBrake.rotation.x = Math.PI / 2;
      bigBrake.position.set(0, 0.028 * s, -0.83 * s);

      // Folded bipod legs
      const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.18 * s, 6), steelMat);
      bipodL.rotation.x = Math.PI / 2;
      bipodL.position.set(-0.025 * s, -0.025 * s, -0.4 * s);

      const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.18 * s, 6), steelMat);
      bipodR.rotation.x = Math.PI / 2;
      bipodR.position.set(0.025 * s, -0.025 * s, -0.4 * s);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.038 * s, 0.11 * s, 0.26 * s), polymerMat);
      stock.position.set(0, -0.005 * s, 0.32 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.13 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.07 * s, 0.09 * s);
      grip.rotation.x = -0.3;

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036 * s, 0.13 * s, 0.06 * s), steelMat);
      mag.position.set(0, -0.08 * s, -0.06 * s);

      addEjectionPort(0.032, 0.04, -0.02, 0.07, 0.024);
      gun.add(body, topRail, scopeTube, objectiveLens, scopeGlass, turretElevation, longBarrel, bigBrake, bipodL, bipodR, stock, grip, mag);
    }
    else if (weaponType === 'alda' || weaponType === 'p641') {
      // LIGHT MACHINE GUNS (ALDA 5.56 / P641)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.072 * s, 0.12 * s, 0.46 * s), receiverMat);
      body.position.set(0, 0.03 * s, 0);

      const topRail = this.createPicatinnyRail(0.24, 0.028, s);
      topRail.position.set(0, 0.095 * s, -0.06 * s);

      const holo = this.createHolographicSight(s, reticleMat);
      holo.position.set(0, 0.104 * s, -0.06 * s);

      const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.5 * s, 8), steelMat);
      heavyBarrel.rotation.x = Math.PI / 2;
      heavyBarrel.position.set(0, 0.035 * s, -0.48 * s);

      const brake = this.createMuzzleBrake(0.02, 0.06, s);
      brake.rotation.x = Math.PI / 2;
      brake.position.set(0, 0.035 * s, -0.74 * s);

      // Large 100-round drum / box magazine with belt link
      const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.085 * s, 0.17 * s, 0.15 * s), polymerMat);
      ammoBox.position.set(0.025 * s, -0.12 * s, -0.04 * s);

      const ammoBelt = new THREE.Mesh(new THREE.BoxGeometry(0.02 * s, 0.06 * s, 0.04 * s), brassMat);
      ammoBelt.position.set(-0.035 * s, -0.02 * s, -0.04 * s);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.12 * s, 0.22 * s), polymerMat);
      stock.position.set(0, 0.01 * s, 0.32 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.06 * s, 0.1 * s);
      grip.rotation.x = -0.3;

      addEjectionPort(0.038, 0.05, 0.02, 0.075, 0.028);
      gun.add(body, topRail, holo, heavyBarrel, brake, ammoBox, ammoBelt, stock, grip);
    }
    else if (weaponType === 'm590a1' || weaponType === 'sgcqb' || weaponType === 'shotgun') {
      // SHOTGUNS (12-Gauge Breaching Shotgun with side saddle)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065 * s, 0.09 * s, 0.36 * s), receiverMat);
      body.position.set(0, 0.015 * s, 0);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.5 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03 * s, -0.38 * s);

      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.46 * s, 8), steelMat);
      magTube.rotation.x = Math.PI / 2;
      magTube.position.set(0, -0.015 * s, -0.36 * s);

      // Ribbed pump handle
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.026 * s, 0.026 * s, 0.18 * s, 10), polymerMat);
      pump.rotation.x = Math.PI / 2;
      pump.position.set(0, -0.015 * s, -0.26 * s);

      // 4-shell side saddle on receiver
      const saddleMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.4 });
      for (let sh = 0; sh < 4; sh++) {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.009 * s, 0.009 * s, 0.055 * s, 8), saddleMat);
        shell.rotation.x = Math.PI / 2;
        shell.position.set(0.038 * s, 0.01 * s + (sh % 2 === 0 ? 0.015 * s : -0.015 * s), -0.08 * s + sh * 0.024 * s);
        gun.add(shell);
      }

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.042 * s, 0.11 * s, 0.28 * s), polymerMat);
      stock.position.set(0, -0.02 * s, 0.28 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045 * s, 0.12 * s, 0.05 * s), polymerMat);
      grip.position.set(0, -0.08 * s, 0.08 * s);
      grip.rotation.x = -0.35;

      addEjectionPort(0.034, 0.03, -0.02, 0.065, 0.025);
      gun.add(body, barrel, magTube, pump, stock, grip);
    }
    else if (weaponType === 'hammer') {
      // SLEDGE BREACHING HAMMER
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.9 * s, 10), polymerMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0, 0.1 * s);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.16 * s, 0.28 * s), receiverMat);
      head.position.set(0, 0.08 * s, -0.34 * s);

      const face = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.17 * s, 0.04 * s), steelMat);
      face.position.set(0, 0.08 * s, -0.49 * s);
      gun.add(handle, head, face);
    }
    else if (weaponType === 'shield') {
      // MONTAGNE / EXTENDABLE BALLISTIC SHIELD
      // Cutout shield panels so viewport window is physically hollow and see-through
      const lowerPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68 * s, 0.62 * s, 0.08 * s), receiverMat);
      lowerPlate.position.set(0, -0.215 * s, -0.15 * s);

      const upperPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68 * s, 0.18 * s, 0.08 * s), receiverMat);
      upperPlate.position.set(0, 0.435 * s, -0.15 * s);

      const leftFlank = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.25 * s, 0.08 * s), receiverMat);
      leftFlank.position.set(-0.26 * s, 0.22 * s, -0.15 * s);

      const rightFlank = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.25 * s, 0.08 * s), receiverMat);
      rightFlank.position.set(0.26 * s, 0.22 * s, -0.15 * s);

      const frameBezel = new THREE.Mesh(new THREE.BoxGeometry(0.40 * s, 0.27 * s, 0.09 * s), steelMat);
      frameBezel.position.set(0, 0.22 * s, -0.15 * s);

      const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.23 * s, 0.02 * s), this.ballisticShieldGlassMat);
      windowGlass.position.set(0, 0.22 * s, -0.15 * s);

      const strobeArray = new THREE.Mesh(
        new THREE.BoxGeometry(0.52 * s, 0.07 * s, 0.04 * s),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.95 })
      );
      strobeArray.position.set(0, -0.4 * s, -0.11 * s);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * s, 0.028 * s, 0.44 * s, 10), steelMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0, 0.06 * s);
      gun.add(lowerPlate, upperPlate, leftFlank, rightFlank, frameBezel, windowGlass, strobeArray, handle);
    }
    else if (weaponType === 'smg11') {
      // SMG-11 - Machine Pistol
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.042 * s, 0.065 * s, 0.2 * s), receiverMat);
      body.position.set(0, 0.02 * s, 0);

      const topRail = this.createPicatinnyRail(0.14, 0.022, s);
      topRail.position.set(0, 0.055 * s, -0.02 * s);

      const holo = this.createHolographicSight(s * 0.8, reticleMat);
      holo.position.set(0, 0.062 * s, -0.02 * s);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.09 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02 * s, -0.14 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036 * s, 0.12 * s, 0.044 * s), polymerMat);
      grip.position.set(0, -0.06 * s, 0.02 * s);

      const extendedMag = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.18 * s, 0.038 * s), steelMat);
      extendedMag.position.set(0, -0.13 * s, 0.02 * s);

      addEjectionPort(0.024, 0.03, -0.01, 0.04, 0.016);
      gun.add(body, topRail, holo, barrel, grip, extendedMag);
    }
    else if (weaponType === 'mag44') {
      // MAG-44 Scoped Magnum Revolver
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.036 * s, 0.055 * s, 0.17 * s), steelMat);
      body.position.set(0, 0.01 * s, -0.02 * s);

      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.019 * s, 0.019 * s, 0.072 * s, 10), steelMat);
      cylinder.rotation.x = Math.PI / 2;
      cylinder.position.set(0, 0, -0.04 * s);

      const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.2 * s, 8), steelMat);
      longBarrel.rotation.x = Math.PI / 2;
      longBarrel.position.set(0, 0.015 * s, -0.18 * s);

      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.032 * s, 0.095 * s, 0.042 * s),
        new THREE.MeshStandardMaterial({ color: 0x502d14, roughness: 0.75 })
      );
      grip.rotation.x = -0.3;
      grip.position.set(0, -0.05 * s, 0.035 * s);

      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * s, 0.011 * s, 0.14 * s, 8), receiverMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.045 * s, -0.05 * s);
      gun.add(body, cylinder, longBarrel, grip, scope);
    }
    else {
      // Tactical Sidearm (P9 / Fallback Pistol)
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.036 * s, 0.045 * s, 0.17 * s), steelMat);
      slide.position.set(0, 0.01 * s, -0.02 * s);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.045 * s, 0.16 * s), receiverMat);
      frame.position.set(0, -0.02 * s, -0.01 * s);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032 * s, 0.095 * s, 0.042 * s), polymerMat);
      grip.position.set(0, -0.065 * s, 0.035 * s);
      grip.rotation.x = -0.28;

      // Underbarrel weapon light (Streamlight style)
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.024 * s, 0.065 * s), receiverMat);
      light.position.set(0, -0.04 * s, -0.06 * s);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.009 * s, 8), this.opticGlassMat);
      lens.position.set(0, -0.04 * s, -0.093 * s);

      addEjectionPort(0.019, 0.02, -0.02, 0.038, 0.015);
      gun.add(slide, frame, grip, light, lens);
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
   * Anatomical head, balaclava, quad-tube panoramic NVGs, FAST helmet with ARC rails,
   * Crye JPC 2.0 plate carrier with skeletal cummerbund, PTT radio, combat belt,
   * Safariland holster, Crye G3 pants with integrated AirFlex kneepads, and combat boots.
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
      metalness: 0.14
    });
    const vestMat = new THREE.MeshStandardMaterial({
      color: side === 'atk' ? 0x222a26 : 0x1e2734,
      roughness: 0.62,
      metalness: 0.28
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.6
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

    // Skeletal MOLLE cummerbund side bands
    for (let cb = -1; cb <= 1; cb += 2) {
      const cummerbund = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.22), vestMat);
      cummerbund.position.set(cb * 0.19, 0.12, 0);
      torsoGroup.add(cummerbund);
    }

    // 3 STANAG / PMAG Rifle Magazine Pouches on front plate with pull tabs
    for (let i = -1; i <= 1; i++) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.18, 0.075), vestMat);
      pouch.position.set(i * 0.105, 0.1, 0.19);

      // Bungee retention pull tab
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.015), this.gunPolymerMat);
      tab.position.set(i * 0.105, 0.2, 0.195);
      torsoGroup.add(pouch, tab);
    }

    // High-visibility Team Armband on shoulders
    const armBandMat = new THREE.MeshBasicMaterial({ color: side === 'atk' ? 0x00ff88 : 0x00aaff });
    const armBandL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), armBandMat);
    armBandL.position.set(-0.25, 0.32, 0);
    const armBandR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), armBandMat);
    armBandR.position.set(0.25, 0.32, 0);
    torsoGroup.add(armBandL, armBandR);

    // Operator Division Patch on Chest
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.02), accentMat);
    badge.position.set(0, 0.31, 0.18);
    torsoGroup.add(badge);

    // Push-To-Talk (PTT) unit on left chest strap with comms cable
    const ptt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), this.gunPolymerMat);
    ptt.rotation.x = Math.PI / 2;
    ptt.position.set(-0.11, 0.3, 0.18);
    torsoGroup.add(ptt);

    // Combat Military Radio with whip antenna
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.06), this.gunPolymerMat);
    radio.position.set(-0.15, 0.28, -0.16);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 6), this.gunPolymerMat);
    antenna.position.set(-0.15, 0.46, -0.16);
    antenna.rotation.z = -0.15;
    torsoGroup.add(radio, antenna);

    // Tactical Assault Backpack with Hydration Tube
    const assaultPack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.36, 0.14), vestMat);
    assaultPack.position.set(0, 0.18, -0.22);
    assaultPack.castShadow = true;

    const hydroTube = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 6), this.gunPolymerMat);
    hydroTube.position.set(0.14, 0.32, -0.1);
    hydroTube.rotation.set(0.4, 0, 0.3);

    // Diagonally slung breaching hammer / tactical tool on assault pack
    const backTool = new THREE.Group();
    backTool.position.set(-0.06, 0.22, -0.29);
    backTool.rotation.set(0.12, 0, 0.62);
    const backToolHaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 8), this.gunPolymerMat);
    const backToolHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.16), this.gunSteelMat);
    backToolHead.position.set(0, 0.21, 0);
    backTool.add(backToolHaft, backToolHead);

    // Tactical Chemlights / Cyalume Glow Sticks on chest
    const chemlightMat = new THREE.MeshBasicMaterial({ color: side === 'atk' ? 0x39ff14 : 0x00e5ff });
    for (let c = 0; c < 2; c++) {
      const chemlight = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), chemlightMat);
      chemlight.position.set(-0.13 - c * 0.025, 0.14, 0.19);
      chemlight.rotation.z = -0.2;
      torsoGroup.add(chemlight);
    }

    torsoGroup.add(assaultPack, hydroTube, backTool);

    // Combat Application Tourniquet (CAT) on Upper Chest
    const tqMat = new THREE.MeshBasicMaterial({ color: 0xcc2200 });
    const tourniquet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.025), tqMat);
    tourniquet.position.set(0.12, 0.26, 0.185);
    torsoGroup.add(tourniquet);

    // Tactical Duty Belt with metal buckle & pouches
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.28), this.gunPolymerMat);
    belt.position.set(0, -0.12, 0);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.025), this.gunSteelMat);
    buckle.position.set(0, -0.12, 0.15);
    torsoGroup.add(belt, buckle);

    // Grenades & IFAK pouch on belt
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x3d4a3e, metalness: 0.8, roughness: 0.3 });
    for (let g = 0; g < 2; g++) {
      const grenade = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.11, 8), grenadeMat);
      grenade.position.set(-0.18 - g * 0.05, -0.12, 0.12);
      torsoGroup.add(grenade);
    }

    const ifak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.07), vestMat);
    ifak.position.set(0, -0.12, -0.16);
    torsoGroup.add(chest, plateFront, plateBack, ifak);

    // Invisible Hit Mesh for bullet raycasting
    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 1.8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.set(0, 0.9, 0);
    root.add(hitMesh);

    // 2. Head with FAST Ballistic Helmet, ARC rails, Quad-Tube NVGs, & Ballistic Glasses
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.42, 0);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 10), this.balaclavaMat);
    neck.position.set(0, 0, 0);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 14), this.balaclavaMat);
    head.position.set(0, 0.13, 0);

    const eyeBand = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.06), this.skinMat);
    eyeBand.position.set(0, 0.14, 0.13);

    // Ballistic Sunglasses / Oakley M-Frame Visor
    const glasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.165, 0.038, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.08, metalness: 0.9 })
    );
    glasses.position.set(0, 0.142, 0.145);

    // Ballistic FAST Helmet
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
      this.helmetMat
    );
    helmet.position.set(0, 0.15, -0.01);
    helmet.castShadow = true;

    // ARC Accessory Rails on helmet sides
    for (let rSide of [-1, 1]) {
      const arcRail = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.14), this.gunPolymerMat);
      arcRail.position.set(rSide * 0.175, 0.16, 0);
      headGroup.add(arcRail);
    }

    // Rear Helmet Battery Pack & Counterweight
    const batteryPack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), this.gunPolymerMat);
    batteryPack.position.set(0, 0.16, -0.17);

    // Rear Team Identification LED Beacon
    const rearBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      new THREE.MeshBasicMaterial({ color: side === 'atk' ? 0x00ff88 : 0x00aaff })
    );
    rearBeacon.position.set(0, 0.19, -0.185);
    headGroup.add(batteryPack, rearBeacon);

    // Wilcox L4G24 NVG Shroud Mount
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.07), this.gunReceiverMat);
    nvgMount.position.set(0, 0.23, 0.15);
    headGroup.add(nvgMount);

    // GPNVG-18 Quad-Tube Panoramic Night Vision Goggles
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

    // Ops-Core AMP Comms Headset with boom mic
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), this.gunPolymerMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.178, 0.13, 0);

    const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), this.gunPolymerMat);
    earR.rotation.z = Math.PI / 2;
    earR.position.set(0.178, 0.13, 0);

    const boomMic = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 6), this.gunPolymerMat);
    boomMic.rotation.x = Math.PI / 3;
    boomMic.position.set(-0.15, 0.08, 0.1);

    headGroup.add(neck, head, eyeBand, glasses, helmet, earL, earR, boomMic);
    torsoGroup.add(headGroup);

    // 3. Arms & Tactical Combat Gloves Holding Weapon
    const armsGroup = new THREE.Group();
    armsGroup.position.set(0, 0.28, 0);

    // Right Arm (Firing Hand)
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

    const rKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.04), this.gunSteelMat);
    rKnuckle.position.set(-0.1, -0.23, 0.41);
    rightArmGroup.add(rUpper, rForearm, rGlove, rKnuckle);

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

    const lKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.04), this.gunSteelMat);
    lKnuckle.position.set(0.2, -0.18, 0.49);
    leftArmGroup.add(lUpper, lForearm, lGlove, lKnuckle);

    // Tactical Weapon Held Prominently in Hands (Facing Forward +Z)
    const weaponGroup = new THREE.Group();
    const gunMesh = this.createTacticalWeapon(weaponType, false);
    gunMesh.rotation.y = Math.PI;
    gunMesh.position.set(0.08, -0.12, 0.36);
    weaponGroup.add(gunMesh);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0.08, -0.1, 1.15);
    weaponGroup.add(muzzlePoint);

    armsGroup.add(rightArmGroup, leftArmGroup, weaponGroup);
    torsoGroup.add(armsGroup);

    // 4. Legs with Crye Precision G3 Combat Pants, AirFlex Knee Pads & Treaded Boots
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.13, 0.52, 0);

    const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 8), uniformMat);
    lThigh.position.set(0, -0.12, 0);

    // AirFlex Hard Polymer Knee Pad
    const lKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.07), vestMat);
    lKneePad.position.set(0, -0.3, 0.07);

    const lKneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.02), this.gunPolymerMat);
    lKneeCap.position.set(0, -0.3, 0.11);

    const lShin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.46, 8), uniformMat);
    lShin.position.set(0, -0.45, 0);

    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.25), this.gunPolymerMat);
    lBoot.position.set(0, -0.65, 0.04);
    leftLeg.add(lThigh, lKneePad, lKneeCap, lShin, lBoot);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.13, 0.52, 0);

    const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 8), uniformMat);
    rThigh.position.set(0, -0.12, 0);

    // Safariland Drop-Leg Holster with Backup Sidearm on Right Thigh
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.12), this.gunPolymerMat);
    holster.position.set(0.1, -0.14, 0);

    const sidearm = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.1, 0.07), this.gunSteelMat);
    sidearm.position.set(0.1, -0.04, 0.03);
    sidearm.rotation.x = -0.35;
    rightLeg.add(holster, sidearm);

    const rKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.07), vestMat);
    rKneePad.position.set(0, -0.3, 0.07);

    const rKneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.02), this.gunPolymerMat);
    rKneeCap.position.set(0, -0.3, 0.11);

    const rShin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.46, 8), uniformMat);
    rShin.position.set(0, -0.45, 0);

    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.25), this.gunPolymerMat);
    rBoot.position.set(0, -0.65, 0.04);
    rightLeg.add(rThigh, rKneePad, rKneeCap, rShin, rBoot);

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
  public static createFirstPersonRig(weaponType: string = 'ar', skin?: WeaponSkin): {
    root: THREE.Group;
    weaponGroup: THREE.Group;
    flashSprite: THREE.Sprite;
    barrelTip: THREE.Object3D;
  } {
    const root = new THREE.Group();
    const activeSkin = skin || SkinManager.getEquippedSkin();

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
    const gun = this.createTacticalWeapon(weaponType, true, activeSkin);
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
   * First Person Tactical Gadget View Rig
   * Accurately displays handheld gadgets in first-person:
   * - Tactical Breaching Hammer (Sledge)
   * - Extended Ballistic Shield (Montagne / Blitz)
   * - Electronic Recon Device / Sensor (Pulse / Solis / Detonator)
   * - Deployable Camera (Valkyrie / Maestro)
   * - Breach Charge (Attackers)
   */
  public static createGadgetViewRig(kind: 'camera' | 'breach_charge' | 'hammer' | 'shield' | 'device' = 'camera'): {
    root: THREE.Group;
    gadgetGroup: THREE.Group;
  } {
    const root = new THREE.Group();

    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x222a30, roughness: 0.8 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.7, metalness: 0.2 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x555d68, roughness: 0.25, metalness: 0.95 });
    const polymerMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.65, metalness: 0.25 });

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

    if (kind === 'hammer') {
      // SLEDGE TACTICAL BREACHING HAMMER VIEW RIG
      const hammer = new THREE.Group();
      hammer.position.set(0.02, 0.08, 0.06);
      hammer.rotation.set(-0.25, -0.4, -0.35);

      // Long heavy fiberglass haft with rubber grip
      const haft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.019, 0.72, 10),
        polymerMat
      );
      haft.position.set(0, 0, 0);

      // Textured rubber grip wrap on lower section
      for (let g = -3; g <= 3; g++) {
        const gripRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.0195, 0.002, 6, 12),
          this.gunPolymerMat
        );
        gripRing.position.set(0, -0.15 + g * 0.025, 0);
        gripRing.rotation.x = Math.PI / 2;
        hammer.add(gripRing);
      }

      // Drop-forged heavy steel sledge hammer head
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.13, 0.24),
        steelMat
      );
      head.position.set(0, 0.33, 0);

      // Hardened steel cross-hatched striking faces (front & back)
      for (const side of [-1, 1]) {
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(0.118, 0.138, 0.025),
          this.gunSteelMat
        );
        face.position.set(0, 0.33, side * 0.125);
        hammer.add(face);
      }

      // Caution hazard stripes on hammer neck
      const hazardBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.021, 0.021, 0.08, 10),
        new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 })
      );
      hazardBand.position.set(0, 0.22, 0);
      hammer.add(hazardBand);

      hammer.add(haft, head);
      gadgetGroup.add(hammer);
    } else if (kind === 'shield') {
      // BALLISTIC EXTENDED SHIELD VIEW RIG (Montagne / Blitz)
      const shield = new THREE.Group();
      shield.position.set(-0.1, 0.05, 0.12);
      shield.rotation.set(-0.05, 0.08, 0);

      // Heavy armor plates with true hollow viewport aperture for crystal clear visibility
      const lowerPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.52, 0.04),
        this.gunReceiverMat
      );
      lowerPlate.position.set(0, -0.18, 0);

      const upperPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.16, 0.04),
        this.gunReceiverMat
      );
      upperPlate.position.set(0, 0.36, 0);

      const leftFlank = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.20, 0.04),
        this.gunReceiverMat
      );
      leftFlank.position.set(-0.245, 0.18, 0);

      const rightFlank = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.20, 0.04),
        this.gunReceiverMat
      );
      rightFlank.position.set(0.245, 0.18, 0);

      // Ballistic armored viewport frame border
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.22, 0.05),
        steelMat
      );
      frame.position.set(0, 0.18, 0.005);

      // Multi-layer crystal clear ballistic glass pane (100% see-through)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.33, 0.19, 0.015),
        this.ballisticShieldGlassMat
      );
      glass.position.set(0, 0.18, 0.005);

      // Tactical strobe array (Blitz) / LED status indicators
      const strobe = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.05, 0.025),
        new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffcc00, emissiveIntensity: 0.9 })
      );
      strobe.position.set(0, -0.36, 0.025);

      shield.add(lowerPlate, upperPlate, leftFlank, rightFlank, frame, glass, strobe);
      gadgetGroup.add(shield);
    } else if (kind === 'device') {
      // TACTICAL SCANNER / DETONATOR PDA (Pulse / IQ / Solis / Detonator)
      const dev = new THREE.Group();
      dev.position.set(0.02, 0.02, 0.05);
      dev.rotation.set(0.2, 0.1, -0.05);

      const casing = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.24, 0.035),
        this.gunPolymerMat
      );

      // Tactical green/cyan scanner screen
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x00ffcc })
      );
      screen.position.set(0, 0.01, 0.02);

      // Antenna and toggle switch
      const ant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6),
        steelMat
      );
      ant.position.set(0.06, 0.17, 0);

      const flipSwitch = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.03, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.3 })
      );
      flipSwitch.position.set(-0.05, 0.13, 0.015);

      dev.add(casing, screen, ant, flipSwitch);
      gadgetGroup.add(dev);
    } else if (kind === 'breach_charge') {
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.5, metalness: 0.8 });
      const c4Mat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 });
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.035), frameMat);
      const c4 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.042), c4Mat);
      c4.position.set(0, 0, 0.012);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), ledMat);
      led.position.set(0.055, 0.09, 0.035);
      gadgetGroup.add(frame, c4, led);
      gadgetGroup.rotation.set(0.15, 0.3, 0.05);
    } else {
      // Recon Camera / Deployable Gadget (Valkyrie Black Eye / Maestro / Smoke)
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
