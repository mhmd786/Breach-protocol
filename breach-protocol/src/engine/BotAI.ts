import * as THREE from 'three';
import { PlayerState, Team } from '../types/game';
import { DestructionEngine } from './DestructionEngine';
import { sound } from '../audio/SoundEngine';

export type BotTacticalRole = 'anchor' | 'roamer' | 'breacher' | 'flanker';

export interface BotController {
  player: PlayerState;
  role: BotTacticalRole;
  targetPos: THREE.Vector3;
  targetEnemy: PlayerState | null;
  state: 'prep_reinforce' | 'patrol' | 'approach_entry' | 'breach_entry' | 'clear_room' | 'push_objective' | 'engage' | 'investigate_sound';
  stateTimer: number;
  reactionTimer: number;
  shootCooldown: number;
  reloadTimer: number;
  investigationPoint: THREE.Vector3 | null;
  meshGroup: THREE.Group;
  weaponMount: THREE.Group;
  flashMesh: THREE.Mesh;
}

export class BotAIEngine {
  public bots: BotController[] = [];
  private destruction: DestructionEngine;

  constructor(destruction: DestructionEngine) {
    this.destruction = destruction;
  }

  public registerBot(
    player: PlayerState,
    meshGroup: THREE.Group,
    weaponMount: THREE.Group,
    flashMesh: THREE.Mesh
  ): BotController {
    const role: BotTacticalRole = player.team === 'defenders'
      ? (Math.random() > 0.4 ? 'anchor' : 'roamer')
      : (Math.random() > 0.4 ? 'breacher' : 'flanker');

    const bot: BotController = {
      player,
      role,
      targetPos: new THREE.Vector3(player.pos.x, player.pos.y, player.pos.z),
      targetEnemy: null,
      state: player.team === 'defenders' ? 'prep_reinforce' : 'approach_entry',
      stateTimer: 0,
      reactionTimer: 0,
      shootCooldown: 0,
      reloadTimer: 0,
      investigationPoint: null,
      meshGroup,
      weaponMount,
      flashMesh,
    };

    this.bots.push(bot);
    return bot;
  }

  // Tactical AI Update loop
  public update(
    delta: number,
    phase: string,
    allPlayers: PlayerState[],
    onBotShoot: (bot: BotController, targetHit: PlayerState | null, isHeadshot: boolean) => void
  ) {
    for (const bot of this.bots) {
      if (!bot.player.isAlive) continue;

      bot.stateTimer += delta;
      bot.shootCooldown -= delta;
      bot.reactionTimer -= delta;

      // Reset third person muzzle flash
      if (bot.flashMesh.visible) {
        bot.flashMesh.visible = false;
      }

      // 1. SCAN FOR ENEMIES (Line of Sight with tactical vision cone)
      this.scanForTargets(bot, allPlayers);

      // 2. STATE LOGIC ACCORDING TO MATCH PHASE
      if (phase === 'drone_prep') {
        this.handlePrepPhase(bot, delta);
      } else {
        this.handleActionPhase(bot, delta, onBotShoot);
      }

      // 3. MOVE & ORIENT CHARACTER MODEL
      this.moveBot(bot, delta);
    }
  }

  // Handle Defender prep phase (reinforce walls, set up angles)
  private handlePrepPhase(bot: BotController, delta: number) {
    if (bot.player.team === 'attackers') {
      // Attackers stay outside in spawn holding position or testing drone
      return;
    }

    // Defender prep behavior
    if (bot.state === 'prep_reinforce') {
      if (bot.player.reinforcedWallsRemaining > 0) {
        // Find nearby unreinforced soft wall
        for (const [id, seg] of this.destruction.wallSegments) {
          if (!seg.isDestroyed && !seg.isReinforced && seg.material !== 'structural') {
            const dist = bot.meshGroup.position.distanceTo(new THREE.Vector3(seg.center.x, seg.center.y, seg.center.z));
            if (dist < 3.0) {
              // Reinforce it!
              this.destruction.reinforceWall(id, bot.player.pos);
              bot.player.reinforcedWallsRemaining--;
              break;
            } else if (dist < 12.0) {
              bot.targetPos.set(seg.center.x, seg.center.y - seg.size.height / 2, seg.center.z);
              break;
            }
          }
        }
      } else {
        // Switch to anchor/patrol site position
        bot.state = 'patrol';
        bot.targetPos.set(bot.role === 'anchor' ? -6 : 4, 0.2, bot.role === 'anchor' ? -6 : 6);
      }
    }
  }

  // Handle combat / infiltration / room clearing
  private handleActionPhase(
    bot: BotController,
    delta: number,
    onBotShoot: (bot: BotController, targetHit: PlayerState | null, isHeadshot: boolean) => void
  ) {
    const bPos = bot.meshGroup.position;

    // A. ENGAGING ENEMY
    if (bot.targetEnemy && bot.targetEnemy.isAlive) {
      const ePos = new THREE.Vector3(bot.targetEnemy.pos.x, bot.targetEnemy.pos.y, bot.targetEnemy.pos.z);
      const toEnemy = new THREE.Vector3().subVectors(ePos, bPos);
      const dist = toEnemy.length();

      // Look at target
      const lookYaw = Math.atan2(toEnemy.x, toEnemy.z);
      bot.meshGroup.rotation.y = lookYaw;
      bot.player.rot.yaw = lookYaw;

      // Point weapon mount towards target elevation
      const pitch = Math.atan2(ePos.y - (bPos.y + 1.4), dist);
      bot.weaponMount.rotation.x = -pitch;

      // Tactical peek / lean
      if (Math.sin(bot.stateTimer * 2) > 0.5) {
        bot.player.leanAngle = 0.6; // peek right
      } else {
        bot.player.leanAngle = 0;
      }

      // Fire weapon
      if (bot.shootCooldown <= 0 && dist < 35) {
        bot.shootCooldown = 0.12 + Math.random() * 0.18; // Burst fire rate
        bot.flashMesh.visible = true;

        sound.playGunshot('rifle', bot.player.pos);

        // Accuracy check (accuracy depends on distance)
        const hitChance = Math.max(0.2, 0.75 - (dist / 40));
        const didHit = Math.random() < hitChance;
        const isHeadshot = didHit && Math.random() < 0.25;

        onBotShoot(bot, didHit ? bot.targetEnemy : null, isHeadshot);
      }

      // Reposition during combat (strafe or find cover)
      if (dist < 6) {
        // Back up slightly
        bot.targetPos.addScaledVector(toEnemy.normalize(), -1.5);
      }
      return;
    }

    // B. INVESTIGATING SOUND
    if (bot.state === 'investigate_sound' && bot.investigationPoint) {
      bot.targetPos.copy(bot.investigationPoint);
      if (bPos.distanceTo(bot.investigationPoint) < 2.5 || bot.stateTimer > 8) {
        bot.investigationPoint = null;
        bot.state = bot.player.team === 'attackers' ? 'push_objective' : 'patrol';
      }
      return;
    }

    // C. ATTACKER INFILTRATION & BREACHING LOOP
    if (bot.player.team === 'attackers') {
      const isOutside = Math.abs(bPos.x) > 17 || Math.abs(bPos.z) > 17;

      if (isOutside) {
        // Approach nearest window or door to enter
        let nearestDoorDist = 999;
        let bestTarget = new THREE.Vector3(0, 0.2, -16);

        this.destruction.doorsAndWindows.forEach((item) => {
          if (item.isExterior) {
            const dPos = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
            const dist = bPos.distanceTo(dPos);
            if (dist < nearestDoorDist) {
              nearestDoorDist = dist;
              bestTarget = dPos;
            }
          }
        });

        bot.targetPos.copy(bestTarget);

        // If close to barricaded exterior door/window, breach it!
        if (nearestDoorDist < 3.2) {
          this.destruction.doorsAndWindows.forEach((item, id) => {
            if (item.isExterior && item.state !== 'destroyed') {
              const dPos = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
              if (bPos.distanceTo(dPos) < 3.5) {
                // Shoot or breach barricade
                this.destruction.damageDoorOrWindow(id, 60, bot.player.pos);
              }
            }
          });
        }
      } else {
        // Inside building: Room clearing & push Site A or B
        const siteA = new THREE.Vector3(-6, 0.2, -6);
        const siteB = new THREE.Vector3(5, 4.2, 5);
        bot.targetPos.copy(bot.role === 'breacher' ? siteA : siteB);
      }
    } else {
      // D. DEFENDER DEFENSIVE PATROL & ANCHORING
      const sitePos = bot.role === 'anchor'
        ? new THREE.Vector3(-6, 0.2, -6)
        : new THREE.Vector3(4, 4.2, 4);

      if (bPos.distanceTo(sitePos) > 7) {
        bot.targetPos.copy(sitePos);
      } else if (bot.stateTimer > 4) {
        // Shift patrol angle around objective site
        bot.stateTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.5 + Math.random() * 3.5;
        bot.targetPos.set(sitePos.x + Math.cos(angle) * radius, sitePos.y, sitePos.z + Math.sin(angle) * radius);
      }
    }
  }

  // Scan for enemies using distance & Raycast vision checks
  private scanForTargets(bot: BotController, allPlayers: PlayerState[]) {
    bot.targetEnemy = null;
    const bPos = bot.meshGroup.position;
    let closestDist = 38;

    for (const other of allPlayers) {
      if (!other.isAlive || other.team === bot.player.team) continue;

      const ePos = new THREE.Vector3(other.pos.x, other.pos.y, other.pos.z);
      const dist = bPos.distanceTo(ePos);
      if (dist > closestDist) continue;

      // Check field of view
      const toOther = new THREE.Vector3().subVectors(ePos, bPos).normalize();
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bot.meshGroup.rotation.y);
      const dot = forward.dot(toOther);

      // Vision cone (approx 140 degrees)
      if (dot > 0.2 || dist < 4) {
        // Raycast check: ensure no solid unbroken walls block line of sight
        const eyeOrigin = new THREE.Vector3(bPos.x, bPos.y + 1.6, bPos.z);
        const hit = this.destruction.checkRayCollision(eyeOrigin, toOther, dist);
        if (!hit || hit.dist >= dist - 0.5) {
          closestDist = dist;
          bot.targetEnemy = other;
        }
      }
    }
  }

  // React to audio events (gunfire, explosions, footsteps)
  public alertSoundEvent(soundPos: THREE.Vector3, soundTeam?: Team) {
    for (const bot of this.bots) {
      if (!bot.player.isAlive) continue;
      // If sound is from an enemy team or unassigned
      if (!soundTeam || soundTeam !== bot.player.team) {
        const dist = bot.meshGroup.position.distanceTo(soundPos);
        if (dist < 28) {
          // Hearing range: bots investigate nearby gunfire/explosions
          bot.investigationPoint = soundPos.clone();
          bot.state = 'investigate_sound';
          bot.stateTimer = 0;
        }
      }
    }
  }

  // Move bot smoothly towards targetPos with collision avoidance
  private moveBot(bot: BotController, delta: number) {
    const curPos = bot.meshGroup.position;
    const toTarget = new THREE.Vector3().subVectors(bot.targetPos, curPos);
    toTarget.y = 0; // maintain floor plane
    const dist = toTarget.length();

    if (dist > 0.4) {
      toTarget.normalize();
      const speed = bot.player.isSprinting ? 4.8 : 3.4;
      const moveStep = toTarget.clone().multiplyScalar(speed * delta);
      const newPos = curPos.clone().add(moveStep);

      // Check collision with unbroken walls
      if (!this.destruction.checkPointCollision(newPos, 0.4, 1.8)) {
        curPos.copy(newPos);
      } else {
        // Wall collision slide: try X or Z separately
        const posX = curPos.clone().add(new THREE.Vector3(moveStep.x, 0, 0));
        if (!this.destruction.checkPointCollision(posX, 0.4, 1.8)) {
          curPos.x = posX.x;
        } else {
          const posZ = curPos.clone().add(new THREE.Vector3(0, 0, moveStep.z));
          if (!this.destruction.checkPointCollision(posZ, 0.4, 1.8)) {
            curPos.z = posZ.z;
          }
        }
      }

      // Face movement direction if not actively aiming at enemy
      if (!bot.targetEnemy) {
        const yaw = Math.atan2(toTarget.x, toTarget.z);
        bot.meshGroup.rotation.y = yaw;
        bot.player.rot.yaw = yaw;
      }
    }

    // Sync player position struct
    bot.player.pos.x = curPos.x;
    bot.player.pos.y = curPos.y;
    bot.player.pos.z = curPos.z;
  }
}
