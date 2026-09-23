export type SkinRarity = 'uncommon' | 'rare' | 'epic' | 'legendary' | 'black_ice';

export interface OperatorSkin {
  id: string;
  name: string;
  rarity: SkinRarity;
  priceRenown: number;
  description: string;
  colors: {
    uniformPrimary: number;
    uniformSecondary: number;
    vestColor: number;
    helmetColor: number;
    visorColor: number;
    accentColor: number;
  };
}

export interface ItemSkin {
  id: string;
  name: string;
  rarity: SkinRarity;
  priceRenown: number;
  description: string;
  colors: {
    primary: number;
    secondary: number;
    accent: number;
    metalness: number;
    roughness: number;
    emissive?: number;
    isIcy?: boolean;
  };
}

export const OPERATOR_SKINS: OperatorSkin[] = [
  {
    id: 'op_default',
    name: 'Standard Tactical Fatigues',
    rarity: 'uncommon',
    priceRenown: 0,
    description: 'Standard-issue military tactical uniform and ballistic helmet.',
    colors: {
      uniformPrimary: 0x1f2937,
      uniformSecondary: 0x111827,
      vestColor: 0x374151,
      helmetColor: 0x111827,
      visorColor: 0x1e3a8a,
      accentColor: 0x38bdf8
    }
  },
  {
    id: 'op_pro_league',
    name: 'Pro League Gold & Obsidian',
    rarity: 'legendary',
    priceRenown: 25000,
    description: 'Elite competitive championship uniform featuring obsidian black weave and 24K gold tactical plating.',
    colors: {
      uniformPrimary: 0x0f1115,
      uniformSecondary: 0x181a20,
      vestColor: 0x111318,
      helmetColor: 0x0a0c10,
      visorColor: 0xd4af37,
      accentColor: 0xffd700
    }
  },
  {
    id: 'op_alpine',
    name: 'Sub-Zero Alpine Operator',
    rarity: 'epic',
    priceRenown: 14000,
    description: 'Cold-weather arctic snow camouflage parka and thermal reconnaissance gear.',
    colors: {
      uniformPrimary: 0xe5e7eb,
      uniformSecondary: 0x9ca3af,
      vestColor: 0xd1d5db,
      helmetColor: 0xf3f4f6,
      visorColor: 0x0284c7,
      accentColor: 0x0ea5e9
    }
  },
  {
    id: 'op_cyber_neon',
    name: 'Cyber Neon Spec-Ops',
    rarity: 'legendary',
    priceRenown: 22000,
    description: 'Futuristic stealth uniform interlaced with active glowing cyan and magenta high-voltage fiber optics.',
    colors: {
      uniformPrimary: 0x090d16,
      uniformSecondary: 0x111c2e,
      vestColor: 0x0e1726,
      helmetColor: 0x06090f,
      visorColor: 0x00f0ff,
      accentColor: 0xff007f
    }
  },
  {
    id: 'op_shadow',
    name: 'Shadow Infiltrator Blackout',
    rarity: 'rare',
    priceRenown: 8500,
    description: 'Non-reflective matte black stealth fatigues designed for zero-illumination night raids.',
    colors: {
      uniformPrimary: 0x0b0f17,
      uniformSecondary: 0x07090e,
      vestColor: 0x111622,
      helmetColor: 0x05070a,
      visorColor: 0x1c1917,
      accentColor: 0xa855f7
    }
  },
  {
    id: 'op_desert',
    name: 'Arid Recon Operative',
    rarity: 'rare',
    priceRenown: 7500,
    description: 'Arid tan multicam tactical fatigues and lightweight reconnaissance plate carrier.',
    colors: {
      uniformPrimary: 0xc2b280,
      uniformSecondary: 0x8b7355,
      vestColor: 0xa39171,
      helmetColor: 0x6e5c43,
      visorColor: 0xd97706,
      accentColor: 0xf59e0b
    }
  },
  {
    id: 'op_jungle',
    name: 'Jungle Tigerstripe Specialist',
    rarity: 'epic',
    priceRenown: 12500,
    description: 'Dense olive drab and black tigerstripe camouflage for dense tropical foliage warfare.',
    colors: {
      uniformPrimary: 0x365314,
      uniformSecondary: 0x1a2e05,
      vestColor: 0x3f6212,
      helmetColor: 0x1e3a1e,
      visorColor: 0x10b981,
      accentColor: 0x34d399
    }
  },
  {
    id: 'op_phantom',
    name: 'Ghost Phantom Spec-Ops',
    rarity: 'legendary',
    priceRenown: 24000,
    description: 'Stealth specter uniform featuring dark grey carbon weave and holographic threat shrouds.',
    colors: {
      uniformPrimary: 0x18181b,
      uniformSecondary: 0x27272a,
      vestColor: 0x09090b,
      helmetColor: 0x121215,
      visorColor: 0x06b6d4,
      accentColor: 0x38bdf8
    }
  },
  {
    id: 'op_blizzard',
    name: 'Arctic Blizzard Commander',
    rarity: 'epic',
    priceRenown: 16000,
    description: 'Extreme-cold arctic expedition gear with white thermal plating and polarized glacier goggles.',
    colors: {
      uniformPrimary: 0xf8fafc,
      uniformSecondary: 0x94a3b8,
      vestColor: 0xe2e8f0,
      helmetColor: 0xcbf8ff,
      visorColor: 0x0284c7,
      accentColor: 0x38bdf8
    }
  },
  {
    id: 'op_magma',
    name: 'Volcanic Magma Vanguard',
    rarity: 'legendary',
    priceRenown: 28000,
    description: 'Molten tactical armor forged in volcanic calderas with glowing thermal orange veins.',
    colors: {
      uniformPrimary: 0x18181b,
      uniformSecondary: 0x27272a,
      vestColor: 0x09090b,
      helmetColor: 0x111113,
      visorColor: 0xff4500,
      accentColor: 0xff6600
    }
  },
  {
    id: 'op_cyber_ninja',
    name: 'Cyber Shinobi Infiltrator',
    rarity: 'legendary',
    priceRenown: 27000,
    description: 'High-tech stealth bodysuit equipped with fiber-optic cyan glowing blades and night-vision visor.',
    colors: {
      uniformPrimary: 0x090d16,
      uniformSecondary: 0x0f172a,
      vestColor: 0x030712,
      helmetColor: 0x020617,
      visorColor: 0x00f0ff,
      accentColor: 0x38bdf8
    }
  },
  {
    id: 'op_urban',
    name: 'Urban CTU Counter-Terrorist',
    rarity: 'rare',
    priceRenown: 8000,
    description: 'Standard urban assault heavy blue-grey fatigues and ballistic steel face shield.',
    colors: {
      uniformPrimary: 0x1e293b,
      uniformSecondary: 0x0f172a,
      vestColor: 0x334155,
      helmetColor: 0x1e293b,
      visorColor: 0x3b82f6,
      accentColor: 0x60a5fa
    }
  }
];

export const ITEM_SKINS: ItemSkin[] = [
  {
    id: 'item_default',
    name: 'Standard Military Gear',
    rarity: 'uncommon',
    priceRenown: 0,
    description: 'Standard ballistic steel and reinforced polymer finish for shields, hammers, and gadgets.',
    colors: {
      primary: 0x27272a,
      secondary: 0x18181b,
      accent: 0x52525b,
      metalness: 0.85,
      roughness: 0.3
    }
  },
  {
    id: 'item_black_ice',
    name: 'Black Ice Glacier Gear',
    rarity: 'black_ice',
    priceRenown: 0,
    description: 'Legendary frost-cracked glacier finish for shields and breach equipment.',
    colors: {
      primary: 0x153d5a,
      secondary: 0xdff9ff,
      accent: 0x7ae5ff,
      metalness: 0.85,
      roughness: 0.04,
      isIcy: true
    }
  },
  {
    id: 'item_gold',
    name: 'Royal Damascus Gold Gear',
    rarity: 'legendary',
    priceRenown: 20000,
    description: '24K gold-plated ballistic shields and hammer with Damascus laser engravings.',
    colors: {
      primary: 0xd4af37,
      secondary: 0x1a1a1a,
      accent: 0xffd700,
      metalness: 0.98,
      roughness: 0.12
    }
  },
  {
    id: 'item_neon',
    name: 'Cyber Neon Tactical Gear',
    rarity: 'epic',
    priceRenown: 13000,
    description: 'Matte carbon shields with glowing neon conduit striping.',
    colors: {
      primary: 0x0f141c,
      secondary: 0x00f0ff,
      accent: 0xff007f,
      emissive: 0x00d4ff,
      metalness: 0.5,
      roughness: 0.2
    }
  },
  {
    id: 'item_magma',
    name: 'Molten Magma Gear',
    rarity: 'legendary',
    priceRenown: 21000,
    description: 'Volcanic plate armor pulsing with intense subterranean thermal lava heat.',
    colors: {
      primary: 0x18181b,
      secondary: 0xe65c00,
      accent: 0xff3b00,
      emissive: 0xff4500,
      metalness: 0.8,
      roughness: 0.2
    }
  },
  {
    id: 'item_chrome',
    name: 'Mirror Chrome Gear',
    rarity: 'legendary',
    priceRenown: 25000,
    description: 'Immaculate 99% reflective liquid mirror chrome ballistic shields.',
    colors: {
      primary: 0xf8fafc,
      secondary: 0x94a3b8,
      accent: 0xffffff,
      metalness: 0.99,
      roughness: 0.02
    }
  }
];

export interface WeaponSkin {
  id: string;
  name: string;
  weaponCategory: 'all' | 'ar' | 'smg' | 'sniper' | 'shotgun' | 'pistol';
  rarity: SkinRarity;
  priceRenown: number;
  description: string;
  isPackExclusive?: boolean;
  colors: {
    primary: number;
    secondary: number;
    accent: number;
    metalness: number;
    roughness: number;
    emissive?: number;
    isIcy?: boolean;
    pattern?: 'damascus' | 'neon' | 'ice' | 'carbon' | 'gold' | 'camo' | 'standard';
  };
}

export interface DeltaPackItem {
  id: string;
  name: string;
  type: 'weapon_skin' | 'operator_skin' | 'charm';
  rarity: SkinRarity;
  skinId: string;
  previewColor: string;
}

export const WEAPON_SKINS: WeaponSkin[] = [
  {
    id: 'default',
    name: 'Factory Standard',
    weaponCategory: 'all',
    rarity: 'uncommon',
    priceRenown: 0,
    description: 'Tactical matte military polymer and cold-rolled gunsteel finish.',
    colors: {
      primary: 0x22272c,
      secondary: 0x181b1e,
      accent: 0x5a636e,
      metalness: 0.85,
      roughness: 0.28,
      pattern: 'standard'
    }
  },
  {
    id: 'black_ice',
    name: 'Black Ice',
    weaponCategory: 'all',
    rarity: 'black_ice',
    priceRenown: 0,
    isPackExclusive: true,
    description: 'The legendary frost-cracked deep glacier finish. Exclusively available from Delta Packs & Black Ice Tactical Packs.',
    colors: {
      primary: 0x153d5a,
      secondary: 0xdff9ff,
      accent: 0x7ae5ff,
      metalness: 0.88,
      roughness: 0.04,
      isIcy: true,
      pattern: 'ice'
    }
  },
  {
    id: 'green_black_ice',
    name: 'Green Black Ice',
    weaponCategory: 'all',
    rarity: 'black_ice',
    priceRenown: 0,
    isPackExclusive: true,
    description: 'Rare emerald-tinted crystalline Black Ice variant with frosty white diamond shard facets.',
    colors: {
      primary: 0x065f46,
      secondary: 0xa7f3d0,
      accent: 0x10b981,
      metalness: 0.88,
      roughness: 0.04,
      isIcy: true,
      pattern: 'ice'
    }
  },
  {
    id: 'purple_black_ice',
    name: 'Purple Black Ice',
    weaponCategory: 'all',
    rarity: 'black_ice',
    priceRenown: 0,
    isPackExclusive: true,
    description: 'Ultraviolet amethyst crystalline Black Ice variant with luminous frost diamond facets.',
    colors: {
      primary: 0x581c87,
      secondary: 0xe9d5ff,
      accent: 0x9333ea,
      metalness: 0.88,
      roughness: 0.04,
      isIcy: true,
      pattern: 'ice'
    }
  },
  {
    id: 'red_black_ice',
    name: 'Red Black Ice',
    weaponCategory: 'all',
    rarity: 'black_ice',
    priceRenown: 0,
    isPackExclusive: true,
    description: 'Crimson ruby crystalline Black Ice variant with frosted crystal diamond facets.',
    colors: {
      primary: 0x7f1d1d,
      secondary: 0xfecaec,
      accent: 0xdc2626,
      metalness: 0.88,
      roughness: 0.04,
      isIcy: true,
      pattern: 'ice'
    }
  },
  {
    id: 'damascus_gold',
    name: 'Royal Damascus Gold',
    weaponCategory: 'all',
    rarity: 'legendary',
    priceRenown: 18000,
    description: '24K pure gold leaf plated receiver featuring intricate laser-etched Damascus steel swirls.',
    colors: {
      primary: 0xd4af37,
      secondary: 0x1a1a1a,
      accent: 0xffd700,
      metalness: 0.98,
      roughness: 0.12,
      pattern: 'damascus'
    }
  },
  {
    id: 'cyber_neon',
    name: 'Cyberpunk Neon',
    weaponCategory: 'all',
    rarity: 'epic',
    priceRenown: 12000,
    description: 'High-contrast matte carbon fiber interlaced with active glowing cyan & magenta conduit lines.',
    colors: {
      primary: 0x0f141c,
      secondary: 0x00f0ff,
      accent: 0xff007f,
      emissive: 0x00d4ff,
      metalness: 0.5,
      roughness: 0.2,
      pattern: 'neon'
    }
  },
  {
    id: 'carbon_fiber',
    name: 'Stealth Carbon Kevlar',
    weaponCategory: 'all',
    rarity: 'rare',
    priceRenown: 6500,
    description: 'Lightweight military-grade woven carbon fiber weave with high-grip stippling.',
    colors: {
      primary: 0x1e2124,
      secondary: 0x2e3238,
      accent: 0x4a4f56,
      metalness: 0.35,
      roughness: 0.45,
      pattern: 'carbon'
    }
  },
  {
    id: 'specops_crimson',
    name: 'Bloodhound Spec-Ops',
    weaponCategory: 'all',
    rarity: 'epic',
    priceRenown: 10500,
    description: 'Dark crimson red tactical anodized aluminum paired with midnight black polymer.',
    colors: {
      primary: 0x8a0e1c,
      secondary: 0x151619,
      accent: 0xd11a2a,
      metalness: 0.75,
      roughness: 0.25,
      pattern: 'standard'
    }
  },
  {
    id: 'arctic_whiteout',
    name: 'Sub-Zero Alpine',
    weaponCategory: 'all',
    rarity: 'rare',
    priceRenown: 7000,
    description: 'Crisp arctic snow camouflage designed for alpine mountain warfare.',
    colors: {
      primary: 0xeeeeee,
      secondary: 0x9fb2c4,
      accent: 0x4a5d6e,
      metalness: 0.3,
      roughness: 0.5,
      pattern: 'camo'
    }
  },
  {
    id: 'toxic_hazard',
    name: 'Bio-Hazard Warning',
    weaponCategory: 'all',
    rarity: 'legendary',
    priceRenown: 16000,
    description: 'Radioactive hazard yellow with high-voltage warning chevrons and radiation iconography.',
    colors: {
      primary: 0xf5b800,
      secondary: 0x181818,
      accent: 0xffe600,
      emissive: 0x332800,
      metalness: 0.6,
      roughness: 0.3,
      pattern: 'standard'
    }
  },
  {
    id: 'magma_forge',
    name: 'Molten Forge Magma',
    weaponCategory: 'all',
    rarity: 'legendary',
    priceRenown: 22000,
    description: 'Forged in volcanic fire with glowing molten lava veins pulsing across obsidian black alloy.',
    colors: {
      primary: 0x111113,
      secondary: 0xe65c00,
      accent: 0xff3b00,
      emissive: 0xff4500,
      metalness: 0.8,
      roughness: 0.22,
      pattern: 'neon'
    }
  },
  {
    id: 'emerald_viper',
    name: 'Emerald Viper',
    weaponCategory: 'all',
    rarity: 'epic',
    priceRenown: 13500,
    description: 'Venomous metallic emerald green serpent scales with dark carbon fiber contrasts.',
    colors: {
      primary: 0x064e3b,
      secondary: 0x022c22,
      accent: 0x34d399,
      metalness: 0.85,
      roughness: 0.18,
      pattern: 'carbon'
    }
  },
  {
    id: 'plasma_vapor',
    name: 'Vaporwave Synth',
    weaponCategory: 'all',
    rarity: 'epic',
    priceRenown: 14000,
    description: 'Ultraviolet purple and neon magenta retro-futuristic synthwave aesthetic.',
    colors: {
      primary: 0x3b0764,
      secondary: 0x7e22ce,
      accent: 0xf43f5e,
      emissive: 0xec4899,
      metalness: 0.6,
      roughness: 0.25,
      pattern: 'neon'
    }
  },
  {
    id: 'obsidian_chrome',
    name: 'Liquid Mercury Chrome',
    weaponCategory: 'all',
    rarity: 'legendary',
    priceRenown: 26000,
    description: 'Ultra-reflective 99% mirror chrome plating that mirrors the surrounding environment.',
    colors: {
      primary: 0xe2e8f0,
      secondary: 0x94a3b8,
      accent: 0xffffff,
      metalness: 0.99,
      roughness: 0.03,
      pattern: 'standard'
    }
  },
  {
    id: 'desert_rat',
    name: 'Arid Scavenger',
    weaponCategory: 'all',
    rarity: 'rare',
    priceRenown: 6000,
    description: 'Multi-tone desert tan and khaki camouflage designed for arid wasteland operations.',
    colors: {
      primary: 0xd4b28c,
      secondary: 0x8c6d4f,
      accent: 0x594532,
      metalness: 0.3,
      roughness: 0.5,
      pattern: 'camo'
    }
  }
];

const STORAGE_KEY_SKINS = 'breach_protocol_unlocked_skins_v1';
const STORAGE_KEY_EQUIPPED_SKIN = 'breach_protocol_equipped_skin_v1';
const STORAGE_KEY_DELTA_PACKS = 'breach_protocol_delta_packs_v1';
const STORAGE_KEY_BLACKICE_PACKS = 'breach_protocol_blackice_packs_v1';

export class SkinManager {
  public static getUnlockedSkins(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SKINS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.includes('default')) return parsed;
      }
    } catch {}
    const initial = ['default', 'carbon_fiber'];
    this.saveUnlockedSkins(initial);
    return initial;
  }

  public static saveUnlockedSkins(skins: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_SKINS, JSON.stringify(skins));
    } catch (err) {
      console.warn('Failed to save unlocked skins:', err);
    }
  }

  public static unlockAllSkins(): void {
    const all = WEAPON_SKINS.map(s => s.id);
    this.saveUnlockedSkins(all);
    try {
      localStorage.setItem('breach_protocol_unlocked_op_skins_v1', JSON.stringify(OPERATOR_SKINS.map(s => s.id)));
      localStorage.setItem('breach_protocol_unlocked_item_skins_v1', JSON.stringify(ITEM_SKINS.map(s => s.id)));
    } catch {}
  }

  public static getEquippedOperatorSkinId(): string {
    try {
      const stored = localStorage.getItem('breach_protocol_equipped_op_skin_v1');
      if (stored && OPERATOR_SKINS.some(s => s.id === stored)) return stored;
    } catch {}
    return 'op_default';
  }

  public static setEquippedOperatorSkinId(skinId: string): void {
    try {
      localStorage.setItem('breach_protocol_equipped_op_skin_v1', skinId);
    } catch {}
  }

  public static getEquippedOperatorSkin(): OperatorSkin {
    const id = this.getEquippedOperatorSkinId();
    return OPERATOR_SKINS.find(s => s.id === id) || OPERATOR_SKINS[0];
  }

  public static getEquippedItemSkinId(): string {
    try {
      const stored = localStorage.getItem('breach_protocol_equipped_item_skin_v1');
      if (stored && ITEM_SKINS.some(s => s.id === stored)) return stored;
    } catch {}
    return 'item_default';
  }

  public static setEquippedItemSkinId(skinId: string): void {
    try {
      localStorage.setItem('breach_protocol_equipped_item_skin_v1', skinId);
    } catch {}
  }

  public static getEquippedItemSkin(): ItemSkin {
    const id = this.getEquippedItemSkinId();
    return ITEM_SKINS.find(s => s.id === id) || ITEM_SKINS[0];
  }

  public static getEquippedSkinId(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EQUIPPED_SKIN);
      if (stored && WEAPON_SKINS.some(s => s.id === stored)) return stored;
    } catch {}
    return 'default';
  }

  public static setEquippedSkinId(skinId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY_EQUIPPED_SKIN, skinId);
    } catch (err) {
      console.warn('Failed to save equipped skin:', err);
    }
  }

  public static getEquippedSkin(): WeaponSkin {
    const id = this.getEquippedSkinId();
    return WEAPON_SKINS.find(s => s.id === id) || WEAPON_SKINS[0];
  }

  public static getDeltaPackCount(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DELTA_PACKS);
      if (stored !== null) return Math.max(0, parseInt(stored, 10));
    } catch {}
    return 3; // Give 3 complimentary packs on fresh start!
  }

  public static setDeltaPackCount(count: number): void {
    try {
      localStorage.setItem(STORAGE_KEY_DELTA_PACKS, count.toString());
    } catch {}
  }

  public static addDeltaPacks(count: number): number {
    const cur = this.getDeltaPackCount();
    const updated = cur + count;
    this.setDeltaPackCount(updated);
    return updated;
  }

  public static getBlackIcePackCount(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BLACKICE_PACKS);
      if (stored !== null) return Math.max(0, parseInt(stored, 10));
    } catch {}
    return 1; // 1 complimentary Black Ice Pack!
  }

  public static setBlackIcePackCount(count: number): void {
    try {
      localStorage.setItem(STORAGE_KEY_BLACKICE_PACKS, count.toString());
    } catch {}
  }

  public static addBlackIcePacks(count: number): number {
    const cur = this.getBlackIcePackCount();
    const updated = cur + count;
    this.setBlackIcePackCount(updated);
    return updated;
  }

  /**
   * Roll a specialized Black Ice Tactical Pack (High chance / guaranteed cold/ultra rarity)
   */
  public static rollBlackIcePack(): { skin: WeaponSkin; isDuplicate: boolean; duplicateRenown: number } {
    const roll = Math.random() * 100;
    let chosenSkin: WeaponSkin;

    const blackIceVariants = WEAPON_SKINS.filter(s => s.rarity === 'black_ice');

    if (roll < 20.0) {
      // 20% chance for a random Black Ice variant (Blue, Green, Purple, or Red)
      chosenSkin = blackIceVariants[Math.floor(Math.random() * blackIceVariants.length)] || WEAPON_SKINS[1];
    } else {
      // High-tier pool (Legendary or Epic or Black Ice)
      const highTier = WEAPON_SKINS.filter(s => s.rarity === 'legendary' || s.rarity === 'epic' || s.rarity === 'black_ice');
      chosenSkin = highTier[Math.floor(Math.random() * highTier.length)] || WEAPON_SKINS[1];
    }

    const unlocked = this.getUnlockedSkins();
    const isDuplicate = unlocked.includes(chosenSkin.id);
    let duplicateRenown = 0;

    if (!isDuplicate) {
      unlocked.push(chosenSkin.id);
      this.saveUnlockedSkins(unlocked);
    } else {
      duplicateRenown = Math.max(800, Math.floor((chosenSkin.priceRenown || 20000) * 0.5));
    }

    return { skin: chosenSkin, isDuplicate, duplicateRenown };
  }

  /**
   * Roll a Delta Pack drop
   */
  public static rollDeltaPack(): { skin: WeaponSkin; isDuplicate: boolean; duplicateRenown: number } {
    const roll = Math.random() * 100;
    let chosenRarity: SkinRarity = 'uncommon';

    if (roll < 1.0) chosenRarity = 'black_ice'; // 1.0% Black Ice from standard Delta Pack (Ultra Rare Trophy!)
    else if (roll < 15.0) chosenRarity = 'legendary'; // 14% Legendary
    else if (roll < 40.0) chosenRarity = 'epic'; // 25% Epic
    else if (roll < 70.0) chosenRarity = 'rare'; // 30% Rare
    else chosenRarity = 'uncommon'; // 30% Uncommon

    const candidates = WEAPON_SKINS.filter(s => s.rarity === chosenRarity);
    let chosenSkin: WeaponSkin;
    if (chosenRarity === 'black_ice') {
      const blackIceVariants = WEAPON_SKINS.filter(s => s.rarity === 'black_ice');
      chosenSkin = blackIceVariants[Math.floor(Math.random() * blackIceVariants.length)] || WEAPON_SKINS[1];
    } else {
      chosenSkin = candidates[Math.floor(Math.random() * candidates.length)] || WEAPON_SKINS[1];
    }

    const unlocked = this.getUnlockedSkins();
    const isDuplicate = unlocked.includes(chosenSkin.id);
    let duplicateRenown = 0;

    if (!isDuplicate) {
      unlocked.push(chosenSkin.id);
      this.saveUnlockedSkins(unlocked);
    } else {
      duplicateRenown = Math.max(400, Math.floor((chosenSkin.priceRenown || 15000) * 0.45));
    }

    return { skin: chosenSkin, isDuplicate, duplicateRenown };
  }
}
