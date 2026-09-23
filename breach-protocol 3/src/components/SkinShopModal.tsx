import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  ShoppingBag,
  Coins,
  Sparkles,
  Check,
  X,
  Package,
  Layers,
  ArrowRight,
  Shield,
  Eye
} from 'lucide-react';
import {
  WEAPON_SKINS,
  WeaponSkin,
  OPERATOR_SKINS,
  OperatorSkin,
  ITEM_SKINS,
  ItemSkin,
  SkinManager,
  SkinRarity
} from '../game/SkinShopData';
import { RankedSystem } from '../game/RankedSystem';
import { ModelFactory } from '../game/ModelFactory';
import { sound as audioSystem } from '../audio/SoundEngine';

interface SkinShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  renown: number;
  onRenownUpdated: (newRenown: number) => void;
  onOpenDeltaPacks: () => void;
  onOpenCodeMenu: () => void;
}

export const SkinShopModal: React.FC<SkinShopModalProps> = ({
  isOpen,
  onClose,
  renown,
  onRenownUpdated,
  onOpenDeltaPacks,
  onOpenCodeMenu
}) => {
  const [activeTab, setActiveTab] = useState<'weapons' | 'operators' | 'items'>('weapons');
  const [selectedSkin, setSelectedSkin] = useState<WeaponSkin>(WEAPON_SKINS[1]);
  const [selectedOpSkin, setSelectedOpSkin] = useState<OperatorSkin>(OPERATOR_SKINS[0]);
  const [selectedItemSkin, setSelectedItemSkin] = useState<ItemSkin>(ITEM_SKINS[0]);
  const [previewWeapon, setPreviewWeapon] = useState<string>('l85a2');
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>([]);
  const [equippedSkinId, setEquippedSkinId] = useState<string>('default');
  const [unlockedOpSkins, setUnlockedOpSkins] = useState<string[]>([]);
  const [equippedOpSkinId, setEquippedOpSkinId] = useState<string>('op_default');
  const [unlockedItemSkins, setUnlockedItemSkins] = useState<string[]>([]);
  const [equippedItemSkinId, setEquippedItemSkinId] = useState<string>('item_default');
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const threeStateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    gunGroup: THREE.Group | null;
    animId: number | null;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUnlockedSkins(SkinManager.getUnlockedSkins());
      setEquippedSkinId(SkinManager.getEquippedSkinId());
      try {
        const storedOp = localStorage.getItem('breach_protocol_unlocked_op_skins_v1');
        setUnlockedOpSkins(storedOp ? JSON.parse(storedOp) : ['op_default']);
      } catch {
        setUnlockedOpSkins(['op_default']);
      }
      setEquippedOpSkinId(SkinManager.getEquippedOperatorSkinId());
      try {
        const storedItem = localStorage.getItem('breach_protocol_unlocked_item_skins_v1');
        setUnlockedItemSkins(storedItem ? JSON.parse(storedItem) : ['item_default']);
      } catch {
        setUnlockedItemSkins(['item_default']);
      }
      setEquippedItemSkinId(SkinManager.getEquippedItemSkinId());
    }
  }, [isOpen]);

  // 3D Three.js weapon inspect preview
  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current) return;

    let timer: any = null;
    const initViewer = () => {
      if (!previewCanvasRef.current) return;
      const container = previewCanvasRef.current;
      const width = container.clientWidth || 360;
      const height = container.clientHeight || 260;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a121c);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
      camera.position.set(0, 0.15, 1.1);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      // Studio 3-point lighting
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(2, 3, 2);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x7fd6ff, 1.4);
      fillLight.position.set(-3, -1, 1);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xffaa44, 2.0);
      rimLight.position.set(0, 2, -2);
      scene.add(rimLight);

      const ambient = new THREE.AmbientLight(0x1a2634, 1.8);
      scene.add(ambient);

      // Ground reflection grid
      const grid = new THREE.GridHelper(4, 16, 0x224466, 0x112233);
      grid.position.y = -0.3;
      scene.add(grid);

      // Build initial gun model
      const gun = ModelFactory.createTacticalWeaponWithSkin(previewWeapon, selectedSkin);
      gun.position.set(0, 0, 0);
      gun.scale.set(1.4, 1.4, 1.4);
      scene.add(gun);

      threeStateRef.current = {
        renderer,
        scene,
        camera,
        gunGroup: gun,
        animId: null
      };

      let rotY = 0;
      const animate = () => {
        rotY += 0.012;
        if (threeStateRef.current?.gunGroup) {
          threeStateRef.current.gunGroup.rotation.y = rotY;
        }
        renderer.render(scene, camera);
        threeStateRef.current!.animId = requestAnimationFrame(animate);
      };
      animate();
    };

    timer = setTimeout(initViewer, 50);

    return () => {
      if (timer) clearTimeout(timer);
      if (threeStateRef.current?.animId) {
        cancelAnimationFrame(threeStateRef.current.animId);
      }
      if (threeStateRef.current?.renderer) {
        threeStateRef.current.renderer.dispose();
      }
      if (previewCanvasRef.current) {
        previewCanvasRef.current.innerHTML = '';
      }
    };
  }, [isOpen, previewWeapon, activeTab]);

  // Update 3D gun model when selected skin or preview weapon changes
  useEffect(() => {
    if (!threeStateRef.current) return;
    const { scene } = threeStateRef.current;

    if (threeStateRef.current.gunGroup) {
      scene.remove(threeStateRef.current.gunGroup);
    }

    // Build tactical weapon with the skin's colors/finishes
    const gun = ModelFactory.createTacticalWeaponWithSkin(previewWeapon, selectedSkin);
    gun.position.set(0, 0, 0);
    gun.scale.set(1.4, 1.4, 1.4);
    scene.add(gun);
    threeStateRef.current.gunGroup = gun;
  }, [selectedSkin, previewWeapon]);

  if (!isOpen) return null;

  const isCurrentUnlocked = 
    activeTab === 'weapons' ? unlockedSkins.includes(selectedSkin.id) :
    activeTab === 'operators' ? unlockedOpSkins.includes(selectedOpSkin.id) :
    unlockedItemSkins.includes(selectedItemSkin.id);

  const isCurrentEquipped = 
    activeTab === 'weapons' ? equippedSkinId === selectedSkin.id :
    activeTab === 'operators' ? equippedOpSkinId === selectedOpSkin.id :
    equippedItemSkinId === selectedItemSkin.id;

  const currentPrice = 
    activeTab === 'weapons' ? selectedSkin.priceRenown :
    activeTab === 'operators' ? selectedOpSkin.priceRenown :
    selectedItemSkin.priceRenown;

  const currentName = 
    activeTab === 'weapons' ? selectedSkin.name :
    activeTab === 'operators' ? selectedOpSkin.name :
    selectedItemSkin.name;

  const currentDesc = 
    activeTab === 'weapons' ? selectedSkin.description :
    activeTab === 'operators' ? selectedOpSkin.description :
    selectedItemSkin.description;

  const currentRarity = 
    activeTab === 'weapons' ? selectedSkin.rarity :
    activeTab === 'operators' ? selectedOpSkin.rarity :
    selectedItemSkin.rarity;

  const canAffordCurrent = renown >= currentPrice;

  const handleBuyCurrentSkin = () => {
    if (isCurrentUnlocked) return;
    if (!canAffordCurrent) {
      setPurchaseNotice('Insufficient Renown! Play Ranked matches or enter a code to earn more.');
      return;
    }

    const newRenown = RankedSystem.addRenown(-currentPrice);
    onRenownUpdated(newRenown);

    if (activeTab === 'weapons') {
      const updated = [...unlockedSkins, selectedSkin.id];
      SkinManager.saveUnlockedSkins(updated);
      setUnlockedSkins(updated);
    } else if (activeTab === 'operators') {
      const updated = [...unlockedOpSkins, selectedOpSkin.id];
      setUnlockedOpSkins(updated);
      try { localStorage.setItem('breach_protocol_unlocked_op_skins_v1', JSON.stringify(updated)); } catch {}
    } else {
      const updated = [...unlockedItemSkins, selectedItemSkin.id];
      setUnlockedItemSkins(updated);
      try { localStorage.setItem('breach_protocol_unlocked_item_skins_v1', JSON.stringify(updated)); } catch {}
    }

    audioSystem.secure();
    setPurchaseNotice(`Successfully unlocked ${currentName}!`);
    setTimeout(() => setPurchaseNotice(null), 3500);
  };

  const handleEquipCurrentSkin = () => {
    if (!isCurrentUnlocked) return;
    if (activeTab === 'weapons') {
      SkinManager.setEquippedSkinId(selectedSkin.id);
      setEquippedSkinId(selectedSkin.id);
    } else if (activeTab === 'operators') {
      SkinManager.setEquippedOperatorSkinId(selectedOpSkin.id);
      setEquippedOpSkinId(selectedOpSkin.id);
    } else {
      SkinManager.setEquippedItemSkinId(selectedItemSkin.id);
      setEquippedItemSkinId(selectedItemSkin.id);
    }
    audioSystem.playGadgetDeploy();
  };

  const handleBuyDeltaPack = () => {
    const packPrice = 5000;
    if (renown < packPrice) {
      setPurchaseNotice('A Delta Pack costs 5,000 Renown. Play Ranked to earn faster!');
      return;
    }
    const newRenown = RankedSystem.addRenown(-packPrice);
    SkinManager.addDeltaPacks(1);
    onRenownUpdated(newRenown);
    audioSystem.woodSnap();
    setPurchaseNotice('Purchased 1x Tactical Delta Pack! Open it in the Delta Packs menu.');
    setTimeout(() => setPurchaseNotice(null), 3000);
  };

  const handleBuyBlackIcePack = () => {
    const packPrice = 15000;
    if (renown < packPrice) {
      setPurchaseNotice('A Black Ice Tactical Pack costs 15,000 Renown. Play Ranked to earn faster!');
      return;
    }
    const newRenown = RankedSystem.addRenown(-packPrice);
    SkinManager.addBlackIcePacks(1);
    onRenownUpdated(newRenown);
    audioSystem.secure();
    setPurchaseNotice('Purchased 1x Black Ice Tactical Pack! 35% chance for authentic Black Ice.');
    setTimeout(() => setPurchaseNotice(null), 3000);
  };

  const getRarityBadge = (rarity: SkinRarity) => {
    switch (rarity) {
      case 'black_ice':
        return { label: 'BLACK ICE', color: '#00f0ff', badgeBg: 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]' };
      case 'legendary':
        return { label: 'LEGENDARY', color: '#ffd700', badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-400' };
      case 'epic':
        return { label: 'EPIC', color: '#c084fc', badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-400' };
      case 'rare':
        return { label: 'RARE', color: '#38bdf8', badgeBg: 'bg-sky-500/20 text-sky-400 border-sky-400' };
      default:
        return { label: 'UNCOMMON', color: '#34d399', badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-400' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] bg-[#070e17] border border-[#38bdf8]/40 rounded-2xl shadow-[0_0_80px_rgba(56,189,248,0.2)] p-6 text-white flex flex-col justify-between overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2b3d] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/40 text-cyan-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-widest text-[#7fd6ff] font-mono uppercase">
                TACTICAL ARMORY & SKIN SHOP
              </h2>
              <p className="text-xs text-gray-400">
                Unlock exclusive firearm finishes, Black Ice camos, and Delta Packs
              </p>
            </div>
          </div>

          {/* Quick Actions & Renown Display */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCodeMenu}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#122030] hover:bg-[#1a2e44] border border-[#2b4b6b] rounded-lg text-xs font-mono text-amber-300 font-bold cursor-pointer transition-all active:scale-95"
            >
              <span>🔑</span>
              REDEEM CODE
            </button>

            <button
              onClick={onOpenDeltaPacks}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:brightness-125 border border-cyan-400/50 rounded-lg text-xs font-mono text-cyan-300 font-bold cursor-pointer transition-all active:scale-95"
            >
              <Package className="w-3.5 h-3.5" />
              DELTA PACKS ({SkinManager.getDeltaPackCount()})
            </button>

            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0e1b29] border border-amber-500/50 rounded-xl text-amber-400 font-mono font-bold text-sm shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Coins className="w-4 h-4 text-amber-300" />
              <span>{renown.toLocaleString()} RENOWN</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        {purchaseNotice && (
          <div className="my-2 p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/60 text-xs font-mono text-cyan-300 flex items-center justify-between animate-in slide-in-from-top-2 duration-150">
            <span>{purchaseNotice}</span>
            <button onClick={() => setPurchaseNotice(null)} className="text-gray-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-hidden my-3">
          {/* Left: Skin Cards Grid */}
          <div className="lg:col-span-7 overflow-y-auto pr-2 flex flex-col gap-3 custom-scrollbar">
            {/* Delta & Black Ice Pack Purchase Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-gradient-to-r from-[#0e2133] to-[#0a1724] border border-cyan-500/40 flex flex-col justify-between gap-2 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                    <Package className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-mono text-xs font-black text-cyan-200">TACTICAL DELTA PACK</h4>
                    <p className="text-[10px] text-gray-400">Weapon finishes + Black Ice chance</p>
                  </div>
                </div>
                <button
                  onClick={handleBuyDeltaPack}
                  className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-black font-mono font-black text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                >
                  BUY PACK (5,000 R)
                </button>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-r from-[#0a2336] to-[#0e3a5a] border border-[#00f0ff]/50 flex flex-col justify-between gap-2 shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 shadow-[0_0_10px_#00f0ff]">
                    <Sparkles className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-mono text-xs font-black text-[#00f0ff]">BLACK ICE PACK</h4>
                      <span className="text-[9px] px-1 bg-cyan-900 text-cyan-200 rounded font-mono font-bold">35% ICE</span>
                    </div>
                    <p className="text-[10px] text-cyan-200/80">Exclusive high-tier Black Ice drop</p>
                  </div>
                </div>
                <button
                  onClick={handleBuyBlackIcePack}
                  className="w-full py-2 bg-gradient-to-r from-[#00f0ff] to-[#0284c7] hover:brightness-110 text-black font-mono font-black text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                >
                  BUY PACK (15,000 R)
                </button>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2 border-b border-[#1b2b3d] pb-2">
              {[
                { id: 'weapons', label: '🔫 WEAPON FINISHES' },
                { id: 'operators', label: '🪖 OPERATOR UNIFORMS' },
                { id: 'items', label: '🛡️ ITEM & SHIELD GEAR' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                      : 'bg-[#0f1c2a] text-gray-300 hover:bg-[#15273b]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Skins List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeTab === 'weapons' && WEAPON_SKINS.map((skin) => {
                const unlocked = unlockedSkins.includes(skin.id);
                const equipped = equippedSkinId === skin.id;
                const isSelected = selectedSkin.id === skin.id;
                const badge = getRarityBadge(skin.rarity);

                return (
                  <div
                    key={skin.id}
                    onClick={() => setSelectedSkin(skin)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group ${
                      isSelected
                        ? 'bg-[#122234] border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                        : 'bg-[#0a1420]/80 border-[#1c3044] hover:border-[#2f5376] hover:bg-[#0d1a29]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${badge.badgeBg}`}>
                        {badge.label}
                      </span>
                      {equipped && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                          <Check className="w-3 h-3" /> EQUIPPED
                        </span>
                      )}
                      {!equipped && unlocked && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded">
                          OWNED
                        </span>
                      )}
                      {!unlocked && skin.isPackExclusive && (
                        <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-400/40 px-1.5 py-0.5 rounded">
                          🔒 PACK ONLY
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-mono text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {skin.name}
                      </h4>
                      <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                        {skin.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-[#18293b]">
                      <span className="text-gray-400 text-[10px]">Weapon Finish</span>
                      {unlocked ? (
                        <span className="text-emerald-400 font-bold">UNLOCKED</span>
                      ) : skin.isPackExclusive ? (
                        <span className="text-cyan-400 font-bold text-[11px]">
                          ❄️ PACK EXCLUSIVE
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {skin.priceRenown.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeTab === 'operators' && OPERATOR_SKINS.map((skin) => {
                const unlocked = unlockedOpSkins.includes(skin.id);
                const equipped = equippedOpSkinId === skin.id;
                const isSelected = selectedOpSkin.id === skin.id;
                const badge = getRarityBadge(skin.rarity);

                return (
                  <div
                    key={skin.id}
                    onClick={() => setSelectedOpSkin(skin)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group ${
                      isSelected
                        ? 'bg-[#122234] border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                        : 'bg-[#0a1420]/80 border-[#1c3044] hover:border-[#2f5376] hover:bg-[#0d1a29]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${badge.badgeBg}`}>
                        {badge.label}
                      </span>
                      {equipped && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                          <Check className="w-3 h-3" /> EQUIPPED
                        </span>
                      )}
                      {!equipped && unlocked && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded">
                          OWNED
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-mono text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {skin.name}
                      </h4>
                      <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                        {skin.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-[#18293b]">
                      <span className="text-gray-400 text-[10px]">Operator Uniform</span>
                      {unlocked ? (
                        <span className="text-emerald-400 font-bold">UNLOCKED</span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {skin.priceRenown.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeTab === 'items' && ITEM_SKINS.map((skin) => {
                const unlocked = unlockedItemSkins.includes(skin.id);
                const equipped = equippedItemSkinId === skin.id;
                const isSelected = selectedItemSkin.id === skin.id;
                const badge = getRarityBadge(skin.rarity);

                return (
                  <div
                    key={skin.id}
                    onClick={() => setSelectedItemSkin(skin)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group ${
                      isSelected
                        ? 'bg-[#122234] border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                        : 'bg-[#0a1420]/80 border-[#1c3044] hover:border-[#2f5376] hover:bg-[#0d1a29]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${badge.badgeBg}`}>
                        {badge.label}
                      </span>
                      {equipped && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                          <Check className="w-3 h-3" /> EQUIPPED
                        </span>
                      )}
                      {!equipped && unlocked && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded">
                          OWNED
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-mono text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {skin.name}
                      </h4>
                      <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                        {skin.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-[#18293b]">
                      <span className="text-gray-400 text-[10px]">Shield & Gear Finish</span>
                      {unlocked ? (
                        <span className="text-emerald-400 font-bold">UNLOCKED</span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {skin.priceRenown.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: 3D Real-time Weapon Inspector & Actions */}
          <div className="lg:col-span-5 bg-[#0a121c] border border-[#1e3448] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-xl">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2">
                <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Eye className="w-4 h-4" /> 3D WEAPON INSPECTOR
                </span>
                <span>Rotate 360°</span>
              </div>

              {/* Weapon Model Switcher Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 text-[10px] font-mono">
                {[
                  { id: 'l85a2', label: 'L85A2' },
                  { id: 'm4', label: 'M4 / 416' },
                  { id: 'ak12', label: 'AK-12' },
                  { id: 'mp5', label: 'MP5' },
                  { id: 'dmr417', label: 'DMR 417' },
                  { id: 'm590a1', label: 'M590A1' }
                ].map((wpn) => (
                  <button
                    key={wpn.id}
                    onClick={() => setPreviewWeapon(wpn.id)}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-all whitespace-nowrap ${
                      previewWeapon === wpn.id
                        ? 'bg-cyan-500 text-black font-bold shadow-md'
                        : 'bg-[#122334] text-gray-300 hover:bg-[#1a334d]'
                    }`}
                  >
                    {wpn.label}
                  </button>
                ))}
              </div>

              {/* Three.js Canvas Container */}
              <div
                ref={previewCanvasRef}
                className="w-full h-56 rounded-xl border border-[#1d354c] overflow-hidden bg-black/40 relative shadow-inner cursor-grab active:cursor-grabbing"
              />
            </div>

            {/* Selected Skin Details */}
            <div className="flex flex-col gap-2 bg-[#0e1a26] border border-[#1e364e] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-base font-black text-white">
                  {currentName}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${getRarityBadge(currentRarity).badgeBg}`}>
                  {getRarityBadge(currentRarity).label}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {currentDesc}
              </p>
              <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-2 border-t border-[#1a2f44]">
                <span>Availability:</span>
                <span className="text-amber-400 font-bold text-sm">
                  {activeTab === 'weapons' && selectedSkin.isPackExclusive
                    ? '❄️ PACK EXCLUSIVE'
                    : currentPrice === 0
                    ? 'FREE'
                    : `${currentPrice.toLocaleString()} Renown`}
                </span>
              </div>
            </div>

            {/* Bottom Button Actions */}
            <div className="flex items-center gap-2">
              {isCurrentUnlocked ? (
                <button
                  onClick={handleEquipCurrentSkin}
                  disabled={isCurrentEquipped}
                  className={`w-full py-3 rounded-xl font-mono font-black text-xs tracking-wider transition-all cursor-pointer ${
                    isCurrentEquipped
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 cursor-default'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95'
                  }`}
                >
                  {isCurrentEquipped ? '✓ CURRENTLY EQUIPPED' : 'EQUIP TO LOADOUT'}
                </button>
              ) : activeTab === 'weapons' && selectedSkin.isPackExclusive ? (
                <button
                  onClick={onOpenDeltaPacks}
                  className="w-full py-3 rounded-xl font-mono font-black text-xs tracking-wider transition-all bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:brightness-110 text-black shadow-[0_0_25px_rgba(6,182,212,0.45)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>❄️</span>
                  <span>OBTAIN VIA DELTA & BLACK ICE PACKS</span>
                </button>
              ) : (
                <button
                  onClick={handleBuyCurrentSkin}
                  disabled={!canAffordCurrent}
                  className="w-full py-3 rounded-xl font-mono font-black text-xs tracking-wider transition-all bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.35)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {canAffordCurrent ? `PURCHASE FOR ${currentPrice.toLocaleString()} RENOWN` : 'INSUFFICIENT RENOWN'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1b2b3d] pt-3 text-[11px] font-mono text-gray-400">
          <span>Earn 400-500 Renown per Ranked match victory (+bonus for MVP and Kills).</span>
          <span className="text-cyan-400">Equipped skins render in first-person and third-person matches!</span>
        </div>
      </div>
    </div>
  );
};
