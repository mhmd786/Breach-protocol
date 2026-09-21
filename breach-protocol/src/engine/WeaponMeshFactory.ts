import * as THREE from 'three';
import { WeaponType } from '../types/game';

export class WeaponMeshFactory {
  // Reusable materials
  private matGunMetal: THREE.MeshStandardMaterial;
  private matPolymer: THREE.MeshStandardMaterial;
  private matArmSleeve: THREE.MeshStandardMaterial;
  private matGlove: THREE.MeshStandardMaterial;
  private matOpticGlass: THREE.MeshPhysicalMaterial;
  private matReticle: THREE.MeshBasicMaterial;
  private matMuzzleFlash: THREE.MeshBasicMaterial;

  constructor() {
    this.matGunMetal = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.35,
      metalness: 0.85,
    });

    this.matPolymer = new THREE.MeshStandardMaterial({
      color: 0x33373e,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.matArmSleeve = new THREE.MeshStandardMaterial({
      color: 0x27272a, // dark tactical multicam
      roughness: 0.9,
    });

    this.matGlove = new THREE.MeshStandardMaterial({
      color: 0x18181b, // tactical carbon knuckles
      roughness: 0.7,
      metalness: 0.2,
    });

    this.matOpticGlass = new THREE.MeshPhysicalMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.4,
      roughness: 0.05,
      transmission: 0.8,
    });

    this.matReticle = new THREE.MeshBasicMaterial({
      color: 0xef4444, // tactical red dot
    });

    this.matMuzzleFlash = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
    });
  }

  // Create First-Person Arms + Weapon Rig (attached to Player Camera)
  public createFirstPersonRig(weaponType: WeaponType = 'assault_rifle'): {
    root: THREE.Group;
    weaponGroup: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    muzzleTip: THREE.Vector3;
    muzzleFlash: THREE.Mesh;
    flashLight: THREE.PointLight;
    adsOffset: THREE.Vector3;
    hipOffset: THREE.Vector3;
  } {
    const root = new THREE.Group();
    root.position.set(0, 0, 0);

    const weaponGroup = new THREE.Group();
    const hipOffset = new THREE.Vector3(0.22, -0.26, -0.48);
    const adsOffset = new THREE.Vector3(0.0, -0.198, -0.36);
    weaponGroup.position.copy(hipOffset);

    // Build Tactical Weapon Mesh
    const gunMesh = this.buildWeaponMesh(weaponType);
    weaponGroup.add(gunMesh);

    // Muzzle Flash
    const flashGeo = new THREE.OctahedronGeometry(0.06, 0);
    const flashMesh = new THREE.Mesh(flashGeo, this.matMuzzleFlash);
    const muzzleZ = weaponType === 'shotgun' ? -0.55 : (weaponType === 'smg' ? -0.42 : -0.65);
    flashMesh.position.set(0, 0.045, muzzleZ);
    flashMesh.visible = false;
    weaponGroup.add(flashMesh);

    const flashLight = new THREE.PointLight(0xfef08a, 0, 8);
    flashLight.position.set(0, 0.045, muzzleZ);
    weaponGroup.add(flashLight);

    // First Person Arms
    const rightArm = new THREE.Group();
    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.4, 8), this.matArmSleeve);
    rightForearm.rotation.x = Math.PI / 2.8;
    rightForearm.position.set(0.12, -0.18, 0.16);
    const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.1), this.matGlove);
    rightGlove.position.set(0.02, -0.05, -0.05);
    rightArm.add(rightForearm, rightGlove);
    weaponGroup.add(rightArm);

    const leftArm = new THREE.Group();
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.44, 8), this.matArmSleeve);
    leftForearm.rotation.x = Math.PI / 2.3;
    leftForearm.rotation.y = -Math.PI / 6;
    leftForearm.position.set(-0.2, -0.15, 0.08);
    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.1), this.matGlove);
    leftGlove.position.set(-0.02, -0.02, -0.28);
    leftArm.add(leftForearm, leftGlove);
    weaponGroup.add(leftArm);

    root.add(weaponGroup);

    return {
      root,
      weaponGroup,
      leftArm,
      rightArm,
      muzzleTip: new THREE.Vector3(0, 0.045, muzzleZ),
      muzzleFlash: flashMesh,
      flashLight,
      adsOffset,
      hipOffset,
    };
  }

  // Procedural weapon body
  private buildWeaponMesh(type: WeaponType): THREE.Group {
    const group = new THREE.Group();

    // Receiver
    const recLength = type === 'smg' ? 0.28 : 0.38;
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, recLength), this.matGunMetal);
    group.add(receiver);

    // Barrel
    const bLen = type === 'shotgun' ? 0.35 : (type === 'smg' ? 0.22 : 0.42);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, bLen, 8), this.matGunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -recLength / 2 - bLen / 2);
    group.add(barrel);

    // Handguard / Shroud
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, bLen * 0.75), this.matPolymer);
    guard.position.set(0, 0.015, -recLength / 2 - (bLen * 0.75) / 2);
    group.add(guard);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.14, 0.05), this.matPolymer);
    grip.rotation.x = -0.3;
    grip.position.set(0, -0.08, 0.05);
    group.add(grip);

    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.16, 0.06), this.matPolymer);
    mag.rotation.x = 0.2;
    mag.position.set(0, -0.09, -0.06);
    group.add(mag);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.22), this.matPolymer);
    stock.position.set(0, -0.01, recLength / 2 + 0.11);
    group.add(stock);

    // Reflex Sight / Optic
    const opticHousing = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.05, 0.09), this.matGunMetal);
    opticHousing.position.set(0, 0.065, -0.05);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.01), this.matOpticGlass);
    glass.position.set(0, 0.065, -0.05);

    // Glowing Holographic Reticle Dot
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 8), this.matReticle);
    dot.position.set(0, 0.065, -0.055);

    group.add(opticHousing, glass, dot);

    return group;
  }

  // Create Third-Person Tactical Humanoid Model (for Bots and Other Players)
  public createThirdPersonCharacter(team: 'attackers' | 'defenders', opColor: string = '#3b82f6'): {
    root: THREE.Group;
    head: THREE.Mesh;
    torso: THREE.Group;
    weaponMount: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    muzzleTipWorld: THREE.Vector3;
    flashMesh: THREE.Mesh;
  } {
    const root = new THREE.Group();

    // Materials
    const camoColor = team === 'attackers' ? 0x2e3842 : 0x3d352e;
    const matSuit = new THREE.MeshStandardMaterial({ color: camoColor, roughness: 0.85 });
    const matArmor = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.3 });
    const matAccent = new THREE.MeshStandardMaterial({ color: new THREE.Color(opColor), roughness: 0.4 });
    const matBoots = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.8 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xc49b78, roughness: 0.6 });
    const matVisor = new THREE.MeshPhysicalMaterial({ color: 0x10b981, roughness: 0.1, metalness: 0.9 });

    // Torso & Plate Carrier
    const torso = new THREE.Group();
    torso.position.set(0, 1.15, 0);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.28), matSuit);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.32), matArmor);
    vest.position.set(0, 0.02, 0);

    // Team Shoulder patch
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.08), matAccent);
    patch.position.set(0.25, 0.15, 0);

    torso.add(chest, vest, patch);

    // Head & Tactical Helmet
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.62, 0);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), matSkin);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), matArmor);
    helmet.position.set(0, 0.03, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.1), matVisor);
    visor.position.set(0, 0.01, 0.11);
    headGroup.add(headMesh, helmet, visor);

    // Legs & Boots
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.85, 8), matSuit);
    leftLeg.position.set(-0.14, 0.44, 0);
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.24), matBoots);
    leftBoot.position.set(0, -0.4, 0.03);
    leftLeg.add(leftBoot);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.85, 8), matSuit);
    rightLeg.position.set(0.14, 0.44, 0);
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.24), matBoots);
    rightBoot.position.set(0, -0.4, 0.03);
    rightLeg.add(rightBoot);

    // Arms Holding Gun Forward
    const weaponMount = new THREE.Group();
    weaponMount.position.set(0.16, 1.22, 0.25);

    // Real gun held in hands
    const thirdPersonGun = this.buildWeaponMesh('assault_rifle');
    thirdPersonGun.scale.set(0.85, 0.85, 0.85);
    weaponMount.add(thirdPersonGun);

    // Third person muzzle flash
    const flashMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), this.matMuzzleFlash);
    flashMesh.position.set(0, 0.03, -0.55);
    flashMesh.visible = false;
    weaponMount.add(flashMesh);

    // Right Arm
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.4, 8), matSuit);
    rArm.rotation.x = Math.PI / 2.2;
    rArm.position.set(0.08, 0, -0.15);
    weaponMount.add(rArm);

    // Left Arm reaching for foregrip
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.45, 8), matSuit);
    lArm.rotation.x = Math.PI / 2.5;
    lArm.rotation.y = -0.4;
    lArm.position.set(-0.25, -0.05, -0.2);
    weaponMount.add(lArm);

    root.add(torso, headGroup, leftLeg, rightLeg, weaponMount);

    return {
      root,
      head: headMesh,
      torso,
      weaponMount,
      leftLeg,
      rightLeg,
      muzzleTipWorld: new THREE.Vector3(0.16, 1.25, -0.3),
      flashMesh
    };
  }

  // Create Physical Recon Drone 3D Object
  public createReconDroneMesh(): {
    root: THREE.Group;
    frontWheels: THREE.Mesh;
    rearWheels: THREE.Mesh;
    cameraLens: THREE.Mesh;
  } {
    const root = new THREE.Group();

    // Chassis body
    const matBody = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
    const matTires = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.32), matBody);
    body.position.set(0, 0.08, 0);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const fWheels = new THREE.Mesh(wheelGeo, matTires);
    fWheels.position.set(0, 0.07, -0.12);
    const rWheels = new THREE.Mesh(wheelGeo, matTires);
    rWheels.position.set(0, 0.07, 0.12);

    // Front Camera Lens with blue light
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), matGlow);
    lens.rotateX(Math.PI / 2);
    lens.position.set(0, 0.09, -0.17);

    // Jumping spring arm
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), matBody);
    spring.position.set(0, 0.04, 0);

    root.add(body, fWheels, rWheels, lens, spring);

    return {
      root,
      frontWheels: fWheels,
      rearWheels: rWheels,
      cameraLens: lens
    };
  }
}

export const weaponMeshFactory = new WeaponMeshFactory();
