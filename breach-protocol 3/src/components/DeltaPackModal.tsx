import React, { useState, useEffect } from 'react';
import { Package, Sparkles, X, ChevronRight, Check, Award, RefreshCw } from 'lucide-react';
import { SkinManager, WeaponSkin, SkinRarity } from '../game/SkinShopData';
import { RankedSystem } from '../game/RankedSystem';
import { sound as audioSystem } from '../audio/SoundEngine';

interface DeltaPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  packCount: number;
  onPacksUpdated: (newCount: number) => void;
  onRenownUpdated: (newRenown: number) => void;
}

export const DeltaPackModal: React.FC<DeltaPackModalProps> = ({
  isOpen,
  onClose,
  packCount,
  onPacksUpdated,
  onRenownUpdated
}) => {
  const [packType, setPackType] = useState<'delta' | 'black_ice'>('delta');
  const [blackIcePackCount, setBlackIcePackCount] = useState<number>(() => SkinManager.getBlackIcePackCount());
  const [stage, setStage] = useState<'idle' | 'unzipping' | 'revealed'>('idle');
  const [openedItem, setOpenedItem] = useState<{ skin: WeaponSkin; isDuplicate: boolean; duplicateRenown: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBlackIcePackCount(SkinManager.getBlackIcePackCount());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCount = packType === 'delta' ? packCount : blackIcePackCount;

  const handleOpenPack = () => {
    if (currentCount <= 0 || stage === 'unzipping') return;

    if (packType === 'delta') {
      const remaining = SkinManager.addDeltaPacks(-1);
      onPacksUpdated(remaining);
    } else {
      const remaining = SkinManager.addBlackIcePacks(-1);
      setBlackIcePackCount(remaining);
    }

    setStage('unzipping');
    audioSystem.woodSnap();

    setTimeout(() => {
      const drop = packType === 'delta' ? SkinManager.rollDeltaPack() : SkinManager.rollBlackIcePack();
      setOpenedItem(drop);
      setStage('revealed');

      if (drop.skin.rarity === 'black_ice') {
        audioSystem.secure();
      } else if (drop.skin.rarity === 'legendary') {
        audioSystem.roundWin();
      } else {
        audioSystem.playGadgetDeploy();
      }

      if (drop.isDuplicate && drop.duplicateRenown > 0) {
        const updatedRenown = RankedSystem.addRenown(drop.duplicateRenown);
        onRenownUpdated(updatedRenown);
      }
    }, 1200);
  };

  const getRarityBadge = (rarity: SkinRarity) => {
    switch (rarity) {
      case 'black_ice':
        return { label: 'BLACK ICE', color: '#00f0ff', glow: 'shadow-[0_0_25px_#00f0ff]', bg: 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]' };
      case 'legendary':
        return { label: 'LEGENDARY', color: '#ffd700', glow: 'shadow-[0_0_25px_#ffd700]', bg: 'bg-amber-500/20 text-amber-400 border-amber-400' };
      case 'epic':
        return { label: 'EPIC', color: '#a855f7', glow: 'shadow-[0_0_20px_#a855f7]', bg: 'bg-purple-500/20 text-purple-400 border-purple-400' };
      case 'rare':
        return { label: 'RARE', color: '#38bdf8', glow: 'shadow-[0_0_15px_#38bdf8]', bg: 'bg-sky-500/20 text-sky-400 border-sky-400' };
      default:
        return { label: 'UNCOMMON', color: '#10b981', glow: 'shadow-[0_0_10px_#10b981]', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-400' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#08101a] border border-[#38bdf8]/40 rounded-2xl shadow-[0_0_60px_rgba(56,189,248,0.25)] p-6 text-white flex flex-col items-center gap-5 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center w-full">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Package className="w-5 h-5 text-cyan-400 animate-bounce" />
            <h2 className="text-xl font-black tracking-widest text-[#7fd6ff] font-mono uppercase">
              TACTICAL WEAPON PACKS
            </h2>
          </div>
          
          {/* Pack Selector Tabs */}
          <div className="flex items-center justify-center gap-2 my-2">
            <button
              onClick={() => { if (stage === 'idle') setPackType('delta'); }}
              disabled={stage !== 'idle'}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                packType === 'delta'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400'
                  : 'bg-[#0f1b29] text-gray-400 hover:text-white border border-[#1b2b3d]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>DELTA PACKS ({packCount})</span>
            </button>

            <button
              onClick={() => { if (stage === 'idle') setPackType('black_ice'); }}
              disabled={stage !== 'idle'}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                packType === 'black_ice'
                  ? 'bg-gradient-to-r from-[#00f0ff] to-[#0284c7] text-black shadow-[0_0_20px_rgba(0,240,255,0.5)] border border-[#00f0ff]'
                  : 'bg-[#0f1b29] text-gray-400 hover:text-cyan-300 border border-[#1b2b3d]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>BLACK ICE PACKS ({blackIcePackCount})</span>
            </button>
          </div>

          <p className="text-xs text-gray-400 font-mono">
            {packType === 'delta' ? (
              <>Packs Available: <span className="text-amber-400 font-bold">{packCount}</span> · Chance for Black Ice & Epic skins</>
            ) : (
              <>Packs Available: <span className="text-[#00f0ff] font-bold">{blackIcePackCount}</span> · <span className="text-cyan-300 font-bold">35% High-Drop Chance</span> for Black Ice!</>
            )}
          </p>
        </div>

        {/* Main Stage */}
        <div className="w-full flex flex-col items-center justify-center py-6 min-h-[260px] relative">
          {stage === 'idle' && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative group cursor-pointer" onClick={handleOpenPack}>
                <div className={`w-36 h-48 rounded-2xl flex flex-col items-center justify-between p-4 transition-all duration-300 group-hover:scale-105 border-2 ${
                  packType === 'black_ice'
                    ? 'bg-gradient-to-br from-[#0a2336] to-[#04121e] border-[#00f0ff]/80 shadow-[0_0_40px_rgba(0,240,255,0.4)]'
                    : 'bg-gradient-to-br from-[#122334] to-[#0a1420] border-[#38bdf8]/60 shadow-[0_0_30px_rgba(56,189,248,0.3)]'
                }`}>
                  <div className="w-full flex justify-between items-center text-[10px] font-mono text-cyan-400/80">
                    <span>{packType === 'black_ice' ? 'GLACIER-ICE' : 'DELTA-01'}</span>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                  <div className={`p-3 rounded-full border ${
                    packType === 'black_ice'
                      ? 'bg-[#00f0ff]/20 border-[#00f0ff]/50 text-[#00f0ff] shadow-[0_0_15px_#00f0ff]'
                      : 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300'
                  }`}>
                    <Package className="w-12 h-12" />
                  </div>
                  <div className="w-full bg-[#1b344b] rounded-full h-2 overflow-hidden">
                    <div className={`h-full w-4/5 animate-pulse ${
                      packType === 'black_ice'
                        ? 'bg-gradient-to-r from-[#00f0ff] to-sky-300'
                        : 'bg-gradient-to-r from-cyan-400 to-amber-400'
                    }`} />
                  </div>
                </div>
              </div>

              {currentCount > 0 ? (
                <button
                  onClick={handleOpenPack}
                  className={`px-8 py-3 font-black font-mono text-sm tracking-wider rounded-xl active:scale-95 transition-all cursor-pointer ${
                    packType === 'black_ice'
                      ? 'bg-gradient-to-r from-[#00f0ff] to-[#0284c7] hover:brightness-110 text-black shadow-[0_0_30px_rgba(0,240,255,0.5)]'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                  }`}
                >
                  {packType === 'black_ice' ? 'BREACH BLACK ICE PACK' : 'BREACH DELTA PACK'}
                </button>
              ) : (
                <div className="text-center text-xs text-gray-400 font-mono">
                  No {packType === 'black_ice' ? 'Black Ice' : 'Delta'} Packs remaining. Win Ranked matches or buy packs in the Skin Shop!
                </div>
              )}
            </div>
          )}

          {stage === 'unzipping' && (
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-36 h-48 bg-gradient-to-br from-cyan-600 to-amber-600 rounded-2xl flex items-center justify-center shadow-[0_0_60px_rgba(56,189,248,0.8)] scale-110 transition-transform">
                <Sparkles className="w-16 h-16 text-white animate-spin" />
              </div>
              <span className="font-mono text-xs tracking-widest text-cyan-300 animate-bounce">
                BREACHING SEAL...
              </span>
            </div>
          )}

          {stage === 'revealed' && openedItem && (
            <div className="flex flex-col items-center gap-4 text-center animate-in zoom-in-75 duration-300 w-full max-w-sm">
              {/* Rarity Flare */}
              {(() => {
                const badge = getRarityBadge(openedItem.skin.rarity);
                return (
                  <>
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-black border ${badge.bg} ${badge.glow}`}>
                      {badge.label}
                    </span>

                    <div
                      className="w-36 h-36 rounded-2xl border-2 flex items-center justify-center p-4 relative shadow-2xl"
                      style={{
                        backgroundColor: '#0a1622',
                        borderColor: badge.color,
                        boxShadow: `0 0 35px ${badge.color}66`
                      }}
                    >
                      <div
                        className="w-24 h-24 rounded-xl flex items-center justify-center text-4xl"
                        style={{
                          background: `radial-gradient(circle, ${badge.color}44 0%, #000 100%)`
                        }}
                      >
                        {openedItem.skin.rarity === 'black_ice' ? '❄️' : '🔫'}
                      </div>
                      {openedItem.isDuplicate && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-300 font-mono text-[9px] font-bold">
                          DUPLICATE
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-black font-mono text-white tracking-wider">
                        {openedItem.skin.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">
                        {openedItem.skin.description}
                      </p>
                      {openedItem.isDuplicate && (
                        <p className="text-xs text-amber-400 font-mono mt-1 font-bold">
                          Converted to +{openedItem.duplicateRenown} Renown!
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          SkinManager.setEquippedSkinId(openedItem.skin.id);
                          setStage('idle');
                        }}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        EQUIP SKIN
                      </button>
                      {packCount > 0 ? (
                        <button
                          onClick={() => {
                            setStage('idle');
                            setTimeout(handleOpenPack, 50);
                          }}
                          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          OPEN NEXT ({packCount})
                        </button>
                      ) : (
                        <button
                          onClick={() => setStage('idle')}
                          className="px-5 py-2 bg-[#1b2b3a] hover:bg-[#25394d] text-gray-300 font-mono font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          DONE
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
