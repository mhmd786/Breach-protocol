// Human-readable labels for each map's spawn points, in the same order as the
// spawnsAtk/spawnsDef coordinate arrays returned by HouseMap.ts / NewMaps.ts.
// Kept as plain data (no THREE dependency) so the pre-match menu can list
// spawn choices without having to build the map's geometry.
export interface SpawnPointOption {
  label: string;
}

export const SPAWN_POINT_NAMES: Record<string, { atk: SpawnPointOption[]; def: SpawnPointOption[] }> = {
  suburban_house: {
    atk: [
      { label: 'Front Yard — Left' },
      { label: 'Front Yard — Right' },
      { label: 'West Curb' },
      { label: 'East Curb' }
    ],
    def: [
      { label: 'Living Room' },
      { label: 'Upstairs Landing' },
      { label: 'Master Bedroom' },
      { label: 'Garage Nook' },
      { label: 'Hallway Closet' }
    ]
  },
  warehouse: {
    atk: [
      { label: 'Loading Yard — West' },
      { label: 'Loading Yard — Center-West' },
      { label: 'Loading Yard — Center-East' },
      { label: 'Loading Yard — East' }
    ],
    def: [
      { label: 'Vault Cage' },
      { label: 'West Container Row' },
      { label: 'East Container Row' },
      { label: 'North Office Annex' },
      { label: 'Mezzanine Catwalk' }
    ]
  },
  office_tower: {
    atk: [
      { label: 'Plaza — Center-Left' },
      { label: 'Plaza — Center-Right' },
      { label: 'Plaza — Far Left' },
      { label: 'Plaza — Far Right' }
    ],
    def: [
      { label: 'Data Vault' },
      { label: 'Boardroom' },
      { label: 'Bullpen Pods' },
      { label: 'Exec Office' },
      { label: 'Breakroom' }
    ]
  }
};

export function getSpawnOptions(mapKey: string, side: 'atk' | 'def'): SpawnPointOption[] {
  const forMap = SPAWN_POINT_NAMES[mapKey] || SPAWN_POINT_NAMES.suburban_house;
  return forMap[side];
}
