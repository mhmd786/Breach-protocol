import React, { useState, useEffect } from 'react';
import { Globe, Users, RefreshCw, Plus, Shield, Zap, Info, Server, CheckCircle2 } from 'lucide-react';

export interface LobbyInfo {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  atkCount: number;
  defCount: number;
  phase: string;
  round: number;
  scoreAtk: number;
  scoreDef: number;
  hostName: string;
  mapName: string;
  mapKey?: string;
  difficulty?: 'Easy' | 'Normal' | 'Hard';
  gameMode?: 'quick' | 'ranked';
  ping: number;
}

interface MatchmakingBrowserProps {
  selectedRoomId: string;
  onSelectRoom: (roomId: string, lobbyInfo?: LobbyInfo) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  currentMode: 'quick' | 'ranked';
  onModeChanged?: (mode: 'quick' | 'ranked') => void;
}

export const MatchmakingBrowser: React.FC<MatchmakingBrowserProps> = ({
  selectedRoomId,
  onSelectRoom,
  playerName,
  setPlayerName,
  currentMode,
  onModeChanged
}) => {
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newLobbyName, setNewLobbyName] = useState<string>('');
  const [newLobbyMap, setNewLobbyMap] = useState<string>('suburban_house');
  const [newLobbyDiff, setNewLobbyDiff] = useState<'Easy' | 'Normal' | 'Hard'>('Normal');
  const [newLobbyMode, setNewLobbyMode] = useState<'quick' | 'ranked'>('quick');
  const [showCreateOptions, setShowCreateOptions] = useState<boolean>(false);
  const [serverOnline, setServerOnline] = useState<boolean>(true);

  const fetchLobbies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lobbies');
      if (res.ok) {
        const data = await res.json();
        setLobbies(data.lobbies || []);
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch (err) {
      console.warn('Failed to fetch online lobbies:', err);
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLobbyName.trim()) return;

    const formatted = newLobbyName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    try {
      const res = await fetch('/api/lobbies/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: formatted,
          mapKey: newLobbyMap,
          difficulty: newLobbyDiff,
          gameMode: newLobbyMode
        })
      });
      if (res.ok) {
        const data = await res.json();
        onSelectRoom(formatted, {
          roomId: formatted,
          playerCount: 1,
          maxPlayers: 10,
          atkCount: 1,
          defCount: 0,
          phase: 'prep',
          round: 1,
          scoreAtk: 0,
          scoreDef: 0,
          hostName: playerName,
          mapName: newLobbyMap === 'warehouse' ? 'Warehouse District' : (newLobbyMap === 'office_tower' ? 'Highrise Office Tower' : 'Suburban Villa'),
          mapKey: newLobbyMap,
          difficulty: newLobbyDiff,
          gameMode: newLobbyMode,
          ping: 12
        });
        setNewLobbyName('');
        setShowCreateOptions(false);
        fetchLobbies();
      }
    } catch (err) {
      console.error('Error creating lobby:', err);
    }
  };

  const handleQuickMatch = () => {
    if (lobbies.length > 0) {
      const matchesMode = lobbies.filter(l => (l.gameMode || 'quick') === currentMode);
      const candidates = matchesMode.length > 0 ? matchesMode : lobbies;
      const sorted = [...candidates].sort((a, b) => b.playerCount - a.playerCount);
      const available = sorted.find(l => l.playerCount < l.maxPlayers);
      if (available) {
        onSelectRoom(available.roomId, available);
        return;
      }
    }
    onSelectRoom('default');
  };

  return (
    <div className="bg-[#0c1622]/95 border border-[#38bdf8]/30 rounded-xl p-4 flex flex-col gap-3 shadow-2xl backdrop-blur-md">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#060e17] border border-[#23455a] rounded-lg p-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#0284c7]/20 border border-[#38bdf8]/40 rounded-lg text-[#38bdf8]">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-black text-[#7fd6ff] tracking-wider uppercase">
                ONLINE MATCHMAKING & LOBBY BROWSER
              </h3>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${serverOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'}`}>
                {serverOnline ? '● SERVER ONLINE' : '○ SERVER RECONNECTING'}
              </span>
            </div>
            <p className="text-[11px] text-[#9ab] font-sans">
              Connect with players via Cloud Run WebSocket server or LAN networks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLobbies}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0284c7]/20 hover:bg-[#0284c7]/40 text-[#7fd6ff] border border-[#38bdf8]/40 rounded-md font-mono text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
          <button
            onClick={handleQuickMatch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/50 rounded-md font-mono text-xs font-black tracking-wide shadow-lg transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            QUICK MATCH
          </button>
        </div>
      </div>

      {/* Available Lobbies List */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs text-gray-400 font-mono px-1">
          <span>AVAILABLE ACTIVE LOBBIES ({lobbies.length})</span>
          <span>CURRENT MATCH ROOM: <b className="text-[#38bdf8]">{selectedRoomId}</b></span>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto p-1 bg-[#060d14]/80 border border-[#23455a]/80 rounded-lg">
          {lobbies.length === 0 ? (
            <div className="text-center py-6 text-gray-400 font-mono text-xs">
              No active public lobbies found. Click "Create Lobby" below or join room <b>default</b>.
            </div>
          ) : (
            lobbies.map((lobby) => {
              const isCurrent = selectedRoomId === lobby.roomId;
              const isRanked = lobby.gameMode === 'ranked';
              const diffColor = lobby.difficulty === 'Hard' ? 'text-red-400 border-red-500/40 bg-red-950/30' : (lobby.difficulty === 'Easy' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' : 'text-amber-400 border-amber-500/40 bg-amber-950/30');

              return (
                <div
                  key={lobby.roomId}
                  onClick={() => onSelectRoom(lobby.roomId, lobby)}
                  className={`flex flex-wrap items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#152e42] border-[#38bdf8] ring-1 ring-[#38bdf8]/50 shadow-md'
                      : 'bg-[#0a1420] border-[#1d374a] hover:bg-[#102030] hover:border-[#2f5573]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#7fd6ff]">
                          {lobby.roomId.toUpperCase()}
                        </span>
                        {isRanked ? (
                          <span className="px-1.5 py-0.2 bg-purple-950/60 text-purple-300 border border-purple-500/50 text-[9px] font-mono font-bold rounded">
                            🏆 RANKED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 bg-blue-950/60 text-blue-300 border border-blue-500/50 text-[9px] font-mono font-bold rounded">
                            ⚡ QUICK MATCH
                          </span>
                        )}
                        <span className={`px-1.5 py-0.2 border text-[9px] font-mono font-bold rounded ${diffColor}`}>
                          BOTS: {lobby.difficulty?.toUpperCase() || 'NORMAL'}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/50 text-[9px] font-mono font-bold rounded">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Host: {lobby.hostName} · Map: <b className="text-white">{lobby.mapName}</b>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1 text-gray-300">
                      <Users className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span className="font-bold text-white">{lobby.playerCount}</span>
                      <span className="text-gray-500">/{lobby.maxPlayers}</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-[11px]">
                      <span className="text-blue-400 font-bold">{lobby.atkCount} ATK</span>
                      <span className="text-gray-600">vs</span>
                      <span className="text-amber-400 font-bold">{lobby.defCount} DEF</span>
                    </div>

                    <div className="px-2 py-0.5 bg-[#08121c] border border-gray-700/60 rounded text-[10px] text-emerald-400 font-bold">
                      {lobby.phase === 'prep' ? 'PREP PHASE' : lobby.phase === 'action' ? 'IN MATCH' : 'LOBBY OPEN'}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRoom(lobby.roomId, lobby);
                      }}
                      className={`px-3 py-1 font-mono text-xs font-extrabold rounded border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#0284c7] text-white border-[#38bdf8]'
                          : 'bg-[#183247] hover:bg-[#0284c7] text-[#7fd6ff] hover:text-white border-[#2c5771]'
                      }`}
                    >
                      {isCurrent ? 'JOINED' : 'JOIN LOBBY'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Custom Room Form */}
      <div className="flex flex-col gap-2 bg-[#08121c] p-2.5 rounded-lg border border-[#23455a]">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-300 font-mono font-bold shrink-0 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-[#38bdf8]" />
            CREATE CUSTOM LOBBY (HOST SETS MAP & BOTS):
          </label>
          <button
            type="button"
            onClick={() => setShowCreateOptions(!showCreateOptions)}
            className="text-[10px] font-mono text-[#38bdf8] hover:underline cursor-pointer"
          >
            {showCreateOptions ? 'Hide Settings ▲' : 'Configure Map & Difficulty ▼'}
          </button>
        </div>

        <form onSubmit={handleCreateLobby} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. ranked-squad-1"
              value={newLobbyName}
              onChange={(e) => setNewLobbyName(e.target.value)}
              className="bg-[#0e1c2a] text-[#7fd6ff] font-mono text-xs font-bold border border-[#23455a] rounded px-2.5 py-1.5 flex-1 outline-none focus:border-[#38bdf8]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-mono text-xs font-bold rounded border border-[#38bdf8]/40 cursor-pointer transition-all shrink-0"
            >
              + CREATE & JOIN
            </button>
          </div>

          {showCreateOptions && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 bg-[#0d1824] rounded border border-[#1b3447] text-xs font-mono">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">MAP SELECTION:</label>
                <select
                  value={newLobbyMap}
                  onChange={(e) => setNewLobbyMap(e.target.value)}
                  className="w-full bg-[#08121c] border border-[#23455a] text-[#7fd6ff] rounded p-1 text-xs"
                >
                  <option value="suburban_house">Suburban Villa (2F House)</option>
                  <option value="warehouse">Warehouse District</option>
                  <option value="office_tower">Highrise Office Tower</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">BOT DIFFICULTY:</label>
                <select
                  value={newLobbyDiff}
                  onChange={(e) => setNewLobbyDiff(e.target.value as any)}
                  className="w-full bg-[#08121c] border border-[#23455a] text-[#7fd6ff] rounded p-1 text-xs"
                >
                  <option value="Easy">Easy (Recruits)</option>
                  <option value="Normal">Normal (Tactical Squad)</option>
                  <option value="Hard">Hard (Elite Delta Operators)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">GAME MODE:</label>
                <select
                  value={newLobbyMode}
                  onChange={(e) => setNewLobbyMode(e.target.value as any)}
                  className="w-full bg-[#08121c] border border-[#23455a] text-[#7fd6ff] rounded p-1 text-xs"
                >
                  <option value="quick">Quick Match (Casual Renown)</option>
                  <option value="ranked">Ranked Competitive (Rank Points + High Renown)</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
