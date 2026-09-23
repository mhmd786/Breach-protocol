import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface NetworkPlayer {
  id: string;
  name: string;
  side: 'atk' | 'def';
  opId: string;
  opName: string;
  isReady: boolean;
  pos: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  lean: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  isHost: boolean;
  score: number;
  kills: number;
  deaths: number;
  lastUpdate: number;
}

interface MatchRoomState {
  roomId: string;
  phase: 'prep' | 'action' | 'result' | 'matchover';
  phaseTimer: number;
  round: number;
  scoreAtk: number;
  scoreDef: number;
  defuserPlanted: boolean;
  defuserTimer: number;
  defuserPos: { x: number; y: number; z: number } | null;
  winner: 'atk' | 'def' | null;
  players: Record<string, NetworkPlayer>;
  breachedBarricades: string[];
  mapKey: string;
  difficulty: 'Easy' | 'Normal' | 'Hard';
  gameMode: 'quick' | 'ranked';
  hostId?: string;
}

const app = express();
const server = http.createServer(app);
// Most cloud hosts (Render, Railway, Fly.io, etc.) assign a random port via
// process.env.PORT and expect the app to bind to it — a hardcoded 3000 would
// fail to bind on those platforms. Falls back to 3000 for local/LAN use.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Match rooms storage
const rooms: Record<string, MatchRoomState> = {};
const clientRooms = new Map<WebSocket, { roomId: string; playerId: string }>();

// Seed default active matchmaking lobbies with predetermined maps & difficulty
const INITIAL_LOBBY_CONFIGS: Record<string, { mapKey: string; difficulty: 'Easy' | 'Normal' | 'Hard'; gameMode: 'quick' | 'ranked' }> = {
  'default': { mapKey: 'suburban_house', difficulty: 'Normal', gameMode: 'quick' },
  'casual-squad': { mapKey: 'warehouse', difficulty: 'Easy', gameMode: 'quick' },
  'ranked-alpha': { mapKey: 'office_tower', difficulty: 'Hard', gameMode: 'ranked' },
  'tactical-house': { mapKey: 'suburban_house', difficulty: 'Hard', gameMode: 'ranked' },
};

Object.entries(INITIAL_LOBBY_CONFIGS).forEach(([id, cfg]) => {
  rooms[id] = {
    roomId: id,
    phase: 'prep',
    phaseTimer: 30,
    round: 1,
    scoreAtk: 0,
    scoreDef: 0,
    defuserPlanted: false,
    defuserTimer: 45,
    defuserPos: null,
    winner: null,
    players: {},
    breachedBarricades: [],
    mapKey: cfg.mapKey,
    difficulty: cfg.difficulty,
    gameMode: cfg.gameMode
  };
});

function getOrCreateRoom(
  roomId: string = 'default',
  mapKey: string = 'suburban_house',
  difficulty: 'Easy' | 'Normal' | 'Hard' = 'Normal',
  gameMode: 'quick' | 'ranked' = 'quick'
): MatchRoomState {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      roomId,
      phase: 'prep',
      phaseTimer: 30,
      round: 1,
      scoreAtk: 0,
      scoreDef: 0,
      defuserPlanted: false,
      defuserTimer: 45,
      defuserPos: null,
      winner: null,
      players: {},
      breachedBarricades: [],
      mapKey,
      difficulty,
      gameMode
    };
  }
  return rooms[roomId];
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// Returns all active available lobbies for online matchmaking
app.get('/api/lobbies', (req, res) => {
  const mapDisplayNames: Record<string, string> = {
    suburban_house: 'Suburban Villa (2F House)',
    warehouse: 'Warehouse District',
    office_tower: 'Highrise Office Tower'
  };

  const lobbyList = Object.values(rooms).map(room => {
    const playersList = Object.values(room.players);
    const host = playersList.find(p => p.isHost)?.name || playersList[0]?.name || 'Automated Server';
    const atkCount = playersList.filter(p => p.side === 'atk').length;
    const defCount = playersList.filter(p => p.side === 'def').length;

    return {
      roomId: room.roomId,
      playerCount: playersList.length,
      maxPlayers: 10,
      atkCount,
      defCount,
      phase: room.phase,
      round: room.round,
      scoreAtk: room.scoreAtk,
      scoreDef: room.scoreDef,
      hostName: host,
      mapName: mapDisplayNames[room.mapKey] || room.mapKey,
      mapKey: room.mapKey,
      difficulty: room.difficulty,
      gameMode: room.gameMode,
      ping: Math.floor(12 + Math.random() * 15)
    };
  });

  res.json({ lobbies: lobbyList, totalActiveLobbies: lobbyList.length });
});

app.post('/api/lobbies/create', (req, res) => {
  const { roomId, mapKey, difficulty, gameMode } = req.body;
  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ error: 'Invalid room name' });
  }
  const cleanRoomId = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const validMap = ['suburban_house', 'warehouse', 'office_tower'].includes(mapKey) ? mapKey : 'suburban_house';
  const validDiff = ['Easy', 'Normal', 'Hard'].includes(difficulty) ? difficulty : 'Normal';
  const validMode = gameMode === 'ranked' ? 'ranked' : 'quick';

  const room = getOrCreateRoom(cleanRoomId, validMap, validDiff, validMode);
  res.json({
    success: true,
    room: {
      roomId: room.roomId,
      mapKey: room.mapKey,
      difficulty: room.difficulty,
      gameMode: room.gameMode,
      playerCount: Object.keys(room.players).length
    }
  });
});

app.get('/api/lan/info', (req, res) => {
  const defaultRoom = getOrCreateRoom('default');
  const atkPlayers = Object.values(defaultRoom.players).filter(p => p.side === 'atk');
  const defPlayers = Object.values(defaultRoom.players).filter(p => p.side === 'def');

  res.json({
    roomId: 'default',
    totalPlayers: Object.keys(defaultRoom.players).length,
    atkCount: atkPlayers.length,
    defCount: defPlayers.length,
    atkBots: Math.max(0, 5 - atkPlayers.length),
    defBots: Math.max(0, 5 - defPlayers.length),
    phase: defaultRoom.phase,
    round: defaultRoom.round,
    scoreAtk: defaultRoom.scoreAtk,
    scoreDef: defaultDefScore(defaultRoom)
  });
});

function defaultDefScore(room: MatchRoomState): number {
  return room.scoreDef;
}

// Attach WebSocket Server for Real-Time LAN Multiplayer
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const json = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      const info = clientRooms.get(client);
      if (info && info.roomId === roomId) {
        client.send(json);
      }
    }
  });
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId = 'default';
  let playerId = `player_${Math.random().toString(36).substring(2, 9)}`;

  ws.on('message', (rawData: string) => {
    try {
      const msg = JSON.parse(rawData.toString());
      const type = msg.type;
      const room = getOrCreateRoom(msg.roomId || currentRoomId);
      currentRoomId = room.roomId;

      switch (type) {
        case 'join': {
          playerId = msg.playerId || playerId;
          clientRooms.set(ws, { roomId: currentRoomId, playerId });

          const side: 'atk' | 'def' = msg.side || 'atk';
          const opId: string = msg.opId || 'sledge';
          const opName: string = msg.opName || 'Sledge';
          const playerName: string = msg.name || `Operator ${Object.keys(room.players).length + 1}`;
          const isFirstPlayer = Object.keys(room.players).length === 0;

          room.players[playerId] = {
            id: playerId,
            name: playerName,
            side,
            opId,
            opName,
            isReady: !!msg.isReady,
            pos: msg.pos || { x: 0, y: 1.6, z: side === 'atk' ? 14 : 0 },
            yaw: msg.yaw || 0,
            pitch: msg.pitch || 0,
            lean: 0,
            hp: 100,
            maxHp: 100,
            alive: true,
            isHost: isFirstPlayer,
            score: 0,
            kills: 0,
            deaths: 0,
            lastUpdate: Date.now()
          };

          // Send init response to this joining client
          ws.send(JSON.stringify({
            type: 'init',
            playerId,
            roomId: currentRoomId,
            roomState: {
              phase: room.phase,
              phaseTimer: room.phaseTimer,
              round: room.round,
              scoreAtk: room.scoreAtk,
              scoreDef: room.scoreDef,
              defuserPlanted: room.defuserPlanted,
              defuserTimer: room.defuserTimer,
              defuserPos: room.defuserPos,
              breachedBarricades: room.breachedBarricades,
              mapKey: room.mapKey,
              difficulty: room.difficulty,
              gameMode: room.gameMode
            },
            isHost: isFirstPlayer,
            players: room.players
          }));

          // Broadcast to all other players in room
          broadcastToRoom(currentRoomId, {
            type: 'player_joined',
            player: room.players[playerId],
            players: room.players
          }, ws);

          console.log(`[LAN] Player ${playerName} (${playerId}) joined team ${side.toUpperCase()} in room ${currentRoomId}`);
          break;
        }

        case 'player_ready': {
          const p = room.players[playerId];
          if (p) {
            p.isReady = !!msg.isReady;
            if (msg.opId) p.opId = msg.opId;
            if (msg.opName) p.opName = msg.opName;
            if (msg.side) p.side = msg.side;

            const allPlayers = Object.values(room.players);
            const allReady = allPlayers.length > 0 && allPlayers.every(pl => pl.isReady);

            broadcastToRoom(currentRoomId, {
              type: 'player_ready_status',
              playerId,
              isReady: p.isReady,
              opId: p.opId,
              opName: p.opName,
              side: p.side,
              players: room.players,
              allReady
            });

            if (allReady) {
              console.log(`[LAN] All ${allPlayers.length} real players ready in room ${currentRoomId}! Starting match...`);
              broadcastToRoom(currentRoomId, {
                type: 'all_players_ready',
                roomId: currentRoomId,
                players: room.players
              });
            }
          }
          break;
        }

        case 'update_room_settings': {
          const p = room.players[playerId];
          if (p && p.isHost) {
            if (msg.mapKey) room.mapKey = msg.mapKey;
            if (msg.difficulty) room.difficulty = msg.difficulty;
            if (msg.gameMode) room.gameMode = msg.gameMode;
            broadcastToRoom(currentRoomId, {
              type: 'room_settings_updated',
              mapKey: room.mapKey,
              difficulty: room.difficulty,
              gameMode: room.gameMode
            });
          }
          break;
        }

        case 'update_state': {
          const p = room.players[playerId];
          if (p) {
            if (msg.pos) p.pos = msg.pos;
            if (msg.yaw !== undefined) p.yaw = msg.yaw;
            if (msg.pitch !== undefined) p.pitch = msg.pitch;
            if (msg.lean !== undefined) p.lean = msg.lean;
            if (msg.hp !== undefined) p.hp = msg.hp;
            if (msg.alive !== undefined) p.alive = msg.alive;
            if (msg.opId) p.opId = msg.opId;
            if (msg.opName) p.opName = msg.opName;
            p.lastUpdate = Date.now();

            broadcastToRoom(currentRoomId, {
              type: 'player_moved',
              playerId,
              pos: p.pos,
              yaw: p.yaw,
              pitch: p.pitch,
              lean: p.lean,
              hp: p.hp,
              alive: p.alive
            }, ws);
          }
          break;
        }

        case 'shoot': {
          broadcastToRoom(currentRoomId, {
            type: 'player_shot',
            playerId,
            origin: msg.origin,
            dir: msg.dir,
            weaponId: msg.weaponId,
            impact: msg.impact
          }, ws);
          break;
        }

        case 'damage_event': {
          const targetId = msg.targetId;
          const dmg = msg.damage || 20;
          if (targetId && room.players[targetId]) {
            const target = room.players[targetId];
            target.hp = Math.max(0, target.hp - dmg);
            if (target.hp <= 0) {
              target.alive = false;
              target.deaths++;
              if (room.players[playerId]) {
                room.players[playerId].kills++;
                room.players[playerId].score += 100;
              }
            }
            broadcastToRoom(currentRoomId, {
              type: 'player_damaged',
              targetId,
              attackerId: playerId,
              damage: dmg,
              hp: target.hp,
              alive: target.alive,
              attackerKills: room.players[playerId]?.kills || 0
            });
          }
          break;
        }

        case 'deploy_gadget': {
          broadcastToRoom(currentRoomId, {
            type: 'gadget_deployed',
            gadgetType: msg.gadgetType,
            side: msg.side,
            ownerId: playerId,
            ownerName: room.players[playerId]?.name || 'Operative',
            pos: msg.pos,
            direction: msg.direction
          });
          break;
        }

        case 'breach_barricade': {
          if (msg.barricadeId && !room.breachedBarricades.includes(msg.barricadeId)) {
            room.breachedBarricades.push(msg.barricadeId);
          }
          broadcastToRoom(currentRoomId, {
            type: 'barricade_breached',
            barricadeId: msg.barricadeId,
            pos: msg.pos,
            normal: msg.normal,
            byPlayerId: playerId
          });
          break;
        }

        case 'defuser_action': {
          if (msg.action === 'plant') {
            room.defuserPlanted = true;
            room.defuserTimer = 45;
            room.defuserPos = msg.pos;
            broadcastToRoom(currentRoomId, {
              type: 'defuser_planted',
              pos: msg.pos,
              planterId: playerId,
              planterName: room.players[playerId]?.name || 'Attacker'
            });
          } else if (msg.action === 'disable') {
            room.defuserPlanted = false;
            room.winner = 'def';
            broadcastToRoom(currentRoomId, {
              type: 'defuser_disabled',
              disablerId: playerId,
              disablerName: room.players[playerId]?.name || 'Defender'
            });
          }
          break;
        }

        case 'round_update': {
          if (msg.phase) room.phase = msg.phase;
          if (msg.round !== undefined) room.round = msg.round;
          if (msg.scoreAtk !== undefined) room.scoreAtk = msg.scoreAtk;
          if (msg.scoreDef !== undefined) room.scoreDef = msg.scoreDef;
          if (msg.winner !== undefined) room.winner = msg.winner;
          if (msg.defuserPlanted !== undefined) room.defuserPlanted = msg.defuserPlanted;
          if (msg.resetBarricades) room.breachedBarricades = [];

          broadcastToRoom(currentRoomId, {
            type: 'round_synced',
            phase: room.phase,
            round: room.round,
            scoreAtk: room.scoreAtk,
            scoreDef: room.scoreDef,
            winner: room.winner,
            defuserPlanted: room.defuserPlanted
          }, ws);
          break;
        }

        case 'chat': {
          broadcastToRoom(currentRoomId, {
            type: 'chat_message',
            senderId: playerId,
            senderName: room.players[playerId]?.name || 'Operative',
            side: room.players[playerId]?.side || 'atk',
            text: msg.text || ''
          });
          break;
        }
      }
    } catch (err) {
      console.error('[WS Error]', err);
    }
  });

  ws.on('close', () => {
    const info = clientRooms.get(ws);
    if (info) {
      const { roomId, playerId } = info;
      const room = rooms[roomId];
      if (room && room.players[playerId]) {
        const leavingPlayer = room.players[playerId];
        delete room.players[playerId];
        broadcastToRoom(roomId, {
          type: 'player_left',
          playerId,
          playerName: leavingPlayer.name,
          side: leavingPlayer.side,
          players: room.players
        });
        console.log(`[LAN] Player ${leavingPlayer.name} (${playerId}) disconnected from ${roomId}`);
      }
      clientRooms.delete(ws);
    }
  });
});

// Vite middleware for dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[BREACH PROTOCOL] Tactical Server & LAN WebSocket running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
