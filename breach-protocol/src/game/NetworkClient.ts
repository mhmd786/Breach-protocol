import * as THREE from 'three';
import { ModelFactory } from './ModelFactory';
import { sound } from '../audio/SoundEngine';
import { ALL_OPERATORS, getOperatorById } from './Roster';

export interface RemotePlayer {
  id: string;
  name: string;
  side: 'atk' | 'def';
  opId: string;
  opName: string;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  pitch: number;
  lean: number;
  targetLean: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  score: number;
  kills: number;
  deaths: number;
  mesh?: THREE.Group;
  nametagSprite?: THREE.Sprite;
  weaponMesh?: THREE.Object3D;
  torsoGroup?: THREE.Group;
  lastUpdate: number;
}

export class NetworkClient {
  public ws: WebSocket | null = null;
  public connected: boolean = false;
  public isMultiplayerActive: boolean = false;
  public playerId: string = '';
  public roomId: string = 'default';
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  public pingMs: number = 0;
  
  private scene: THREE.Scene | null = null;
  private engine: any = null;
  private pingInterval: any = null;
  private sendStateInterval: any = null;
  private lastPingSentTime: number = 0;

  // Event callbacks
  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onPlayerJoined?: (player: any) => void;
  public onPlayerLeft?: (playerId: string, name: string) => void;
  public onSquadChanged?: (atkHumans: number, defHumans: number) => void;
  public onChatMessage?: (senderName: string, text: string, side: 'atk' | 'def') => void;
  public onReadyStatusChanged?: (players: Record<string, any>, allReady: boolean) => void;
  public onAllPlayersReady?: () => void;

  constructor() {
    this.playerId = `op_${Math.random().toString(36).substring(2, 8)}`;
  }

  public init(scene: THREE.Scene, engine: any) {
    this.scene = scene;
    this.engine = engine;
  }

  public connect(customRoomId: string = 'default', playerName: string = 'Operator', side: 'atk' | 'def' = 'atk', opId: string = 'sledge') {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.disconnect();
    }

    this.roomId = customRoomId;
    // Allow pointing at an externally-hosted multiplayer server (needed on Vercel, since it can't
    // run the persistent WebSocket server itself). Falls back to same-origin /ws for local dev or
    // any host — like Railway/Render/Fly — that serves both the site and the socket together.
    const configuredUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
    let wsUrl: string;
    if (configuredUrl) {
      wsUrl = configuredUrl;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.isMultiplayerActive = true;
        console.log('[LAN WebSocket] Connected to server.');
        this.onConnected?.();

        const op = getOperatorById(opId);
        // Send join payload
        this.send({
          type: 'join',
          roomId: this.roomId,
          playerId: this.playerId,
          name: playerName,
          side,
          opId,
          opName: op?.name || 'Operator',
          pos: this.engine?.player?.pos || { x: 0, y: 1.6, z: side === 'atk' ? 14 : 0 },
          yaw: this.engine?.player?.yaw || 0,
          pitch: this.engine?.player?.pitch || 0
        });

        this.startSyncLoops();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('[Network Client] Error parsing WS message:', err);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.clearRemotePlayers();
        this.onDisconnected?.();
        this.stopSyncLoops();
        console.log('[LAN WebSocket] Disconnected.');
      };

      this.ws.onerror = (err) => {
        console.warn('[LAN WebSocket] Socket error:', err);
      };
    } catch (err) {
      console.error('[LAN WebSocket] Connection failed:', err);
    }
  }

  public disconnect() {
    this.stopSyncLoops();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.isMultiplayerActive = false;
    this.clearRemotePlayers();
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private startSyncLoops() {
    this.stopSyncLoops();

    // High frequency state sync to server (25Hz)
    this.sendStateInterval = setInterval(() => {
      if (!this.connected || !this.engine || !this.engine.player) return;
      const p = this.engine.player;
      this.send({
        type: 'update_state',
        roomId: this.roomId,
        pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
        yaw: p.yaw,
        pitch: p.pitch,
        lean: p.leanAmount || 0,
        hp: p.hp,
        alive: p.alive,
        opId: p.op?.id,
        opName: p.op?.name
      });
    }, 40);
  }

  private stopSyncLoops() {
    if (this.sendStateInterval) clearInterval(this.sendStateInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'init': {
        this.playerId = msg.playerId;
        this.syncPlayerList(msg.players);
        break;
      }

      case 'player_ready_status': {
        if (msg.players) {
          this.onReadyStatusChanged?.(msg.players, !!msg.allReady);
        }
        break;
      }

      case 'all_players_ready': {
        this.onAllPlayersReady?.();
        break;
      }

      case 'player_joined': {
        if (msg.player && msg.player.id !== this.playerId) {
          this.addOrUpdateRemotePlayer(msg.player);
          this.engine?.addLog?.(`[LAN] Player ${msg.player.name} (${msg.player.opName}) joined team ${msg.player.side.toUpperCase()}!`);
          this.onPlayerJoined?.(msg.player);
        }
        if (msg.players) {
          this.syncPlayerList(msg.players);
        }
        break;
      }

      case 'player_moved': {
        if (msg.playerId === this.playerId) return;
        const rp = this.remotePlayers.get(msg.playerId);
        if (rp) {
          if (msg.pos) rp.targetPos.set(msg.pos.x, msg.pos.y, msg.pos.z);
          if (msg.yaw !== undefined) rp.targetYaw = msg.yaw;
          if (msg.pitch !== undefined) rp.pitch = msg.pitch;
          if (msg.lean !== undefined) rp.targetLean = msg.lean;
          if (msg.hp !== undefined) rp.hp = msg.hp;
          if (msg.alive !== undefined) rp.alive = msg.alive;
          rp.lastUpdate = performance.now();
        }
        break;
      }

      case 'player_left': {
        if (msg.playerId && msg.playerId !== this.playerId) {
          this.removeRemotePlayer(msg.playerId);
          this.engine?.addLog?.(`[LAN] Player ${msg.playerName || 'Operative'} disconnected.`);
          this.onPlayerLeft?.(msg.playerId, msg.playerName || '');
        }
        if (msg.players) {
          this.syncPlayerList(msg.players);
        }
        break;
      }

      case 'player_shot': {
        if (msg.playerId === this.playerId) return;
        // Draw remote player bullet tracer & play audio
        if (this.engine && msg.origin && msg.dir) {
          const origin = new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z);
          const dir = new THREE.Vector3(msg.dir.x, msg.dir.y, msg.dir.z);
          this.engine.drawTracer?.(origin, dir, 35);
          sound.playGunshot('rifle');
          if (msg.impact) {
            this.engine.spawnImpact?.(new THREE.Vector3(msg.impact.x, msg.impact.y, msg.impact.z), 0xffcc44);
          }
        }
        break;
      }

      case 'player_damaged': {
        if (msg.targetId === this.playerId) {
          // Local player took damage from remote player
          this.engine?.damagePlayer?.(msg.damage);
          sound.playHitmarker();
        } else {
          const target = this.remotePlayers.get(msg.targetId);
          if (target) {
            target.hp = msg.hp;
            target.alive = msg.alive;
            this.updateNametag(target);
          }
        }
        break;
      }

      case 'gadget_deployed': {
        if (msg.ownerId === this.playerId) return;
        if (this.engine?.gadgetSystem && msg.pos) {
          const gPos = new THREE.Vector3(msg.pos.x, msg.pos.y, msg.pos.z);
          const gDir = msg.direction ? new THREE.Vector3(msg.direction.x, msg.direction.y, msg.direction.z) : new THREE.Vector3(0, 0, 1);
          this.engine.gadgetSystem.deployGadget(msg.gadgetType, msg.side, msg.ownerId, gPos, gDir, this.engine);
          this.engine.addLog?.(`[LAN] ${msg.ownerName} deployed ${msg.gadgetType}!`);
        }
        break;
      }

      case 'barricade_breached': {
        if (msg.byPlayerId === this.playerId) return;
        if (this.engine?.barricades) {
          const b = this.engine.barricades.find((barr: any) => barr.id === msg.barricadeId);
          if (b && !b.isBreached) {
            this.engine.breachBarricade?.(b, false);
          }
        }
        break;
      }

      case 'defuser_planted': {
        if (msg.planterId === this.playerId) return;
        if (this.engine) {
          this.engine.match.defuserPlanted = true;
          this.engine.match.defuserTimer = 45;
          if (msg.pos) {
            this.engine.match.defuserPos = new THREE.Vector3(msg.pos.x, msg.pos.y, msg.pos.z);
            this.engine.spawnDefuserProp?.(this.engine.match.defuserPos);
          }
          this.engine.addLog?.(`[LAN] ⚠️ DEFUSER PLANTED by ${msg.planterName}! 45s countdown!`);
          this.engine.onStateUpdate?.();
        }
        break;
      }

      case 'defuser_disabled': {
        if (this.engine) {
          this.engine.match.defuserPlanted = false;
          this.engine.match.phase = 'result';
          this.engine.match.winner = 'def';
          this.engine.addLog?.(`[LAN] 🛡️ DEFUSER DISABLED by ${msg.disablerName}! DEFENSE WINS!`);
          this.engine.onStateUpdate?.();
        }
        break;
      }

      case 'round_synced': {
        if (this.engine) {
          if (msg.phase) this.engine.match.phase = msg.phase;
          if (msg.round !== undefined) this.engine.match.round = msg.round;
          if (msg.scoreAtk !== undefined) this.engine.match.scoreAtk = msg.scoreAtk;
          if (msg.scoreDef !== undefined) this.engine.match.scoreDef = msg.scoreDef;
          this.engine.onStateUpdate?.();
        }
        break;
      }

      case 'chat_message': {
        this.onChatMessage?.(msg.senderName, msg.text, msg.side);
        this.engine?.addLog?.(`[CHAT] [${msg.side.toUpperCase()}] ${msg.senderName}: ${msg.text}`);
        break;
      }
    }
  }

  private syncPlayerList(players: Record<string, any>) {
    if (!players) return;

    // Track humans per team
    let atkHumans = 0;
    let defHumans = 0;

    Object.values(players).forEach((p: any) => {
      if (p.side === 'atk') atkHumans++;
      if (p.side === 'def') defHumans++;

      if (p.id !== this.playerId) {
        this.addOrUpdateRemotePlayer(p);
      }
    });

    // Remove any remote player no longer in list
    Array.from(this.remotePlayers.keys()).forEach(id => {
      if (!players[id]) {
        this.removeRemotePlayer(id);
      }
    });

    // Notify squad composition changed so AI bots are added or removed dynamically!
    this.onSquadChanged?.(atkHumans, defHumans);
    if (this.engine) {
      this.engine.adjustBotsForMultiplayer?.(atkHumans, defHumans);
    }
  }

  private addOrUpdateRemotePlayer(data: any) {
    let rp = this.remotePlayers.get(data.id);
    if (!rp) {
      const pos = new THREE.Vector3(data.pos?.x || 0, data.pos?.y || 1.6, data.pos?.z || 0);
      rp = {
        id: data.id,
        name: data.name || 'Operator',
        side: data.side || 'atk',
        opId: data.opId || 'sledge',
        opName: data.opName || 'Sledge',
        pos: pos.clone(),
        targetPos: pos.clone(),
        yaw: data.yaw || 0,
        targetYaw: data.yaw || 0,
        pitch: data.pitch || 0,
        lean: data.lean || 0,
        targetLean: data.lean || 0,
        hp: data.hp || 100,
        maxHp: data.maxHp || 100,
        alive: data.alive !== undefined ? data.alive : true,
        score: data.score || 0,
        kills: data.kills || 0,
        deaths: data.deaths || 0,
        lastUpdate: performance.now()
      };

      if (this.scene) {
        this.createRemotePlayerMesh(rp);
      }
      this.remotePlayers.set(data.id, rp);
    } else {
      rp.name = data.name;
      rp.side = data.side;
      rp.opId = data.opId;
      rp.opName = data.opName;
      if (data.pos) rp.targetPos.set(data.pos.x, data.pos.y, data.pos.z);
      if (data.yaw !== undefined) rp.targetYaw = data.yaw;
      if (data.hp !== undefined) rp.hp = data.hp;
      if (data.alive !== undefined) rp.alive = data.alive;
      this.updateNametag(rp);
    }
  }

  private createRemotePlayerMesh(rp: RemotePlayer) {
    if (!this.scene) return;

    const group = new THREE.Group();
    group.position.copy(rp.pos);

    // Operator model using ModelFactory
    const op = getOperatorById(rp.opId);
    const color = rp.side === 'atk' ? 0x2563eb : 0xd97706; // Blue for ATK, Amber for DEF
    const charModel = ModelFactory.createHumanoidOperator(rp.side, color, 'ar');
    group.add(charModel.root);

    // Nametag Sprite
    const nametag = this.createNametagSprite(rp.name, rp.opName, rp.side, rp.hp);
    nametag.position.set(0, 2.3, 0);
    group.add(nametag);

    this.scene.add(group);
    rp.mesh = group;
    rp.nametagSprite = nametag;
    rp.torsoGroup = charModel.torsoGroup;
  }

  private createNametagSprite(name: string, opName: string, side: 'atk' | 'def', hp: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Rounded background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 56, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = side === 'atk' ? '#38bdf8' : '#fbbf24';
      ctx.stroke();

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(name.toUpperCase(), 128, 34);

      ctx.fillStyle = side === 'atk' ? '#7dd3fc' : '#fde68a';
      ctx.font = '14px sans-serif';
      ctx.fillText(`${opName} [${Math.round(hp)} HP]`, 128, 52);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.0, 0.6, 1.0);
    return sprite;
  }

  private updateNametag(rp: RemotePlayer) {
    if (!rp.nametagSprite) return;
    const sprite = rp.nametagSprite;
    const mat = sprite.material as THREE.SpriteMaterial;
    if (mat.map) {
      const canvas = mat.map.image as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(8, 8, 240, 56, 12);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = rp.side === 'atk' ? '#38bdf8' : '#fbbf24';
        ctx.stroke();

        ctx.fillStyle = rp.alive ? '#ffffff' : '#ef4444';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(rp.alive ? rp.name.toUpperCase() : `[KIA] ${rp.name.toUpperCase()}`, 128, 34);

        ctx.fillStyle = rp.side === 'atk' ? '#7dd3fc' : '#fde68a';
        ctx.font = '14px sans-serif';
        ctx.fillText(`${rp.opName} [${Math.max(0, Math.round(rp.hp))} HP]`, 128, 52);
        mat.map.needsUpdate = true;
      }
    }
  }

  private removeRemotePlayer(id: string) {
    const rp = this.remotePlayers.get(id);
    if (rp && rp.mesh && this.scene) {
      this.scene.remove(rp.mesh);
    }
    this.remotePlayers.delete(id);
  }

  private clearRemotePlayers() {
    this.remotePlayers.forEach(rp => {
      if (rp.mesh && this.scene) {
        this.scene.remove(rp.mesh);
      }
    });
    this.remotePlayers.clear();
  }

  // Update remote players every animation frame
  public update(dt: number) {
    this.remotePlayers.forEach(rp => {
      if (!rp.mesh) return;

      // Smooth interpolation of position and rotation
      const lerpSpeed = Math.min(1.0, dt * 14.0);
      rp.pos.lerp(rp.targetPos, lerpSpeed);
      rp.mesh.position.copy(rp.pos);

      // Smooth yaw
      let diffYaw = rp.targetYaw - rp.yaw;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      rp.yaw += diffYaw * lerpSpeed;
      rp.mesh.rotation.y = rp.yaw;

      // Lean tilt
      rp.lean += (rp.targetLean - rp.lean) * lerpSpeed;
      if (rp.torsoGroup) {
        rp.torsoGroup.rotation.z = -rp.lean * 0.2;
      }

      // Visibility based on alive status
      rp.mesh.visible = rp.alive;
    });
  }

  // Broadcast local actions to server
  public notifyShot(origin: THREE.Vector3, dir: THREE.Vector3, weaponId: string, impact?: THREE.Vector3) {
    if (!this.connected) return;
    this.send({
      type: 'shoot',
      roomId: this.roomId,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: dir.x, y: dir.y, z: dir.z },
      weaponId,
      impact: impact ? { x: impact.x, y: impact.y, z: impact.z } : undefined
    });
  }

  public notifyDamage(targetPlayerId: string, damage: number) {
    if (!this.connected) return;
    this.send({
      type: 'damage_event',
      roomId: this.roomId,
      targetId: targetPlayerId,
      damage
    });
  }

  public notifyGadgetDeploy(gadgetType: string, pos: THREE.Vector3, direction?: THREE.Vector3) {
    if (!this.connected) return;
    this.send({
      type: 'deploy_gadget',
      roomId: this.roomId,
      gadgetType,
      side: this.engine?.player?.side || 'atk',
      pos: { x: pos.x, y: pos.y, z: pos.z },
      direction: direction ? { x: direction.x, y: direction.y, z: direction.z } : undefined
    });
  }

  public notifyBarricadeBreach(barricadeId: string, pos: THREE.Vector3, normal: THREE.Vector3) {
    if (!this.connected) return;
    this.send({
      type: 'breach_barricade',
      roomId: this.roomId,
      barricadeId,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      normal: { x: normal.x, y: normal.y, z: normal.z }
    });
  }

  public notifyDefuserAction(action: 'plant' | 'disable' | 'defuse', pos?: THREE.Vector3) {
    if (!this.connected) return;
    this.send({
      type: 'defuser_action',
      roomId: this.roomId,
      action: action === 'defuse' ? 'disable' : action,
      pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : undefined
    });
  }

  public setReady(isReady: boolean, opId: string, opName: string, side: 'atk' | 'def') {
    if (!this.connected) return;
    this.send({
      type: 'player_ready',
      roomId: this.roomId,
      isReady,
      opId,
      opName,
      side
    });
  }

  public sendChat(text: string) {
    if (!this.connected || !text.trim()) return;
    this.send({
      type: 'chat',
      roomId: this.roomId,
      text: text.trim()
    });
  }
}

export const networkClient = new NetworkClient();
