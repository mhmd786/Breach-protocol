import * as THREE from 'three';
import { sound } from '../audio/SoundEngine';

export interface ActiveGadget {
  id: string;
  type: string;
  name: string;
  ownerSide: 'atk' | 'def';
  ownerId: string;
  pos: THREE.Vector3;
  mesh: THREE.Object3D;
  hp: number;
  maxHp: number;
  timer: number;
  duration?: number;
  radius: number;
  isElectronic: boolean;
  armed: boolean;
  /** World time (seconds) at which an EMP-disabled electronic may operate again. */
  disabledUntil?: number;
  /** Kept in sync with disabledUntil so UI/behaviour can test a readable state. */
  isDisabled?: boolean;
  customData?: any;
  onTrigger?: (gadget: ActiveGadget, engine: any) => void;
}

export class GadgetSystem {
  public gadgets: ActiveGadget[] = [];
  private scene: THREE.Scene | null = null;
  private idCounter = 1;

  constructor() {}

  public init(scene: THREE.Scene) {
    this.scene = scene;
  }

  public clearAll() {
    if (this.scene) {
      this.gadgets.forEach(g => {
        if (g.mesh) this.scene?.remove(g.mesh);
      });
    }
    this.gadgets = [];
  }

  // Deploy physical placed or thrown gadgets
  public deployGadget(
    type: string,
    ownerSide: 'atk' | 'def',
    ownerId: string,
    pos: THREE.Vector3,
    direction: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
    engine?: any
  ): ActiveGadget | null {
    if (!this.scene) return null;

    const id = `gadget_${this.idCounter++}_${type}`;
    const group = new THREE.Group();
    group.position.copy(pos);

    let radius = 2.0;
    let hp = 30;
    let isElectronic = true;
    let timer = 0;
    let duration = 999;
    let name = type;

    // Visual geometry based on gadget type
    switch (type) {
      case 'gas_grenade': { // Smoke Babes
        name = 'Gas Canister';
        const canister = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.35, 12),
          new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 })
        );
        const yellowBand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.125, 0.1, 12),
          new THREE.MeshStandardMaterial({ color: 0xe6b800, emissive: 0x664400 })
        );
        group.add(canister, yellowBand);
        radius = 4.5;
        hp = 25;
        break;
      }

      case 'signal_disruptor': { // Mute GC90 Jammer
        name = 'GC90 Jammer';
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.25, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x2a3b4c, metalness: 0.6, roughness: 0.4 })
        );
        const ant1 = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        ant1.position.set(0.12, 0.3, 0.12);
        const ant2 = ant1.clone();
        ant2.position.set(-0.12, 0.3, -0.12);
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.05),
          new THREE.MeshBasicMaterial({ color: 0x00e5ff })
        );
        led.position.set(0, 0.15, 0.18);
        // Cyan pulse ring on floor
        const ringGeo = new THREE.RingGeometry(3.8, 4.0, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.1;
        group.add(base, ant1, ant2, led, ring);
        radius = 4.2;
        break;
      }

      case 'ads_defense': { // Jäger Magpie ADS
        name = 'Magpie ADS';
        const magpieBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.25, 0.15, 8),
          new THREE.MeshStandardMaterial({ color: 0x3d4349, metalness: 0.7 })
        );
        const turret = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.5 })
        );
        turret.position.y = 0.12;
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.15),
          new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.12, 0.12);
        group.add(magpieBase, turret, barrel);
        radius = 5.0;
        duration = 3; // interception charges, not a lifetime
        break;
      }

      case 'entry_denial': { // Kapkan EDD MK.II
        name = 'EDD MK.II Tripmine';
        const eddBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.25, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.6 })
        );
        const eddScrew = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9 })
        );
        eddScrew.rotation.x = Math.PI / 2;
        // Bright Red Laser Line across doorframe
        const laserMat = new THREE.LineBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.85 });
        const laserGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(direction.x * 2.5, 0, direction.z * 2.5)
        ]);
        const laser = new THREE.Line(laserGeo, laserMat);
        group.add(eddBox, eddScrew, laser);
        radius = 2.0;
        hp = 15;
        break;
      }

      case 'welcome_mat': { // Frost Welcome Mat
        name = 'Sterling Welcome Mat';
        isElectronic = false;
        const mat = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.04, 0.7),
          new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.4 })
        );
        const jaws = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.08, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.9 })
        );
        jaws.position.set(0, 0.04, 0.25);
        const jaws2 = jaws.clone();
        jaws2.position.set(0, 0.04, -0.25);
        group.add(mat, jaws, jaws2);
        radius = 1.4;
        hp = 60;
        break;
      }

      case 'shock_wire': { // Bandit Battery
        name = 'CED-1 Battery';
        const batt = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.3, 0.25),
          new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.4, roughness: 0.5 })
        );
        const wire = new THREE.Mesh(
          new THREE.TorusGeometry(0.25, 0.04, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 })
        );
        wire.rotation.x = Math.PI / 2;
        wire.position.y = 0.05;
        // Electric spark sphere
        const sparkLight = new THREE.PointLight(0xffea00, 1.5, 3.5);
        sparkLight.position.y = 0.2;
        group.add(batt, wire, sparkLight);
        radius = 3.2;
        break;
      }

      case 'black_eye_cam': { // Valkyrie Black Eye
        name = 'Black Eye Camera';
        const camSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.7 })
        );
        const blueEye = new THREE.Mesh(
          new THREE.SphereGeometry(0.05),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        blueEye.position.set(0, 0, 0.1);
        group.add(camSphere, blueEye);
        radius = 8.0;
        hp = 10;
        break;
      }

      case 'evil_eye': { // Maestro Evil Eye Turret
        name = 'Cleo Evil Eye Turret';
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x450a0a, metalness: 0.9, roughness: 0.2 })
        );
        const laserLens = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        laserLens.rotation.x = Math.PI / 2;
        laserLens.position.set(0, 0.1, 0.18);
        group.add(dome, laserLens);
        radius = 14.0;
        hp = 120;
        break;
      }

      case 'kiba_barrier': { // Azami Kiba Barrier
        name = 'Kiba Barrier';
        isElectronic = false;
        const barrier = new THREE.Mesh(
          new THREE.CylinderGeometry(1.3, 1.3, 0.18, 18),
          new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.95, metalness: 0.1 })
        );
        barrier.rotation.x = Math.PI / 2;
        group.add(barrier);
        radius = 1.4;
        hp = 300;
        break;
      }

      case 'clear_shield': { // Osa Talon-8 Shield
        name = 'Talon-8 Clear Shield';
        isElectronic = false;
        const shieldGlass = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.95, 0.04),
          new THREE.MeshPhysicalMaterial({
            color: 0xa5f3fc,
            transparent: true,
            opacity: 0.16,
            roughness: 0.03,
            metalness: 0.02,
            transmission: 0.96,
            depthWrite: false
          })
        );
        shieldGlass.position.y = 0.48;
        const shieldFrame = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 0.1, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9 })
        );
        const topRail = new THREE.Mesh(
          new THREE.BoxGeometry(1.24, 0.05, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85 })
        );
        topRail.position.y = 0.95;
        group.add(shieldGlass, shieldFrame, topRail);
        radius = 1.2;
        hp = 450;
        break;
      }

      case 'kona_station': { // Thunderbird Kona Station
        name = 'Kona Medical Station';
        const pod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.24, 0.45, 8),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7 })
        );
        const healBeacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.08),
          new THREE.MeshBasicMaterial({ color: 0x22c55e })
        );
        healBeacon.position.y = 0.28;
        const greenLight = new THREE.PointLight(0x22c55e, 1.5, 4.0);
        greenLight.position.y = 0.3;
        group.add(pod, healBeacon, greenLight);
        radius = 4.5;
        break;
      }

      case 'banshee_slow': { // Melusi Banshee Sonic Pylon
        name = 'Banshee Sonic Pylon';
        const pylon = new THREE.Mesh(
          new THREE.ConeGeometry(0.28, 0.4, 8),
          new THREE.MeshStandardMaterial({ color: 0x15803d, metalness: 0.6 })
        );
        const waveRing = new THREE.Mesh(
          new THREE.RingGeometry(4.8, 5.0, 32),
          new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        waveRing.rotation.x = Math.PI / 2;
        waveRing.position.y = -0.1;
        group.add(pylon, waveRing);
        radius = 5.2;
        break;
      }

      case 'airjab_mine': { // Nomad Airjab
        name = 'Airjab Repulsion Mine';
        const mine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.12, 0.1, 8),
          new THREE.MeshStandardMaterial({ color: 0xe67e22, metalness: 0.8 })
        );
        const yellowLight = new THREE.PointLight(0xffaa00, 1.0, 2.5);
        group.add(mine, yellowLight);
        radius = 2.6;
        hp = 15;
        break;
      }

      case 'trax_stingers': { // Gridlock Trax Stingers
        name = 'Trax Stingers Caltrops';
        isElectronic = false;
        // A visible, persistent coverage field rather than a single invisible radius.
        const field = new THREE.Mesh(
          new THREE.CircleGeometry(2.7, 28),
          new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
        );
        field.rotation.x = -Math.PI / 2;
        field.position.y = 0.012;
        group.add(field);
        for (let i = 0; i < 18; i++) {
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.2, 6),
            new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.85 })
          );
          const angle = (i / 18) * Math.PI * 2;
          const spread = 0.35 + (i % 3) * 0.75;
          spike.position.set(Math.cos(angle) * spread, 0.1, Math.sin(angle) * spread);
          group.add(spike);
        }
        radius = 2.8;
        hp = 40;
        duration = 18;
        break;
      }

      case 'prisma_decoy': { // Alibi Prisma Hologram
        name = 'Prisma Decoy Hologram';
        const holoBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 1.7, 12),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, wireframe: true })
        );
        holoBody.position.y = 0.85;
        const emitter = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.4, 0.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 })
        );
        group.add(holoBody, emitter);
        radius = 1.5;
        hp = 20;
        break;
      }

      case 'razorbloom': { // Thorn Razorbloom
        name = 'Razorbloom Shell';
        const thorn = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x9333ea, metalness: 0.6 })
        );
        const thornLight = new THREE.PointLight(0xa855f7, 1.0, 3.0);
        group.add(thorn, thornLight);
        radius = 3.5;
        hp = 20;
        break;
      }

      default: {
        const generic = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.25, 0.25),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9 })
        );
        group.add(generic);
        break;
      }
    }

    this.scene.add(group);
    sound.playGadgetDeploy();

    const gadget: ActiveGadget = {
      id,
      type,
      name,
      ownerSide,
      ownerId,
      pos: group.position,
      mesh: group,
      hp,
      maxHp: hp,
      timer,
      duration,
      radius,
      isElectronic,
      armed: true
    };

    if (type === 'ads_defense') gadget.customData = { interceptionsLeft: 3 };
    if (type === 'trax_stingers') gadget.customData = { damageTick: 0, activeZone: true };

    this.gadgets.push(gadget);
    return gadget;
  }

  // Update physical gadgets every frame
  public update(dt: number, engine: any) {
    if (!this.scene) return;

    // Zone effects own transient movement modifiers and recompute them from world state.
    // This guarantees a bot regains normal speed immediately after leaving/clearing a zone.
    engine.bots?.forEach((bot: any) => { bot.speedBoost = 1; });

    // Banshee slow is a field effect, not a one-shot trigger: recompute it from scratch
    // every frame instead of latching engine.player.speedBoost = 0.45 once and never
    // clearing it. Previously one touch permanently slowed the player for the rest of the
    // round (and stacked with itself, since nothing ever set it back to 1). speedBoost is
    // only ever written here (see grep — no other system touches it), so it's safe to own
    // its value completely each frame: 0.45 while inside any active banshee radius, 1
    // otherwise, cleared immediately on leaving.
    if (engine.player) {
      let playerInBanshee = false;
      for (const bg of this.gadgets) {
        if (bg.type !== 'banshee_slow' || bg.ownerSide === engine.player.side) continue;
        if (this.isDisabled(bg)) continue;
        if (engine.player.alive && engine.player.pos.distanceTo(bg.pos) <= bg.radius) {
          playerInBanshee = true;
          break;
        }
      }
      engine.player.speedBoost = playerInBanshee ? 0.45 : 1;
    }

    for (let i = this.gadgets.length - 1; i >= 0; i--) {
      const g = this.gadgets[i];
      g.timer += dt;
      if (g.isDisabled && g.disabledUntil !== undefined && g.timer >= g.disabledUntil) {
        g.isDisabled = false;
        g.disabledUntil = undefined;
        this.setDisabledVisual(g, false);
        engine.log?.(`[EMP] ${g.name} recovered.`);
      }
      const disabled = this.isDisabled(g);

      // Gas Grenade / Babes
      if (g.type === 'gas_grenade' && g.armed && !disabled) {
        // BUG FIX: default `duration` is 999 (truthy) for every gadget type that doesn't
        // set its own, so `!g.duration` here was always false — the smoke cloud VFX/hiss
        // sound never played even though the damage-over-time below was ticking the whole
        // time. Use a dedicated one-shot flag instead.
        if (g.timer > 0.5 && !g.customData?.cloudSpawned) {
          g.customData = { ...(g.customData || {}), cloudSpawned: true };
          sound.playGasHiss(10);
          engine.createExplosionCloud?.(g.pos, 4.2, 0xca8a04);
        }
        if (g.timer > 0.5 && g.timer < 10) {
          this.applyAreaDamage(g.pos, g.radius, 25 * dt, engine, 'Toxic Gas');
        }
        if (g.timer >= 10) {
          this.removeGadgetAt(i);
          continue;
        }
      }

      // Kapkan EDD Tripmine trigger check
      if (g.type === 'entry_denial' && g.armed && !disabled) {
        const victim = this.findNearbyEnemy(g.pos, g.radius, g.ownerSide, engine);
        if (victim) {
          sound.playExplosion(g.pos, engine.player?.pos);
          if (victim.isPlayer) {
            engine.damagePlayer ? engine.damagePlayer(60) : (engine.player.hp -= 60);
          } else {
            engine.damageUnit ? engine.damageUnit(victim, 60) : (victim.hp -= 60);
          }
          const victimName = victim.isPlayer ? (victim.name || 'Player') : (victim.op?.name || 'Hostile');
          const msg = `[KAPKAN] EDD Tripmine detonated on ${victimName} (-60 HP)!`;
          engine.log ? engine.log(msg) : engine.addLog?.(msg);
          this.removeGadgetAt(i);
          continue;
        }
      }

      // Frost Welcome Mat trigger check
      if (g.type === 'welcome_mat' && g.armed) {
        const victim = this.findNearbyEnemy(g.pos, g.radius, g.ownerSide, engine);
        if (victim) {
          sound.playSledgeSmash();
          if (victim.isPlayer) {
            engine.damagePlayer ? engine.damagePlayer(70) : (engine.player.hp -= 70);
            if (engine.player) engine.player.stunned = 2.5;
          } else {
            engine.damageUnit ? engine.damageUnit(victim, 70) : (victim.hp -= 70);
            victim.stunned = 2.5;
          }
          const victimName = victim.isPlayer ? (victim.name || 'Player') : (victim.op?.name || 'Hostile');
          const msg = `[FROST] Welcome Mat snapped on ${victimName} (-70 HP, PINNED)!`;
          engine.log ? engine.log(msg) : engine.addLog?.(msg);
          this.removeGadgetAt(i);
          continue;
        }
      }

      // Nomad Airjab repulsion trigger check
      if (g.type === 'airjab_mine' && g.armed) {
        const victim = this.findNearbyEnemy(g.pos, g.radius, g.ownerSide, engine);
        if (victim) {
          sound.playExplosion(g.pos, engine.player?.pos);
          if (victim.isPlayer && engine.player) {
            const pushDir = new THREE.Vector3().subVectors(engine.player.pos, g.pos).normalize();
            engine.player.pos.add(pushDir.multiplyScalar(3.5));
            engine.player.stunned = 2.0;
            engine.damagePlayer ? engine.damagePlayer(15) : (engine.player.hp -= 15);
          } else if (victim.mesh) {
            const pushDir = new THREE.Vector3().subVectors(victim.mesh.position, g.pos).normalize();
            victim.mesh.position.add(pushDir.multiplyScalar(3.5));
            victim.stunned = 2.0;
            engine.damageUnit ? engine.damageUnit(victim, 15) : (victim.hp -= 15);
          }
          const victimName = victim.isPlayer ? 'Player' : (victim.op?.name || 'Enemy');
          const msg = `[NOMAD] Airjab repulsion blast knocked back ${victimName}!`;
          engine.log ? engine.log(msg) : engine.addLog?.(msg);
          this.removeGadgetAt(i);
          continue;
        }
      }

      // Bandit CED-1 Shock Wire
      if (g.type === 'shock_wire' && g.armed && !disabled) {
        // Shocks nearby enemies
        const enemy = this.findNearbyEnemy(g.pos, g.radius, g.ownerSide, engine);
        if (enemy) {
          const dmg = 15 * dt;
          if (enemy.isPlayer) {
            engine.damagePlayer ? engine.damagePlayer(dmg) : (engine.player.hp -= dmg);
          } else {
            engine.damageUnit ? engine.damageUnit(enemy, dmg) : (enemy.hp -= dmg);
          }
        }
      }

      // Thunderbird Kona Station healing
      if (g.type === 'kona_station' && g.armed && !disabled && g.timer > 4.5) {
        const friendly = this.findNearbyFriendly(g.pos, g.radius, g.ownerSide, engine);
        if (friendly && friendly.hp < 100) {
          // BUG FIX: findNearbyFriendly() returns a fresh plain-object COPY for the player
          // case ({isPlayer:true, ...}), not a reference to engine.player — mutating
          // friendly.hp only touched that throwaway copy and never actually healed the
          // real player. Bots are returned by reference so their heal already worked.
          // Write back to the real player object explicitly when it's the player.
          if (friendly.isPlayer && engine.player) {
            engine.player.hp = Math.min(100, engine.player.hp + 30);
          } else {
            friendly.hp = Math.min(100, friendly.hp + 30);
          }
          g.timer = 0; // Cooldown between stim shots
          sound.playHeartbeat();
          const name = friendly.isPlayer ? (friendly.name || 'You') : (friendly.op?.name || 'Teammate');
          const msg = `[THUNDERBIRD] Kona Medical Station healed ${name} (+30 HP)!`;
          engine.log ? engine.log(msg) : engine.addLog?.(msg);
          engine.onStateUpdate?.();
        }
      }

      // Gridlock Trax Stingers
      if (g.type === 'trax_stingers' && g.armed) {
        const zone = g.customData || (g.customData = { damageTick: 0, activeZone: true });
        zone.damageTick = (zone.damageTick || 0) + dt;
        const enemy = this.findNearbyEnemy(g.pos, g.radius, g.ownerSide, engine);
        if (enemy) {
          // Slow is recomputed every update by the consumer; it cannot latch between rounds.
          if (enemy.isPlayer && engine.player) engine.player.speedBoost = Math.min(engine.player.speedBoost, 0.55);
          if (!enemy.isPlayer) (enemy as any).speedBoost = 0.55;
          if (zone.damageTick < 0.5) continue;
          zone.damageTick = 0;
          const dmg = 8;
          if (enemy.isPlayer) {
            engine.damagePlayer ? engine.damagePlayer(dmg) : (engine.player.hp -= dmg);
          } else {
            engine.damageUnit ? engine.damageUnit(enemy, dmg) : (enemy.hp -= dmg);
          }
        }
        if (g.timer >= (g.duration || 18)) {
          this.removeGadgetAt(i);
          continue;
        }
      }

      // Melusi Banshee slow effect is now computed once per frame, for every active
      // banshee_slow gadget at once, at the top of update() — see there.

      // Thorn Razorbloom
      if (g.type === 'razorbloom' && g.armed && !disabled) {
        const enemy = this.findNearbyEnemy(g.pos, g.radius, g.ownerSide, engine);
        if (enemy) {
          sound.playExplosion(g.pos, engine.player?.pos);
          if (enemy.isPlayer) {
            engine.damagePlayer ? engine.damagePlayer(65) : (engine.player.hp -= 65);
          } else {
            engine.damageUnit ? engine.damageUnit(enemy, 65) : (enemy.hp -= 65);
          }
          const msg = `[THORN] Razorbloom shrapnel detonated on enemy!`;
          engine.log ? engine.log(msg) : engine.addLog?.(msg);
          this.removeGadgetAt(i);
          continue;
        }
      }
    }
  }

  // Find enemy in range
  private findNearbyEnemy(pos: THREE.Vector3, radius: number, mySide: 'atk' | 'def', engine: any): any | null {
    if (!engine) return null;
    if (engine.player && engine.player.alive && engine.player.side !== mySide) {
      if (engine.player.pos.distanceTo(pos) <= radius) {
        return { isPlayer: true, name: engine.player.name, pos: engine.player.pos, hp: engine.player.hp };
      }
    }
    if (engine.bots) {
      for (const bot of engine.bots) {
        if (bot.alive && bot.side !== mySide) {
          const bPos = bot.mesh ? bot.mesh.position : bot.pos;
          if (bPos && bPos.distanceTo(pos) <= radius) {
            return bot;
          }
        }
      }
    }
    return null;
  }

  // Find friendly in range
  private findNearbyFriendly(pos: THREE.Vector3, radius: number, mySide: 'atk' | 'def', engine: any): any | null {
    if (!engine) return null;
    if (engine.player && engine.player.alive && engine.player.side === mySide && engine.player.hp < 100) {
      if (engine.player.pos.distanceTo(pos) <= radius) {
        return { isPlayer: true, name: engine.player.name, pos: engine.player.pos, hp: engine.player.hp };
      }
    }
    if (engine.bots) {
      for (const bot of engine.bots) {
        if (bot.alive && bot.side === mySide && bot.hp < 100) {
          const bPos = bot.mesh ? bot.mesh.position : bot.pos;
          if (bPos && bPos.distanceTo(pos) <= radius) {
            return bot;
          }
        }
      }
    }
    return null;
  }

  // Apply area damage
  private applyAreaDamage(pos: THREE.Vector3, radius: number, damage: number, engine: any, source: string) {
    if (!engine) return;
    if (engine.player && engine.player.alive && engine.player.pos.distanceTo(pos) <= radius) {
      engine.damagePlayer ? engine.damagePlayer(damage) : (engine.player.hp -= damage);
    }
    if (engine.bots) {
      for (const bot of engine.bots) {
        const bPos = bot.mesh ? bot.mesh.position : bot.pos;
        if (bot.alive && bPos && bPos.distanceTo(pos) <= radius) {
          engine.damageUnit ? engine.damageUnit(bot, damage) : (bot.hp -= damage);
        }
      }
    }
  }

  public isDisabled(gadget: ActiveGadget): boolean {
    return Boolean(gadget.isDisabled && gadget.disabledUntil !== undefined && gadget.timer < gadget.disabledUntil);
  }

  private setDisabledVisual(gadget: ActiveGadget, disabled: boolean) {
    const visuals = gadget.customData?.empVisuals || (gadget.customData = { ...(gadget.customData || {}), empVisuals: {} }).empVisuals;
    gadget.mesh.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined;
      if (!material || !('color' in material)) return;
      if (disabled) {
        if (!visuals[mesh.uuid]) {
          visuals[mesh.uuid] = { color: material.color.getHex(), emissive: ('emissive' in material && material.emissive) ? material.emissive.getHex() : undefined };
        }
        material.color.setHex(0x334155);
        if ('emissive' in material && material.emissive) material.emissive.setHex(0x000000);
      } else if (visuals[mesh.uuid]) {
        material.color.setHex(visuals[mesh.uuid].color);
        if ('emissive' in material && material.emissive && visuals[mesh.uuid].emissive !== undefined) material.emissive.setHex(visuals[mesh.uuid].emissive);
      }
    });
  }

  // EMP is a temporary state transition; it deliberately does not remove world entities.
  public disableElectronicsInRadius(pos: THREE.Vector3, radius: number, engine?: any, seconds = 8) {
    sound.playEmpDischarge();
    let disabled = 0;
    for (const g of this.gadgets) {
      if (g.isElectronic && g.pos.distanceTo(pos) <= radius) {
        g.isDisabled = true;
        g.disabledUntil = Math.max(g.disabledUntil || 0, g.timer + seconds);
        this.setDisabledVisual(g, true);
        disabled++;
      }
    }
    if (disabled > 0 && engine) {
      const msg = `[EMP] Temporarily disabled ${disabled} electronic device(s) for ${seconds}s.`;
      engine.log ? engine.log(msg) : engine.addLog?.(msg);
    }
  }

  /** Removes a live throwable before detonation when a hostile, powered ADS sees it. */
  public interceptProjectile(projectile: { ownerSide: 'atk' | 'def'; pos: THREE.Vector3; mesh: THREE.Object3D; type: string }, engine?: any): boolean {
    const interceptor = this.gadgets.find(g => g.type === 'ads_defense' && g.ownerSide !== projectile.ownerSide && !this.isDisabled(g)
      && (g.customData?.interceptionsLeft || 0) > 0 && g.pos.distanceTo(projectile.pos) <= g.radius);
    if (!interceptor) return false;
    interceptor.customData.interceptionsLeft--;
    engine?.scene?.remove(projectile.mesh);
    sound.playShockZap?.();
    engine?.log?.(`[ADS] ${interceptor.name} intercepted ${projectile.type.toUpperCase()} (${interceptor.customData.interceptionsLeft} charge(s) left).`);
    return true;
  }

  // Apply gunfire/explosive damage to a gadget by id. Returns true if the gadget was destroyed.
  public damageGadget(id: string, dmg: number, engine?: any): boolean {
    const idx = this.gadgets.findIndex(g => g.id === id);
    if (idx === -1) return false;
    const g = this.gadgets[idx];
    g.hp -= dmg;
    if (g.hp <= 0) {
      const explosiveOnDestroy = ['entry_denial', 'airjab_mine', 'razorbloom', 'gas_grenade', 'shock_wire'];
      if (explosiveOnDestroy.includes(g.type)) {
        sound.playExplosion(g.pos, engine?.player?.pos);
        this.applyAreaDamage(g.pos, Math.max(1.5, g.radius * 0.5), 30, engine, g.name);
      } else {
        sound.playShockZap?.();
      }
      const msg = `[GADGET] ${g.name} (${g.ownerSide === 'atk' ? 'ATK' : 'DEF'}) destroyed by gunfire!`;
      engine?.log ? engine.log(msg) : engine?.addLog?.(msg);
      this.removeGadgetAt(idx);
      return true;
    }
    return false;
  }

  // Find the gadget (if any) whose mesh hierarchy contains this scene object id.
  public findGadgetByObjectId(objectId: number): ActiveGadget | null {
    for (const g of this.gadgets) {
      if (g.mesh.id === objectId || g.mesh.getObjectById(objectId)) return g;
    }
    return null;
  }

  // Solid deployed gadgets (Azami's Kiba barrier, Osa's Talon shield) should physically
  // block movement like a wall, but they aren't part of the static map so engine.colliders
  // never knew about them — players and bots could walk straight through 300-450 HP
  // "barriers". This derives AABBs live from the gadgets array every call, so a destroyed
  // gadget (removeGadgetAt splices it out) automatically stops blocking on the very next
  // query — no separate collider list to keep in sync or leak.
  private readonly SOLID_GADGET_TYPES = ['kiba_barrier', 'clear_shield'];
  public getMovementColliders(): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }[] {
    const out: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }[] = [];
    for (const g of this.gadgets) {
      if (!this.SOLID_GADGET_TYPES.includes(g.type) || !g.armed) continue;
      const hw = 0.9; // half-width of the barrier footprint
      const height = 1.9;
      out.push({
        minX: g.pos.x - hw, maxX: g.pos.x + hw,
        minZ: g.pos.z - hw, maxZ: g.pos.z + hw,
        minY: g.pos.y - 0.1, maxY: g.pos.y - 0.1 + height,
      });
    }
    return out;
  }

  public removeGadgetAt(index: number) {
    const g = this.gadgets[index];
    if (g && g.mesh && this.scene) {
      this.scene.remove(g.mesh);
    }
    this.gadgets.splice(index, 1);
  }
}

export const gadgetSystem = new GadgetSystem();
