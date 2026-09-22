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
  ping: number;
}

interface MatchmakingBrowserProps {
  selectedRoomId: string;
  onSelectRoom: (roomId: string) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
}

export const MatchmakingBrowser: React.FC<MatchmakingBrowserProps> = ({
  selectedRoomId,
  onSelectRoom,
  playerName,
  setPlayerName
}) => {
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newLobbyName, setNewLobbyName] = useState<string>('');
  const [showGuide, setShowGuide] = useState<boolean>(false);
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
        body: JSON.stringify({ roomId: formatted })
      });
      if (res.ok) {
        onSelectRoom(formatted);
        setNewLobbyName('');
        fetchLobbies();
      }
    } catch (err) {
      console.error('Error creating lobby:', err);
    }
  };

  const handleQuickMatch = () => {
    if (lobbies.length > 0) {
      // Find room with most players that isn't full
      const sorted = [...lobbies].sort((a, b) => b.playerCount - a.playerCount);
      const available = sorted.find(l => l.playerCount < l.maxPlayers);
      if (available) {
        onSelectRoom(available.roomId);
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
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#172e3d] hover:bg-[#203f53] text-[#ffe27a] border border-[#ffe27a]/40 rounded-md font-mono text-xs font-bold transition-all cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            HOW ONLINE WORKS
          </button>
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

      {/* Online How-To Guide Modal / Box */}
      {showGuide && (
        <div className="bg-[#0a121c] border-2 border-[#ffe27a]/60 rounded-lg p-4 font-sans text-xs text-gray-200 flex flex-col gap-2.5 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-[#ffe27a]/20 pb-2">
            <h4 className="font-mono font-black text-[#ffe27a] text-sm flex items-center gap-2 uppercase tracking-wider">
              <Server className="w-4 h-4 text-[#ffe27a]" />
              HOW TO GET ONLINE MULTIPLAYER WORKING
            </h4>
            <button
              onClick={() => setShowGuide(false)}
              className="text-gray-400 hover:text-white font-mono font-bold text-xs cursor-pointer px-2 py-0.5 rounded bg-gray-800"
            >
              ✕ CLOSE
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-1">
            <div className="bg-[#111f2c] border border-[#23455a] rounded-lg p-3">
              <b className="text-[#38bdf8] font-mono text-xs block mb-1">1. SHARE PREVIEW URL WITH FRIENDS</b>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Copy your AI Studio application link (e.g. <code className="bg-black/60 text-emerald-400 px-1 py-0.5 rounded text-[10px]">https://ais-dev-...</code>).
                When your friends open the URL in their browser, they connect to the exact same Cloud Run backend server.
              </p>
            </div>

            <div className="bg-[#111f2c] border border-[#23455a] rounded-lg p-3">
              <b className="text-[#38bdf8] font-mono text-xs block mb-1">2. JOIN THE SAME LOBBY</b>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Choose any active lobby from the list below, or create a custom room name (e.g., <code className="bg-black/60 text-[#ffe27a] px-1 py-0.5 rounded text-[10px]">squad-delta</code>).
                Ensure all players set the exact same Room ID.
              </p>
            </div>

            <div className="bg-[#111f2c] border border-[#23455a] rounded-lg p-3">
              <b className="text-[#38bdf8] font-mono text-xs block mb-1">3. WEBSOCKET REAL-TIME SYNC</b>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                The Express backend uses standard WebSockets (<code className="bg-black/60 text-emerald-400 px-1 py-0.5 rounded text-[10px]">/ws</code>) on Port 3000 to sync player positions, shots, barricade breaches, defuser plants, and audio in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#182838] p-2 rounded border border-[#38bdf8]/30 text-[11px] text-[#7fd6ff]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span><b>AI Bots Auto-Fill:</b> If less than 10 human players join, intelligent AI bots automatically fill remaining squad positions on Attack and Defense!</span>
          </div>
        </div>
      )}

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
              return (
                <div
                  key={lobby.roomId}
                  onClick={() => onSelectRoom(lobby.roomId)}
                  className={`flex flex-wrap items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#152e42] border-[#38bdf8] ring-1 ring-[#38bdf8]/50 shadow-md'
                      : 'bg-[#0a1420] border-[#1d374a] hover:bg-[#102030] hover:border-[#2f5573]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#7fd6ff]">
                          {lobby.roomId.toUpperCase()}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/50 text-[9px] font-mono font-bold rounded">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Host: {lobby.hostName} · Map: {lobby.mapName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
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
                        onSelectRoom(lobby.roomId);
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
      <form onSubmit={handleCreateLobby} className="flex items-center gap-2 bg-[#08121c] p-2 rounded-lg border border-[#23455a]">
        <label className="text-xs text-gray-300 font-mono font-bold shrink-0 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-[#38bdf8]" />
          CREATE LOBBY:
        </label>
        <input
          type="text"
          placeholder="e.g. ranked-squad-1"
          value={newLobbyName}
          onChange={(e) => setNewLobbyName(e.target.value)}
          className="bg-[#0e1c2a] text-[#7fd6ff] font-mono text-xs font-bold border border-[#23455a] rounded px-2.5 py-1 flex-1 outline-none focus:border-[#38bdf8]"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-[#0284c7] hover:bg-[#0369a1] text-white font-mono text-xs font-bold rounded border border-[#38bdf8]/40 cursor-pointer transition-all shrink-0"
        >
          + CREATE & JOIN
        </button>
      </form>
    </div>
  );
};
