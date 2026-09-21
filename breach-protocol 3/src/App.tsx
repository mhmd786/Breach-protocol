/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  OPERATORS,
  WEAPONS,
  OperatorDef,
  WeaponDef,
  getRecommendedWeaponIndex
} from './game/BreachProtocol';
import { BreachProtocolEngine } from './game/BreachProtocolEngine';
import { networkClient } from './game/NetworkClient';
import { MatchmakingBrowser } from './components/MatchmakingBrowser';
import { InGameLoadoutModal } from './components/InGameLoadoutModal';
import { OperatorDraftScreen, PlayerReadyState } from './components/OperatorDraftScreen';
import { Minimap } from './components/Minimap';
import { PauseMenu } from './components/PauseMenu';
import { getSpawnOptions } from './maps/spawnPoints';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BreachProtocolEngine | null>(null);

  // Menu State
  const [playerName, setPlayerName] = useState<string>(() => 'Operator_' + Math.floor(100 + Math.random() * 900));
  const [roomId, setRoomId] = useState<string>('LAN_SQUAD_01');
  const [selectedMapKey, setSelectedMapKey] = useState<string>('suburban_house');
  const [selectedSpawnIndex, setSelectedSpawnIndex] = useState<number>(0);
  const [roundsToWin, setRoundsToWin] = useState<number>(4);
  const [difficulty, setDifficulty] = useState<string>('Normal');
  const [selectedOp, setSelectedOp] = useState<OperatorDef>(OPERATORS[0]);
  const [selectedWeaponIdx, setSelectedWeaponIdx] = useState<number>(0);
  const [opSideFilter, setOpSideFilter] = useState<'all' | 'atk' | 'def'>('all');
  const [lanStatus, setLanStatus] = useState<string>('Ready for LAN');
  const [peerCount, setPeerCount] = useState<number>(0);
  const [ping, setPing] = useState<number>(12);

  // Screen State
  const [screenState, setScreenState] = useState<'main_menu' | 'draft' | 'in_game'>('main_menu');
  const [isLocalReady, setIsLocalReady] = useState<boolean>(false);
  const [connectedRealPlayers, setConnectedRealPlayers] = useState<PlayerReadyState[]>([]);
  const [showPauseMenu, setShowPauseMenu] = useState<boolean>(false);

  // Match State
  const [inMatch, setInMatch] = useState<boolean>(false);
  const [showLoadoutModal, setShowLoadoutModal] = useState<boolean>(false);
  const [matchOver, setMatchOver] = useState<boolean>(false);
  const [matchWinner, setMatchWinner] = useState<string>('');
  const [finalScore, setFinalScore] = useState<string>('');
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [showGadgetWheel, setShowGadgetWheel] = useState<boolean>(false);
  const [hoveredGadget, setHoveredGadget] = useState<string | null>(null);

  // Chat State
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; side: 'atk' | 'def'; isSelf?: boolean }>>([]);

  // HUD State synced from engine
  const [hudState, setHudState] = useState({
    round: 1,
    scoreAtk: 0,
    scoreDef: 0,
    playerSide: 'atk',
    phase: 'prep',
    phaseTimer: 25,
    enemiesLeft: 5,
    objStatus: 'INFILTRATE',
    hp: 100,
    alive: true,
    ammo: 30,
    ammoReserve: 90,
    weaponName: 'Vector AR',
    abilityText: '[/]: Ability Ready  (Q/E lean)',
    gadgetName: 'Ability',
    gadgetCharges: 0,
    throwableType: null as 'valkyrie_cam' | 'maestro_cam' | null,
    isRappelling: false,
    canRappel: false,
    canKickBreach: false,
    breachChargesLeft: 2,
    hasActiveBreachCharge: false,
    inDroneMode: false,
    inCctvMode: false,
    activeCctvIndex: 0,
    cctvCameras: [] as Array<{ name: string; isDestroyed: boolean }>,
    droneDestroyed: false,
    droneHp: 40,
    dronesReserve: 1,
    spottedEnemiesCount: 0,
    spottedObjective: false,
    defuserPlanted: false,
    plantProgress: 0,
    defuseProgress: 0,
    defuserTimer: 45.0,
    canPlantDefuser: false,
    canDefuse: false,
    diagOn: false,
    diagInfo: '',
    atkHumans: 1,
    defHumans: 0,
    atkAlive: 5,
    defAlive: 5,
    isAiming: false,
    isSniper: false
  });

  const [logMessages, setLogMessages] = useState<string[]>([]);

  // Update HUD from Engine State
  const updateHUD = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    const w = eng.currentWeapon();
    const enemySide = eng.player.side === 'atk' ? 'def' : 'atk';
    const enemyBots = eng.bots.filter(b => b.alive && b.side === enemySide).length;

    let enemyHumans = 0;
    let allyHumans = 1;
    networkClient.remotePlayers.forEach(rp => {
      if (rp.side === enemySide && rp.alive) enemyHumans++;
      if (rp.side === eng.player.side && rp.alive) allyHumans++;
    });

    const enemiesRemaining = enemyBots + enemyHumans;

    let objText = '—';
    if (eng.match.phase === 'prep') {
      objText = `PREP PHASE ${Math.ceil(eng.match.phaseTimer)}s`;
    } else if (eng.match.phase === 'action') {
      if (eng.match.defuserPlanted) {
        objText = `⚠️ DEFUSER ARMED ${Math.ceil(eng.match.defuserTimer)}s`;
      } else {
        objText = `${eng.player.side === 'atk' ? 'PLANT / SECURE' : 'DEFEND OBJECTIVE'} ${Math.ceil(eng.match.phaseTimer)}s`;
      }
    } else if (eng.match.phase === 'result') {
      objText = eng.match.winner === 'atk' ? 'ATTACK WINS' : 'DEFENSE WINS';
    } else if (eng.match.phase === 'matchover') {
      objText = 'MATCH OVER';
    }

    let abilityLabel = `[/]: ${eng.player.op.gadgetName || 'Ability'} (Q/E Lean)`;
    if (eng.player.abilityCooldown > 0) {
      abilityLabel = `[/]: Cooldown ${eng.player.abilityCooldown.toFixed(1)}s (Q/E Lean)`;
    }

    const canRappelHere = !eng.player.isRappelling && !!eng.findNearbyRappelWall();
    const nearbyWindow = eng.barricades.find(
      b => !b.isBreached && b.isWindow && b.floor === 2 && b.position.distanceTo(eng.player.pos) < 2.5
    );

    const isNearPlantSite = eng.player.side === 'atk' && !eng.match.defuserPlanted && eng.match.phase === 'action' &&
      Math.hypot(eng.player.pos.x - eng.objectivePos.x, eng.player.pos.z - eng.objectivePos.z) < 4.0;
    
    const isNearDefuser = eng.player.side === 'def' && eng.match.defuserPlanted && !!eng.match.defuserPos && eng.match.phase === 'action' &&
      eng.player.pos.distanceTo(eng.match.defuserPos) < 2.5;

    let atkHumansCount = eng.player.side === 'atk' ? 1 : 0;
    let defHumansCount = eng.player.side === 'def' ? 1 : 0;
    networkClient.remotePlayers.forEach(rp => {
      if (rp.side === 'atk') atkHumansCount++;
      if (rp.side === 'def') defHumansCount++;
    });

    const atkBotsAlive = eng.bots.filter(b => b.alive && b.side === 'atk').length;
    const defBotsAlive = eng.bots.filter(b => b.alive && b.side === 'def').length;
    let atkHumansAlive = eng.player.side === 'atk' && eng.player.alive ? 1 : 0;
    let defHumansAlive = eng.player.side === 'def' && eng.player.alive ? 1 : 0;
    networkClient.remotePlayers.forEach(rp => {
      if (rp.alive && rp.side === 'atk') atkHumansAlive++;
      if (rp.alive && rp.side === 'def') defHumansAlive++;
    });

    let diag = '';
    if (eng.diagPanelOn) {
      diag += `FPS: ${eng.status.fps} | Loop: ${eng.status.loop}\n`;
      diag += `LAN Room: ${roomId} | Humans Connected: ${networkClient.remotePlayers.size + 1}\n`;
      diag += `Operator: ${eng.status.operator} | Weapon: ${eng.status.weapon}\n`;
      diag += `Player HP: ${Math.round(eng.player.hp)} | Rappelling: ${eng.player.isRappelling}\n`;
      diag += `Active Bots: ${eng.bots.filter(b => b.alive).length}/${eng.bots.length}\n`;
      diag += `Defuser: ${eng.match.defuserPlanted ? `Planted (${eng.match.defuserTimer.toFixed(1)}s)` : 'Not Planted'}\n`;
      diag += `Barricades Intact: ${eng.barricades.filter(b => !b.isBreached).length}/${eng.barricades.length}\n\n`;
      diag += `Tactical Bots:\n`;
      diag += eng.bots.filter(b => b.alive).map(b =>
        `${b.op.name} [${b.side.toUpperCase()}/${b.personality.name}]: ${b.state} (hp: ${Math.round(b.hp)})`
      ).join('\n');
    }

    setHudState({
      round: eng.match.round,
      scoreAtk: eng.match.scoreAtk,
      scoreDef: eng.match.scoreDef,
      playerSide: eng.player.side,
      phase: eng.match.phase,
      phaseTimer: eng.match.phaseTimer,
      enemiesLeft: enemiesRemaining,
      objStatus: objText,
      hp: Math.max(0, eng.player.hp),
      alive: eng.player.alive,
      ammo: eng.player.ammoInMag[w.id] ?? w.mag,
      ammoReserve: eng.player.ammoReserve[w.id] ?? w.reserve,
      weaponName: w.name,
      abilityText: abilityLabel,
      gadgetName: eng.player.op.gadgetName || 'Ability',
      gadgetCharges: eng.player.gadgetCharges ?? 0,
      throwableType: eng.getThrowableTypeForOperator(),
      isRappelling: eng.player.isRappelling,
      canRappel: canRappelHere,
      canKickBreach: eng.player.isRappelling && !!nearbyWindow,
      breachChargesLeft: eng.player.breachChargesLeft,
      hasActiveBreachCharge: !!eng.player.activeBreachCharge,
      inDroneMode: eng.inDroneMode,
      inCctvMode: eng.inCctvMode,
      activeCctvIndex: eng.activeCctvIndex,
      cctvCameras: eng.securityCameras.map(c => ({ name: c.name, isDestroyed: c.isDestroyed })),
      droneDestroyed: eng.drone ? eng.drone.destroyed : false,
      droneHp: eng.drone ? eng.drone.hp : 0,
      dronesReserve: eng.dronesReserve,
      spottedEnemiesCount: eng.droneSpottedEnemies.size,
      spottedObjective: eng.droneSpottedObjective,
      defuserPlanted: eng.match.defuserPlanted,
      plantProgress: eng.match.plantProgress || 0,
      defuseProgress: eng.match.defuseProgress || 0,
      defuserTimer: eng.match.defuserTimer,
      canPlantDefuser: isNearPlantSite,
      canDefuse: isNearDefuser,
      diagOn: eng.diagPanelOn,
      diagInfo: diag,
      atkHumans: atkHumansCount,
      defHumans: defHumansCount,
      atkAlive: atkBotsAlive + atkHumansAlive,
      defAlive: defBotsAlive + defHumansAlive,
      isAiming: eng.player.focusZoom,
      isSniper: !!w.isSniper
    });
  }, [roomId]);

  const addLogMessage = useCallback((msg: string) => {
    setLogMessages(prev => {
      const next = [...prev, msg];
      if (next.length > 7) next.shift();
      return next;
    });
  }, []);

  const handleSelectOp = (op: OperatorDef) => {
    setSelectedOp(op);
    setSelectedWeaponIdx(getRecommendedWeaponIndex(op));
    setSelectedSpawnIndex(0);
  };

  const handleEnterDraft = () => {
    setScreenState('draft');
    setIsLocalReady(false);

    const cleanRoom = roomId.trim() || 'default';
    const cleanName = playerName.trim() || 'Operator';
    setLanStatus('Connecting to LAN...');
    networkClient.connect(cleanRoom, cleanName, selectedOp.side, selectedOp.id);

    networkClient.onConnected = () => {
      setLanStatus('LAN Connected');
    };

    networkClient.onDisconnected = () => {
      setLanStatus('Offline (Local Match)');
    };

    networkClient.onReadyStatusChanged = (players) => {
      const pList: PlayerReadyState[] = Object.values(players).map((p: any) => ({
        id: p.id,
        name: p.name,
        side: p.side,
        opId: p.opId,
        opName: p.opName,
        isReady: !!p.isReady
      }));
      setConnectedRealPlayers(pList);
    };
  };

  const handleLockInReady = () => {
    setIsLocalReady(true);
    networkClient.setReady(true, selectedOp.id, selectedOp.name, selectedOp.side);
  };

  const handleCancelReady = () => {
    setIsLocalReady(false);
    networkClient.setReady(false, selectedOp.id, selectedOp.name, selectedOp.side);
  };

  const handleStartGameFromDraft = useCallback(() => {
    setScreenState('in_game');
    setInMatch(true);
    setTimeout(() => {
      handleDeploy();
    }, 100);
  }, [selectedMapKey, roundsToWin, difficulty, selectedOp, selectedWeaponIdx, selectedSpawnIndex, roomId, playerName]);

  // Deploy / Start Match Engine
  const handleDeploy = () => {
    try {
      if (!containerRef.current) return;
      if (engineRef.current) {
        engineRef.current.destroy();
      }

      const eng = new BreachProtocolEngine(containerRef.current);
      eng.onStateUpdate = updateHUD;
      eng.onLogMessage = addLogMessage;
      eng.onToggleLoadoutMenu = () => {
        setShowLoadoutModal(prev => !prev);
      };
      eng.onForceLoadoutOpen = () => {
        setShowLoadoutModal(true);
      };
      eng.onOperatorChanged = (op, weaponIdx) => {
        // Keeps React's selectedOp/selectedWeaponIdx in sync after the engine changes
        // the operator on its own initiative (currently: the mid-match side swap) —
        // otherwise the loadout modal highlights a stale, wrong-side operator.
        setSelectedOp(op);
        setSelectedWeaponIdx(weaponIdx);
      };
      eng.onMatchOver = (winner, score) => {
        setMatchWinner(winner);
        setFinalScore(score);
        setMatchOver(true);
      };

      engineRef.current = eng;

      eng.startMatch({
        mapKey: selectedMapKey,
        roundsToWin,
        difficulty,
        operator: selectedOp,
        weaponIdx: selectedWeaponIdx,
        roomId: roomId.trim() || 'default',
        playerName: playerName.trim() || 'Operator',
        enableLan: true,
        spawnIndex: selectedSpawnIndex
      });

      // Hook up LAN chat and team sync callbacks
      networkClient.onChatMessage = (sender, text, side) => {
        setChatMessages(prev => [...prev.slice(-20), { sender, text, side }]);
      };
      networkClient.onSquadChanged = (atkCount, defCount) => {
        setPeerCount(networkClient.remotePlayers.size);
        addLogMessage(`[LAN MULTIPLAYER] Squad updated: ${atkCount} Humans Attack · ${defCount} Humans Defend`);
        updateHUD();
      };

      setInMatch(true);
      setShowLoadoutModal(false);
      setMatchOver(false);
      updateHUD();
    } catch (err: any) {
      console.error('Fatal start error:', err);
      setFatalError(err?.message || String(err));
    }
  };

  const handleReturnToMenu = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    document.exitPointerLock?.();
    networkClient.disconnect();
    setScreenState('main_menu');
    setIsLocalReady(false);
    setInMatch(false);
    setShowLoadoutModal(false);
    setMatchOver(false);
    setShowPauseMenu(false);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !engineRef.current) return;
    const text = chatInput.trim();
    networkClient.sendChat(text);
    setChatMessages(prev => [...prev.slice(-20), {
      sender: playerName,
      text,
      side: engineRef.current?.player.side || 'atk',
      isSelf: true
    }]);
    setChatInput('');
    setChatOpen(false);
    // Refocus pointer lock
    if (engineRef.current?.renderer) {
      engineRef.current.renderer.domElement.requestPointerLock();
    }
  };

  // Re-lock the mouse to the canvas, unless some other overlay still needs it free
  const relockPointer = useCallback(() => {
    if (chatOpen || showPauseMenu || showLoadoutModal) return;
    if (engineRef.current?.renderer) {
      try { engineRef.current.renderer.domElement.requestPointerLock(); } catch {}
    }
  }, [chatOpen, showPauseMenu, showLoadoutModal]);

  // Fire whichever gadget is currently hovered when the Tab wheel is released
  const equipHoveredGadget = useCallback((gadgetId: string | null) => {
    const eng = engineRef.current;
    if (!eng || !gadgetId) return;
    switch (gadgetId) {
      case 'ability':
        eng.useAbility();
        break;
      case 'breach':
        eng.handleBreachKey();
        break;
      case 'drone':
        eng.toggleDroneMode();
        break;
      case 'cctv':
        eng.toggleCctvMode();
        break;
      case 'camera':
        eng.isHoldingThrow = true;
        eng.updateGadgetViewmodel();
        eng.executeThrow();
        eng.isHoldingThrow = false;
        eng.updateGadgetViewmodel();
        break;
      default:
        break;
    }
    updateHUD();
  }, [updateHUD]);

  // Keyboard listeners: O (Scoreboard), T (Chat), Tab hold (Gadget Wheel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!showGadgetWheel && inMatch && !chatOpen && !showPauseMenu && !showLoadoutModal) {
          setShowGadgetWheel(true);
          document.exitPointerLock?.();
        }
        return;
      }
      if (e.key.toLowerCase() === 'o' && !chatOpen && inMatch) {
        e.preventDefault();
        setShowScoreboard(prev => !prev);
      }
      if (e.key.toLowerCase() === 't' && !chatOpen && inMatch && !showGadgetWheel) {
        e.preventDefault();
        setChatOpen(true);
        document.exitPointerLock?.();
      }
      if (e.key === 'Escape') {
        if (showGadgetWheel) {
          setShowGadgetWheel(false);
          setHoveredGadget(null);
          relockPointer();
        } else if (chatOpen) {
          setChatOpen(false);
          if (engineRef.current?.renderer) {
            engineRef.current.renderer.domElement.requestPointerLock();
          }
        } else if (hudState.inCctvMode) {
          engineRef.current?.exitCctvMode();
        } else if (inMatch) {
          setShowPauseMenu(prev => {
            const next = !prev;
            if (next) {
              document.exitPointerLock?.();
            } else {
              if (engineRef.current?.renderer) {
                engineRef.current.renderer.domElement.requestPointerLock();
              }
            }
            return next;
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && showGadgetWheel) {
        e.preventDefault();
        equipHoveredGadget(hoveredGadget);
        setShowGadgetWheel(false);
        setHoveredGadget(null);
        relockPointer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [chatOpen, inMatch, hudState.inCctvMode, showPauseMenu, showLoadoutModal, showGadgetWheel, hoveredGadget, equipHoveredGadget, relockPointer]);

  // Release the mouse whenever the in-game loadout modal opens, and reclaim it when it closes
  useEffect(() => {
    if (showLoadoutModal) {
      document.exitPointerLock?.();
    } else {
      relockPointer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLoadoutModal]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  const filteredOps = OPERATORS.filter(op => {
    if (opSideFilter === 'atk') return op.side === 'atk';
    if (opSideFilter === 'def') return op.side === 'def';
    return true;
  });

  return (
    <div id="app" className="relative w-screen h-screen overflow-hidden bg-black text-[#e8f0ff] select-none font-sans">
      {/* 3D WebGL Canvas Container (Mounted during in_game state) */}
      {screenState === 'in_game' && (
        <div
          ref={containerRef}
          id="canvasContainer"
          className="absolute inset-0 z-0 cursor-crosshair"
          onClick={() => {
            if (inMatch && !chatOpen && engineRef.current && engineRef.current.renderer) {
              engineRef.current.renderer.domElement.requestPointerLock();
            }
          }}
        />
      )}

      {/* Fatal Error Overlay */}
      {fatalError && (
        <div className="absolute inset-0 z-50 bg-[#0a0d12] text-[#ffd0c0] flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="text-2xl text-[#ff8a70] tracking-widest font-bold">SOMETHING FAILED TO LOAD</div>
          <div className="max-w-md text-sm text-[#dab]">The game stopped safely. Error details:</div>
          <pre className="max-w-xl p-3 bg-black rounded text-amber-300 text-xs overflow-auto">{fatalError}</pre>
          <button
            className="px-6 py-2 bg-gradient-to-b from-[#ff6b4a] to-[#c8431f] text-white rounded font-bold hover:brightness-110 cursor-pointer"
            onClick={() => { setFatalError(null); handleReturnToMenu(); }}
          >
            Return to Menu
          </button>
        </div>
      )}

      {/* Main Menu Screen */}
      {screenState === 'main_menu' && (
        <div id="menu" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,#0d1620_0%,#050810_100%)] p-4 overflow-y-auto">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl tracking-[6px] text-[#7fd6ff] font-extrabold drop-shadow-[0_0_20px_rgba(127,214,255,0.6)]">
              BREACH<span className="text-[#ff6b4a]">PROTOCOL</span>
            </h1>
            <p className="text-xs text-[#a0c4db] tracking-widest uppercase mt-1">Tactical 5v5 Siege · Local LAN Multiplayer & Dynamic AI Bots</p>
          </div>

          <div className="bg-[#0f1923]/90 border border-[#7fd6ff]/25 rounded-xl p-5 w-full max-w-3xl shadow-2xl backdrop-blur-md flex flex-col gap-3">
            {/* Online Matchmaking & Lobbies Browser */}
            <MatchmakingBrowser
              selectedRoomId={roomId}
              onSelectRoom={(id) => setRoomId(id)}
              playerName={playerName}
              setPlayerName={(name) => setPlayerName(name)}
            />

            {/* Codename & Room Config */}
            <div className="bg-[#0b141d]/80 border border-[#2c5771]/60 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono font-bold text-[#7fd6ff]">SELECTED MATCH ROOM: <b className="text-[#ffe27a]">{roomId}</b></span>
                <span className="text-gray-400 font-mono text-[10px]">(AI Bots fill remaining squad slots)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[11px]">Codename:</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="bg-[#132433] text-[#ffe27a] font-bold border border-[#2c5771] rounded px-2 py-0.5 text-xs w-32 outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[11px]">Room ID:</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="bg-[#132433] text-[#7fd6ff] font-mono font-bold border border-[#2c5771] rounded px-2 py-0.5 text-xs w-32 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Map Selection */}
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-semibold text-gray-300">Map</label>
              <select
                className="bg-[#132433] text-[#dff] border border-[#2c5771] rounded-md px-3 py-1.5 outline-none cursor-pointer font-mono"
                value={selectedMapKey}
                onChange={(e) => { setSelectedMapKey(e.target.value); setSelectedSpawnIndex(0); }}
              >
                <option value="suburban_house">Suburban Villa (2F House, Warm Interior)</option>
                <option value="warehouse">Warehouse District (1F Open Industrial, No Rappel)</option>
                <option value="office_tower">Office Tower (2F Corporate, Glass Facade)</option>
              </select>
            </div>

            {/* Spawn Point Selection — options depend on the chosen map + the operator's side */}
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-semibold text-gray-300">Spawn Point ({selectedOp.side === 'atk' ? 'Attacker' : 'Defender'})</label>
              <select
                className="bg-[#132433] text-[#dff] border border-[#2c5771] rounded-md px-3 py-1.5 outline-none cursor-pointer font-mono"
                value={selectedSpawnIndex}
                onChange={(e) => setSelectedSpawnIndex(parseInt(e.target.value, 10))}
              >
                {getSpawnOptions(selectedMapKey, selectedOp.side).map((opt, i) => (
                  <option key={i} value={i}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Difficulty & Rounds Config */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-300">Rounds to Win</label>
                <select
                  className="bg-[#132433] text-[#dff] border border-[#2c5771] rounded-md px-3 py-1.5 outline-none cursor-pointer font-mono"
                  value={roundsToWin}
                  onChange={(e) => setRoundsToWin(Number(e.target.value))}
                >
                  <option value={1}>1 Round (Quick Skirmish)</option>
                  <option value={2}>2 Rounds (Short Match)</option>
                  <option value={4}>4 Rounds (Standard Tactical Competitive)</option>
                  <option value={6}>6 Rounds (Long Siege)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-gray-300">AI Bot Difficulty</label>
                <select
                  className="bg-[#132433] text-[#dff] border border-[#2c5771] rounded-md px-3 py-1.5 outline-none cursor-pointer font-mono"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="Easy">Easy (Slower reaction, forgiving angles)</option>
                  <option value="Normal">Normal (Tactical crossfires, peeking)</option>
                  <option value="Hard">Hard (Aggressive breach defense, fast aim)</option>
                </select>
              </div>
            </div>

            {/* Selection Flow Notice */}
            <div className="bg-[#0b141d]/80 border border-[#23455a] rounded-lg p-2.5 text-center text-xs font-mono text-[#7fd6ff]">
              <b>🎯 OPERATOR SELECTION:</b> You will choose your Operator & Loadout in the Pre-Match Tactical Draft screen before entering the 3D match.
            </div>

            {/* Proceed Button */}
            <div className="mt-1 flex justify-center">
              <button
                id="startBtn"
                onClick={handleEnterDraft}
                className="text-sm font-extrabold px-10 py-3.5 tracking-[2px] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white rounded-lg shadow-xl active:scale-95 transition-all cursor-pointer font-mono uppercase"
              >
                PROCEED TO OPERATOR DRAFT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operator Selection Draft Screen */}
      {screenState === 'draft' && (
        <OperatorDraftScreen
          roomId={roomId}
          playerName={playerName}
          playerSide={selectedOp.side}
          selectedOp={selectedOp}
          onSelectOp={handleSelectOp}
          selectedWeaponIdx={selectedWeaponIdx}
          onSelectWeaponIdx={setSelectedWeaponIdx}
          connectedRealPlayers={connectedRealPlayers}
          isLocalReady={isLocalReady}
          onLockInReady={handleLockInReady}
          onCancelReady={handleCancelReady}
          onBackToMenu={handleReturnToMenu}
          onMatchStart={handleStartGameFromDraft}
        />
      )}

      {/* In-Game HUD */}
      {inMatch && (
        <div id="hud" className="absolute inset-0 pointer-events-none z-10">
          {/* Recon Drone Surveillance Mode HUD */}
          {hudState.inDroneMode ? (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
              {/* Drone Camera Scanlines & Grain */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,30,40,0.1)_0%,rgba(0,10,15,0.6)_100%)] pointer-events-none" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,36,48,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 pointer-events-none" />

              {/* Destroyed Static & Signal Loss Screen Overlay */}
              {hudState.droneDestroyed && (
                <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-20">
                  <div className="bg-black/85 border border-red-500/60 p-6 rounded-lg text-center max-w-md shadow-2xl animate-pulse">
                    <div className="text-red-500 font-mono text-2xl font-black tracking-widest mb-1">
                      ⚠️ SIGNAL COMPROMISED
                    </div>
                    <div className="text-gray-300 font-mono text-xs mb-4">
                      RECON DRONE CHASSIS DESTROYED BY ENEMY FIRE
                    </div>
                    <div className="text-xs text-gray-400 font-mono mb-4">
                      Feed offline · Sensors non-responsive
                    </div>
                    <div className="flex justify-center gap-3 pointer-events-auto">
                      {hudState.dronesReserve > 0 ? (
                        <button
                          onClick={() => engineRef.current?.toggleDroneMode()}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded shadow transition-all cursor-pointer"
                        >
                          DEPLOY RESERVE DRONE [5] ({hudState.dronesReserve} LEFT)
                        </button>
                      ) : null}
                      <button
                        onClick={() => engineRef.current?.exitDroneMode()}
                        className="px-4 py-2 bg-gradient-to-r from-[#ff6b4a] to-[#c8431f] text-white font-mono text-xs font-bold rounded shadow transition-all cursor-pointer"
                      >
                        DEPLOY OPERATOR [ENTER / 5]
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Drone Top Header */}
              <div className="relative z-10 flex justify-between items-center bg-black/60 backdrop-blur-md px-6 py-2 rounded-lg border border-[#7fd6ff]/30 text-xs shadow-xl">
                <div className="flex items-center gap-3">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${hudState.droneDestroyed ? 'bg-red-700' : 'bg-red-500 animate-ping'}`} />
                  <span className="font-mono font-bold text-[#ff6b4a] tracking-wider">
                    {hudState.droneDestroyed ? '[OFFLINE] RECON-01' : '[● REC] RECON-01 FEED'}
                  </span>
                  <span className="text-gray-400 text-[11px] font-mono">
                    HP: {Math.max(0, Math.round(hudState.droneHp))}/40 · RESERVE: {hudState.dronesReserve}
                  </span>
                </div>

                <div className="text-center font-mono">
                  <span className="text-gray-400">PHASE TIMER: </span>
                  <span className="text-[#ffe27a] font-extrabold text-sm tracking-wider">{Math.ceil(hudState.phaseTimer)}s</span>
                </div>

                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span className={hudState.spottedObjective ? 'text-[#ffe27a] font-bold' : 'text-gray-400'}>
                    OBJ: {hudState.spottedObjective ? '📍 2F VAULT LOCATED' : 'SEARCHING...'}
                  </span>
                  <span className="text-[#7fd6ff]">
                    HOSTILES: <b className="text-white">{hudState.spottedEnemiesCount}</b>
                  </span>
                </div>
              </div>

              {/* Center Drone Optics Reticle (Only when operational) */}
              {!hudState.droneDestroyed && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 pointer-events-none border border-[#7fd6ff]/20 rounded flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#7fd6ff]" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#7fd6ff]" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#7fd6ff]" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#7fd6ff]" />

                  <div className="w-6 h-[1px] bg-[#7fd6ff]/70" />
                  <div className="h-6 w-[1px] bg-[#7fd6ff]/70 absolute" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7fd6ff] absolute" />
                </div>
              )}

              {/* Bottom Drone Command Bar */}
              <div className="relative z-10 flex justify-between items-center bg-black/60 backdrop-blur-md px-6 py-2.5 rounded-lg border border-[#7fd6ff]/30 text-xs shadow-xl">
                <div className="text-[#7fd6ff] font-mono text-xs flex items-center gap-4">
                  <span>[W/A/S/D] Drive</span>
                  <span>·</span>
                  <span>[SPACE] Jump</span>
                  <span>·</span>
                  <span>Aim with Mouse</span>
                  <span>·</span>
                  <span>[5] Deploy / Toggle</span>
                </div>

                <button
                  onClick={() => engineRef.current?.exitDroneMode()}
                  className="pointer-events-auto px-4 py-1.5 bg-gradient-to-r from-[#ff6b4a] to-[#c8431f] text-white font-extrabold text-xs rounded shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  DEPLOY OPERATOR [5]
                </button>
              </div>
            </div>
          ) : hudState.inCctvMode ? (
            /* CCTV Surveillance Camera Mode HUD */
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-30">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,10,20,0.1)_0%,rgba(0,5,10,0.7)_100%)] pointer-events-none" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,36,48,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] opacity-50 pointer-events-none" />

              {/* Destroyed Camera Static Screen Overlay */}
              {hudState.cctvCameras[hudState.activeCctvIndex]?.isDestroyed && (
                <div className="absolute inset-0 bg-red-950/60 backdrop-blur-[3px] flex flex-col items-center justify-center pointer-events-none z-20">
                  <div className="bg-black/90 border border-red-500 p-6 rounded-lg text-center max-w-md shadow-2xl animate-pulse">
                    <div className="text-red-500 font-mono text-2xl font-black tracking-widest mb-1">
                      ⚠️ CAMERA DESTROYED
                    </div>
                    <div className="text-gray-300 font-mono text-xs mb-4">
                      {hudState.cctvCameras[hudState.activeCctvIndex]?.name || 'SECURITY CAMERA'} DESTROYED BY ACCURATE HOSTILE FIRE
                    </div>
                    <div className="text-xs text-gray-400 font-mono mb-4">
                      Circuit severed · Optical Lens Shattered · Feed Offline
                    </div>
                    <div className="flex justify-center gap-3 pointer-events-auto">
                      <button
                        onClick={() => engineRef.current?.prevCctvCamera()}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white font-mono text-xs rounded border border-gray-600 cursor-pointer"
                      >
                        ◄ PREV CAM
                      </button>
                      <button
                        onClick={() => engineRef.current?.nextCctvCamera()}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white font-mono text-xs rounded border border-gray-600 cursor-pointer"
                      >
                        NEXT CAM ►
                      </button>
                      <button
                        onClick={() => engineRef.current?.exitCctvMode()}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold rounded cursor-pointer"
                      >
                        EXIT CCTV [ESC]
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CCTV Header */}
              <div className="relative z-10 flex justify-between items-center bg-black/80 backdrop-blur-md px-6 py-2.5 rounded-lg border border-emerald-500/40 text-xs shadow-xl">
                <div className="flex items-center gap-3 font-mono">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${hudState.cctvCameras[hudState.activeCctvIndex]?.isDestroyed ? 'bg-red-700' : 'bg-red-500 animate-ping'}`} />
                  <span className="font-bold text-emerald-400 tracking-wider">
                    {hudState.cctvCameras[hudState.activeCctvIndex]?.isDestroyed ? '[OFFLINE] CAMERA DESTROYED' : `[REC] ${hudState.cctvCameras[hudState.activeCctvIndex]?.name}`}
                  </span>
                  <span className="text-gray-400 text-[11px]">| FEED {hudState.activeCctvIndex + 1} / {hudState.cctvCameras.length}</span>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto font-mono text-xs">
                  <button
                    onClick={() => engineRef.current?.prevCctvCamera()}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded border border-emerald-500/30 cursor-pointer"
                  >
                    ◄ PREV CAM
                  </button>
                  <button
                    onClick={() => engineRef.current?.nextCctvCamera()}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded border border-emerald-500/30 cursor-pointer"
                  >
                    NEXT CAM ►
                  </button>
                  <button
                    onClick={() => engineRef.current?.exitCctvMode()}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded cursor-pointer ml-2"
                  >
                    EXIT CCTV [ESC]
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Vignette */}
              <div className="absolute inset-0 shadow-[inset_0_0_160px_40px_rgba(0,0,0,0.55)] pointer-events-none" />

              {/* Crosshair with Center Dot */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] pointer-events-none">
                <div className="absolute left-[10px] top-[2px] w-[2px] h-[18px] bg-[#c8f4ff] shadow-[0_0_4px_rgba(127,214,255,0.8)]" />
                <div className="absolute top-[10px] left-[2px] h-[2px] w-[18px] bg-[#c8f4ff] shadow-[0_0_4px_rgba(127,214,255,0.8)]" />
                <div className="absolute left-1/2 top-1/2 w-[3px] h-[3px] bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
              </div>

              {/* Top Tactical Match Header (Attack vs Defense 5v5 Slots) */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/75 backdrop-blur-md px-6 py-2 rounded-xl border border-white/15 text-xs shadow-2xl">
                {/* Attack Squad Alive Icons */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#4ac8ff] text-[11px] mr-1">ATK ({hudState.scoreAtk})</span>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[9px] font-bold ${
                        idx < hudState.atkAlive
                          ? 'bg-[#4ac8ff] text-black shadow-[0_0_6px_rgba(74,200,255,0.8)]'
                          : 'bg-gray-800 text-gray-600 border border-gray-700'
                      }`}
                    >
                      {idx < hudState.atkHumans ? '👤' : '🤖'}
                    </div>
                  ))}
                </div>

                {/* Center Match Round & Objective */}
                <div className="flex flex-col items-center px-4 border-x border-white/10 font-mono">
                  <div className="text-white font-extrabold text-sm tracking-wider">
                    {hudState.objStatus}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    ROUND {hudState.round} · {hudState.playerSide === 'atk' ? 'YOU ATTACK' : 'YOU DEFEND'}
                  </div>
                </div>

                {/* Defense Squad Alive Icons */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[9px] font-bold ${
                        idx < hudState.defAlive
                          ? 'bg-[#ff6b4a] text-black shadow-[0_0_6px_rgba(255,107,74,0.8)]'
                          : 'bg-gray-800 text-gray-600 border border-gray-700'
                      }`}
                    >
                      {idx < hudState.defHumans ? '👤' : '🤖'}
                    </div>
                  ))}
                  <span className="font-bold text-[#ff6b4a] text-[11px] ml-1">DEF ({hudState.scoreDef})</span>
                </div>
              </div>

              {/* Center Tactical Action Prompt (Rappelling, Breaching, Defuser) */}
              <div className="absolute top-[62%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
                {/* Defuser Planting Prompt for Attackers */}
                {hudState.canPlantDefuser && (
                  <div className="flex flex-col items-center gap-1.5 bg-black/85 border border-[#ffe27a]/80 px-6 py-3 rounded-lg shadow-2xl backdrop-blur-md">
                    <div className="text-[#ffe27a] font-mono font-black text-sm tracking-wider animate-pulse">
                      [HOLD F] PLANT DEFUSER CASE
                    </div>
                    {hudState.plantProgress > 0 && (
                      <div className="w-52 h-2.5 bg-gray-800 rounded-full overflow-hidden border border-[#ffe27a]/40">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-75"
                          style={{ width: `${hudState.plantProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Defuser Disabling Prompt for Defenders */}
                {hudState.canDefuse && (
                  <div className="flex flex-col items-center gap-1.5 bg-black/85 border border-emerald-400/80 px-6 py-3 rounded-lg shadow-2xl backdrop-blur-md">
                    <div className="text-emerald-400 font-mono font-black text-sm tracking-wider animate-pulse">
                      [HOLD F] DISABLE ENEMY DEFUSER
                    </div>
                    {hudState.defuseProgress > 0 && (
                      <div className="w-52 h-2.5 bg-gray-800 rounded-full overflow-hidden border border-emerald-400/40">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-teal-300 transition-all duration-75"
                          style={{ width: `${hudState.defuseProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {hudState.canKickBreach && (
                  <div className="px-4 py-1.5 bg-[#ff3b30]/90 text-white font-extrabold text-sm rounded border border-white shadow-xl animate-pulse">
                    [SPACE] KICK-BREACH WINDOW ENTRY!
                  </div>
                )}
                {hudState.isRappelling && !hudState.canKickBreach && (
                  <div className="px-4 py-1 bg-black/70 text-[#7fd6ff] font-bold text-xs rounded border border-[#7fd6ff]/50 backdrop-blur-xs">
                    🧗 RAPPEL ACTIVE · [W/S] Climb/Descend · [A/D] Swing · [C] Detach
                  </div>
                )}
                {hudState.canRappel && (
                  <div className="px-3 py-1 bg-black/70 text-[#ffe27a] font-bold text-xs rounded border border-[#ffe27a]/50 backdrop-blur-xs">
                    [SPACE] HOOK RAPPEL CABLE (EXTERIOR WALL)
                  </div>
                )}
              </div>

              {/* Sniper Scope Overlay & Thermal Target Highlighting */}
              {hudState.isAiming && hudState.isSniper && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-25">
                  <div className="relative w-[540px] h-[540px] rounded-full border-4 border-black bg-black/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-red-600/90 shadow-[0_0_8px_red]" />
                      <div className="absolute h-full w-0.5 bg-red-600/90 shadow-[0_0_8px_red]" />
                      <div className="absolute w-36 h-36 rounded-full border border-red-500/70" />
                      <div className="absolute w-72 h-72 rounded-full border border-red-500/40" />
                      <div className="absolute top-14 text-[11px] font-mono font-bold text-red-500 tracking-widest drop-shadow">3.8x OPTICAL ZOOM</div>
                      <div className="absolute bottom-16 text-[10px] font-mono text-emerald-400 font-bold animate-pulse tracking-wide">THERMAL TARGET HIGHLIGHTING ACTIVE</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tactical Minimap */}
              {engineRef.current && <Minimap engine={engineRef.current} />}

              {/* Tactical Comms & Killfeed (Top Left) */}
              <div className="absolute left-5 top-16 text-xs text-[#bcd] max-w-sm space-y-1 pointer-events-none drop-shadow-md">
                {logMessages.map((msg, idx) => (
                  <div key={idx} className="bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs border-l-2 border-[#7fd6ff]">
                    {msg}
                  </div>
                ))}
              </div>

              {/* Chat Feed (Middle Left) */}
              {chatMessages.length > 0 && (
                <div className="absolute left-5 top-56 max-w-xs space-y-1 pointer-events-none">
                  {chatMessages.slice(-5).map((c, i) => (
                    <div key={i} className="bg-black/70 px-2 py-0.5 rounded text-[11px] border-l-2 border-[#ffe27a]">
                      <span className={c.side === 'atk' ? 'text-[#4ac8ff] font-bold' : 'text-[#ff6b4a] font-bold'}>
                        [{c.sender}]:
                      </span>{' '}
                      <span className="text-gray-200">{c.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Chat Input Overlay (When active) */}
              {chatOpen && (
                <form
                  onSubmit={handleSendChat}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 w-96 z-30 pointer-events-auto bg-black/90 border border-[#7fd6ff] p-2 rounded-lg shadow-2xl flex gap-2"
                >
                  <input
                    type="text"
                    autoFocus
                    placeholder="Broadcast LAN comms (Enter to send, Esc to cancel)..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-[#132433] text-white px-3 py-1 text-xs rounded border border-[#2c5771] outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-[#2c5771] hover:bg-[#3d7596] text-white px-3 py-1 text-xs rounded font-bold cursor-pointer"
                  >
                    SEND
                  </button>
                </form>
              )}

              {/* Bottom Left: Health, Ability & Gadget Charges */}
              <div className="absolute left-5 bottom-5 flex flex-col gap-2">
                {/* Breach Charge Indicator */}
                <div className="flex items-center gap-2">
                  {hudState.hasActiveBreachCharge ? (
                    <div className="px-3 py-1 bg-gradient-to-r from-[#ff3333] to-[#ff6600] text-white font-black text-xs rounded shadow-lg animate-pulse tracking-wide">
                      💥 [B] DETONATE BREACH CHARGE!
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 bg-black/70 border border-[#4a5568] text-gray-300 font-mono text-xs rounded">
                      💣 [B] BREACH CHARGES: <span className="text-[#ffe27a] font-bold">{hudState.breachChargesLeft}</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-[#ffe27a] font-semibold drop-shadow">{hudState.abilityText}</div>
                <div className="w-56 h-4 bg-black/60 border border-[#345] rounded overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff6b4a] to-[#ffdd4a] transition-all duration-150"
                    style={{ width: `${hudState.hp}%` }}
                  />
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  OPERATOR: {selectedOp.name} ({hudState.playerSide.toUpperCase()}) | HP: {Math.round(hudState.hp)}
                </div>
              </div>

              {/* Bottom Right: Ammo & Weapon */}
              <div className="absolute right-5 bottom-5 text-right flex flex-col items-end gap-1">
                <button
                  onClick={() => setShowLoadoutModal(true)}
                  className="pointer-events-auto px-2.5 py-1 bg-[#0b141d]/90 hover:bg-[#152e42] text-[#ffe27a] border border-[#ffe27a]/60 rounded font-mono text-[11px] font-bold shadow-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  ⚙️ [N] OPERATOR / LOADOUT
                </button>
                <div className="text-3xl font-extrabold text-[#eef] tracking-wider leading-none drop-shadow">
                  {hudState.ammo} <span className="text-base font-normal text-[#8ab]">/ {hudState.ammoReserve}</span>
                </div>
                <div className="text-xs text-gray-300 font-semibold">{hudState.weaponName}</div>
              </div>

              {/* Controls / Pointer Hint */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[11px] text-[#89a] tracking-wide text-center">
                Click to lock · WASD move · Hold LMB full auto · V melee · Shift sprint · Space rappel/vault · B breach · C crouch · Q/E lean · R reload · F ability · N loadout · 5 drone · Hold TAB gadgets · O scoreboard · T chat
              </div>
            </>
          )}

          {/* In-Game Operator & Loadout Selection Modal */}
          <InGameLoadoutModal
            isOpen={showLoadoutModal}
            onClose={() => setShowLoadoutModal(false)}
            selectedOp={selectedOp}
            onSelectOp={(op) => {
              setSelectedOp(op);
              const recIdx = getRecommendedWeaponIndex(op);
              setSelectedWeaponIdx(recIdx);
              if (engineRef.current) {
                engineRef.current.setOperatorAndWeapon(op, recIdx);
              }
            }}
            selectedWeaponIdx={selectedWeaponIdx}
            onSelectWeaponIdx={(idx) => {
              setSelectedWeaponIdx(idx);
              if (engineRef.current) {
                engineRef.current.setOperatorAndWeapon(selectedOp, idx);
              }
            }}
            currentRoundSide={(hudState.playerSide as 'atk' | 'def') || 'atk'}
            roundNumber={hudState.round}
            onConfirmAndSpawn={() => {
              if (engineRef.current) {
                engineRef.current.setOperatorAndWeapon(selectedOp, selectedWeaponIdx);
                if (engineRef.current.renderer) {
                  try {
                    engineRef.current.renderer.domElement.requestPointerLock();
                  } catch {}
                }
              }
              setShowLoadoutModal(false);
            }}
          />

          {/* Scoreboard Overlay (Tab Key) */}
          {showScoreboard && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-6">
              <div className="bg-[#0f1923] border border-[#7fd6ff]/40 rounded-xl p-6 w-full max-w-3xl shadow-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-[#2c5771]/60 pb-3">
                  <div>
                    <h2 className="text-xl font-black tracking-wider text-[#7fd6ff]">TACTICAL SCOREBOARD</h2>
                    <p className="text-xs text-gray-400 font-mono">LAN Match Room: {roomId} · Score: Attack {hudState.scoreAtk} - {hudState.scoreDef} Defense</p>
                  </div>
                  <button
                    onClick={() => setShowScoreboard(false)}
                    className="pointer-events-auto px-3 py-1 bg-[#2c5771] hover:bg-[#3d7596] text-white text-xs font-bold rounded cursor-pointer"
                  >
                    CLOSE [TAB]
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  {/* Attackers Table */}
                  <div className="bg-[#0b141d] p-3 rounded-lg border border-[#4ac8ff]/40">
                    <div className="text-[#4ac8ff] font-bold text-sm mb-2">ATTACKING SQUAD (BLUE)</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-gray-400 border-b border-gray-800 pb-1 text-[11px]">
                        <span>OPERATIVE</span>
                        <span>STATUS</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-300 font-bold bg-[#142834] p-1.5 rounded">
                        <span>👤 {playerName} (YOU) - {selectedOp.name}</span>
                        <span className={hudState.alive ? 'text-emerald-400' : 'text-red-400'}>{hudState.alive ? 'ALIVE' : 'KIA'}</span>
                      </div>
                      {engineRef.current?.bots.filter(b => b.side === 'atk').map((b, i) => (
                        <div key={i} className="flex justify-between items-center text-gray-300 p-1">
                          <span>🤖 AI-{b.op.name} ({b.personality.name})</span>
                          <span className={b.alive ? 'text-gray-200' : 'text-red-400'}>{b.alive ? `${Math.round(b.hp)} HP` : 'KIA'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Defenders Table */}
                  <div className="bg-[#0b141d] p-3 rounded-lg border border-[#ff6b4a]/40">
                    <div className="text-[#ff6b4a] font-bold text-sm mb-2">DEFENDING SQUAD (ORANGE)</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-gray-400 border-b border-gray-800 pb-1 text-[11px]">
                        <span>OPERATIVE</span>
                        <span>STATUS</span>
                      </div>
                      {engineRef.current?.bots.filter(b => b.side === 'def').map((b, i) => (
                        <div key={i} className="flex justify-between items-center text-gray-300 p-1">
                          <span>🤖 AI-{b.op.name} ({b.personality.name})</span>
                          <span className={b.alive ? 'text-gray-200' : 'text-red-400'}>{b.alive ? `${Math.round(b.hp)} HP` : 'KIA'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Death Screen */}
          {!hudState.alive && (
            <div className="absolute inset-0 bg-[#320000]/50 flex flex-col items-center justify-center gap-3 text-3xl tracking-[4px] text-[#ff8a70] font-extrabold backdrop-blur-[2px]">
              <div>ELIMINATED</div>
              <div className="text-xs text-gray-300 tracking-normal font-normal">Spectating active tactical squad until round completes...</div>
            </div>
          )}

          {/* Match Over Modal */}
          {matchOver && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-4 z-40 backdrop-blur-md pointer-events-auto">
              <div className="text-3xl font-extrabold tracking-widest text-[#ffe27a]">MATCH OVER</div>
              <div className="text-xl text-[#7fd6ff] font-bold">{matchWinner} WINS</div>
              <div className="text-sm text-gray-300">Final Score: {finalScore}</div>
              <button
                className="mt-4 px-6 py-2.5 bg-gradient-to-b from-[#ff6b4a] to-[#c8431f] text-white rounded font-bold hover:brightness-110 cursor-pointer pointer-events-auto shadow-lg"
                onClick={handleReturnToMenu}
              >
                RETURN TO MENU
              </button>
            </div>
          )}

          {/* Gadget Wheel — hold TAB to open, hover an item, release TAB to equip/use it */}
          {showGadgetWheel && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-5 pointer-events-auto">
              <div className="text-xs tracking-[0.3em] text-[#7fd6ff] font-bold">HOLD TAB · HOVER · RELEASE TO EQUIP</div>
              <div className="flex flex-wrap items-stretch justify-center gap-4 max-w-3xl">
                {(() => {
                  const items: Array<{ id: string; label: string; sub: string; icon: string; disabled?: boolean }> = [];
                  items.push({
                    id: 'ability',
                    label: hudState.gadgetName,
                    sub: `${hudState.gadgetCharges} charge${hudState.gadgetCharges === 1 ? '' : 's'}`,
                    icon: '🔥',
                    disabled: hudState.gadgetCharges <= 0
                  });
                  if (hudState.playerSide === 'atk') {
                    items.push({
                      id: 'breach',
                      label: 'Breach Charge',
                      sub: `${hudState.breachChargesLeft} left`,
                      icon: '💣',
                      disabled: hudState.breachChargesLeft <= 0 && !hudState.hasActiveBreachCharge
                    });
                    items.push({
                      id: 'drone',
                      label: 'Recon Drone',
                      sub: hudState.inDroneMode ? 'Recall' : `${hudState.dronesReserve} left`,
                      icon: '🛸',
                      disabled: !hudState.inDroneMode && hudState.dronesReserve <= 0
                    });
                  } else {
                    items.push({
                      id: 'cctv',
                      label: 'CCTV Feed',
                      sub: hudState.inCctvMode ? 'Exit feed' : `${hudState.cctvCameras.length} camera${hudState.cctvCameras.length === 1 ? '' : 's'}`,
                      icon: '📹'
                    });
                  }
                  if (hudState.throwableType) {
                    items.push({
                      id: 'camera',
                      label: hudState.throwableType === 'maestro_cam' ? 'Evil Eye Cam' : 'Recon Cam',
                      sub: 'Place on surface',
                      icon: '🎥'
                    });
                  }
                  return items.map(item => (
                    <div
                      key={item.id}
                      onMouseEnter={() => !item.disabled && setHoveredGadget(item.id)}
                      onMouseLeave={() => setHoveredGadget(prev => (prev === item.id ? null : prev))}
                      className={`w-36 h-36 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all select-none ${
                        item.disabled
                          ? 'border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed'
                          : hoveredGadget === item.id
                          ? 'border-[#ffe27a] bg-[#ffe27a]/15 text-[#ffe27a] scale-105 shadow-lg'
                          : 'border-[#345] bg-black/50 text-gray-200'
                      }`}
                    >
                      <div className="text-3xl">{item.icon}</div>
                      <div className="text-sm font-bold text-center px-2">{item.label}</div>
                      <div className="text-[11px] text-gray-400">{item.sub}</div>
                    </div>
                  ));
                })()}
              </div>
              <div className="text-[11px] text-gray-400">Release TAB with nothing hovered to cancel</div>
            </div>
          )}

          {/* Pause Menu */}
          <PauseMenu
            isOpen={showPauseMenu}
            onClose={() => {
              setShowPauseMenu(false);
              if (engineRef.current?.renderer) {
                engineRef.current.renderer.domElement.requestPointerLock();
              }
            }}
            onReturnToRoster={handleReturnToMenu}
          />

          {/* Diagnostics Panel (` key) */}
          {hudState.diagOn && (
            <div className="absolute top-2.5 right-2.5 z-50 bg-black/90 text-[#8f8] font-mono text-[11px] p-3.5 rounded-lg border border-[#8f8]/30 max-w-sm max-h-[80vh] overflow-y-auto whitespace-pre-wrap shadow-xl">
              <div className="font-bold text-white border-b border-[#8f8]/30 pb-1 mb-2">LIVE DIAGNOSTICS (Toggle with `)</div>
              {hudState.diagInfo}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
