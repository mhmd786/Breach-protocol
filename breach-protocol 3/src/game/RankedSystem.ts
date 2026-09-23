export type RankTier = 
  | 'Copper'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Emerald'
  | 'Diamond'
  | 'Champion';

export interface RankInfo {
  tier: RankTier;
  division: number; // 5 down to 1 (except Champion which is 1)
  name: string;
  rp: number; // Current RP (0 to 100 within division, or absolute)
  totalRP: number;
  color: string;
  gradient: string;
  icon: string;
  minRP: number;
  maxRP: number;
}

export interface PlayerRankedProfile {
  totalRP: number;
  rankMatchesPlayed: number;
  rankWins: number;
  rankLosses: number;
  winStreak: number;
  highestRP: number;
  seasonName: string;
  renown: number;
}

const STORAGE_KEY_RANKED = 'breach_protocol_ranked_profile_v1';
const STORAGE_KEY_RENOWN = 'breach_protocol_renown_v1';

const TIER_THRESHOLDS = [
  { tier: 'Copper' as RankTier, minRP: 0, maxRP: 1199, color: '#b87333', gradient: 'from-[#b87333] to-[#804a1b]' },
  { tier: 'Bronze' as RankTier, minRP: 1200, maxRP: 1599, color: '#cd7f32', gradient: 'from-[#cd7f32] to-[#8c531e]' },
  { tier: 'Silver' as RankTier, minRP: 1600, maxRP: 1999, color: '#c0c0c0', gradient: 'from-[#e0e8f0] to-[#8a9ba8]' },
  { tier: 'Gold' as RankTier, minRP: 2000, maxRP: 2499, color: '#ffd700', gradient: 'from-[#ffe066] to-[#cca010]' },
  { tier: 'Platinum' as RankTier, minRP: 2500, maxRP: 2999, color: '#00e5ff', gradient: 'from-[#67e8f9] to-[#0891b2]' },
  { tier: 'Emerald' as RankTier, minRP: 3000, maxRP: 3499, color: '#10b981', gradient: 'from-[#34d399] to-[#047857]' },
  { tier: 'Diamond' as RankTier, minRP: 3500, maxRP: 3999, color: '#a855f7', gradient: 'from-[#c084fc] to-[#7e22ce]' },
  { tier: 'Champion' as RankTier, minRP: 4000, maxRP: 10000, color: '#ff2d55', gradient: 'from-[#ff4d6d] to-[#b91c1c]' },
];

export class RankedSystem {
  private static cachedProfile: PlayerRankedProfile | null = null;

  public static getProfile(): PlayerRankedProfile {
    if (this.cachedProfile) return this.cachedProfile;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_RANKED);
      if (stored) {
        this.cachedProfile = JSON.parse(stored);
        return this.cachedProfile!;
      }
    } catch {}

    let initialRenown = 2500;
    try {
      const r = localStorage.getItem(STORAGE_KEY_RENOWN);
      if (r) initialRenown = parseInt(r, 10);
    } catch {}

    const defaultProfile: PlayerRankedProfile = {
      totalRP: 2150, // Starts at Gold IV
      rankMatchesPlayed: 8,
      rankWins: 5,
      rankLosses: 3,
      winStreak: 1,
      highestRP: 2280,
      seasonName: 'Operation Solar Flare',
      renown: initialRenown,
    };

    this.cachedProfile = defaultProfile;
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  public static saveProfile(profile: PlayerRankedProfile): void {
    this.cachedProfile = profile;
    try {
      localStorage.setItem(STORAGE_KEY_RANKED, JSON.stringify(profile));
      localStorage.setItem(STORAGE_KEY_RENOWN, profile.renown.toString());
    } catch (err) {
      console.warn('Failed to save ranked profile to localStorage:', err);
    }
  }

  public static getRankInfo(totalRP: number): RankInfo {
    const clampedRP = Math.max(0, totalRP);
    let matchedTier = TIER_THRESHOLDS[0];

    for (const t of TIER_THRESHOLDS) {
      if (clampedRP >= t.minRP) {
        matchedTier = t;
      }
    }

    if (matchedTier.tier === 'Champion') {
      return {
        tier: 'Champion',
        division: 1,
        name: 'CHAMPION',
        rp: clampedRP - 4000,
        totalRP: clampedRP,
        color: matchedTier.color,
        gradient: matchedTier.gradient,
        icon: '🏆',
        minRP: matchedTier.minRP,
        maxRP: matchedTier.maxRP
      };
    }

    const tierRange = matchedTier.maxRP - matchedTier.minRP + 1;
    const divRange = tierRange / 5;
    const offsetInTier = clampedRP - matchedTier.minRP;
    // Division 5 is lowest (0..divRange), Division 1 is highest (4*divRange..5*divRange)
    const divIdx = Math.min(4, Math.floor(offsetInTier / divRange));
    const divisionNum = 5 - divIdx;
    const divProgress = Math.floor(((offsetInTier % divRange) / divRange) * 100);

    const divRoman = ['I', 'II', 'III', 'IV', 'V'][divisionNum - 1];

    return {
      tier: matchedTier.tier,
      division: divisionNum,
      name: `${matchedTier.tier.toUpperCase()} ${divRoman}`,
      rp: divProgress,
      totalRP: clampedRP,
      color: matchedTier.color,
      gradient: matchedTier.gradient,
      icon: this.getTierIcon(matchedTier.tier),
      minRP: matchedTier.minRP,
      maxRP: matchedTier.maxRP
    };
  }

  private static getTierIcon(tier: RankTier): string {
    switch (tier) {
      case 'Copper': return '🛡️';
      case 'Bronze': return '🥉';
      case 'Silver': return '🥈';
      case 'Gold': return '🥇';
      case 'Platinum': return '💠';
      case 'Emerald': return '💎';
      case 'Diamond': return '✨';
      case 'Champion': return '👑';
    }
  }

  /**
   * Process match end results:
   * Ranked grants much higher renown (+400-500 win / +180 loss) and updates RP.
   * Quick Match grants less renown (+160 win / +70 loss) without affecting RP.
   */
  public static processMatchResults(params: {
    isRanked: boolean;
    isWin: boolean;
    kills: number;
    score: number;
    isMVP: boolean;
  }): {
    rpDelta: number;
    renownDelta: number;
    oldProfile: PlayerRankedProfile;
    newProfile: PlayerRankedProfile;
    oldRank: RankInfo;
    newRank: RankInfo;
    breakdown: { label: string; amount: number }[];
  } {
    const profile = this.getProfile();
    const oldProfile = { ...profile };
    const oldRank = this.getRankInfo(oldProfile.totalRP);

    let rpDelta = 0;
    const breakdown: { label: string; amount: number }[] = [];

    // Renown reward calculation
    let baseRenown = 0;
    if (params.isRanked) {
      baseRenown = params.isWin ? 420 : 180;
      breakdown.push({ label: params.isWin ? 'Ranked Victory' : 'Ranked Match Finished', amount: baseRenown });

      // RP calculation for Ranked
      if (params.isWin) {
        const streakBonus = Math.min(25, profile.winStreak * 5);
        const killBonus = Math.min(15, params.kills * 3);
        const mvpBonus = params.isMVP ? 10 : 0;
        rpDelta = 40 + streakBonus + killBonus + mvpBonus;

        profile.rankWins++;
        profile.winStreak++;
      } else {
        rpDelta = -(26 + Math.floor(Math.random() * 6));
        profile.rankLosses++;
        profile.winStreak = 0;
      }
      profile.rankMatchesPlayed++;
    } else {
      // Quick Match grants significantly less renown
      baseRenown = params.isWin ? 160 : 70;
      breakdown.push({ label: params.isWin ? 'Quick Match Win' : 'Quick Match Completed', amount: baseRenown });
    }

    // Kill & Objective Renown Bonuses
    const killRenown = params.kills * 15;
    if (killRenown > 0) {
      breakdown.push({ label: `Kills (${params.kills}x)`, amount: killRenown });
    }

    let mvpRenown = 0;
    if (params.isMVP) {
      mvpRenown = params.isRanked ? 60 : 25;
      breakdown.push({ label: 'MVP Performance Bonus', amount: mvpRenown });
    }

    const totalRenownGain = baseRenown + killRenown + mvpRenown;
    profile.renown += totalRenownGain;
    profile.totalRP = Math.max(0, profile.totalRP + rpDelta);
    if (profile.totalRP > profile.highestRP) {
      profile.highestRP = profile.totalRP;
    }

    this.saveProfile(profile);

    const newRank = this.getRankInfo(profile.totalRP);

    return {
      rpDelta,
      renownDelta: totalRenownGain,
      oldProfile,
      newProfile: profile,
      oldRank,
      newRank,
      breakdown
    };
  }

  public static addRenown(amount: number): number {
    const profile = this.getProfile();
    profile.renown += amount;
    this.saveProfile(profile);
    return profile.renown;
  }

  public static setInfiniteRenown(): number {
    const profile = this.getProfile();
    profile.renown = 999999999;
    this.saveProfile(profile);
    return profile.renown;
  }
}
