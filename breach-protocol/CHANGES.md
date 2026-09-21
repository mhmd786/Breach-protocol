# Gameplay architecture pass

- EMP now applies a temporary disabled state to electronic gadgets and legacy CCTV/Maestro cameras instead of deleting the gadget object. Devices recover automatically after eight seconds.
- ADS now consumes a limited charge to intercept a hostile live throwable before its fuse/effect runs; EMP disables ADS during its recovery window.
- Trax Stingers now create a visible eighteen-second active zone with half-second damage ticks and a transient movement slow. The zone cleans itself up on expiry.
- The navigation graph is rebuilt when a map loads, using that map's spawn and objective data. Roamers no longer select the old universal suburban-house coordinates.

## Verification limitation

This archive was supplied without `node_modules`, and this environment has no `node`, `npm`, or `npx` executable. `npm run build` and `tsc --noEmit` therefore could not be run here. No dependency installation was attempted.

## Remaining scope

The upstream project still needs the requested full operator-by-operator bot ability audit, authored distinct Harbor Villa/Chalet geometry, and a complete defuser/reset test pass. Those items are not represented as complete in this package.

# Exterior dressing + real spawn choice

- Added a procedural grass texture and shared `addGrassGrounds` / `addLeafyTree` / `addPineTree` / `addSimpleCar` / `addParkingLot` helpers in `NewMaps.ts`.
- Warehouse District, Office Tower, Harbor Villa, and Alpine Chalet now all have grass/snow grounds out past their spawns, tree cover along the property edges, and a parking lot with several parked cars (each car has a real collider, so it also works as cover).
- Fixed a real playability bug on Harbor Villa: the map's only ground meshes were a 32x24 patio slab and the sea plane, so the attacker spawns (z -16 to -20) sat over empty void with no floor at all. Added grass grounds plus a paved motor-court over the approach.
- The human player was hardcoded to `mapSpawnsAtk[0]` / `mapSpawnsDef[0]` even though every map already defines 4-5 spawn points (bots already used all of them). Added `preferredSpawnIndex` to the engine, a `spawnIndex` field on `MatchConfig`, and a labeled "Spawn Point" dropdown in the pre-match menu (`src/maps/spawnPoints.ts` holds the labels) so the player actually picks where they start. Bot spawn-cycling on the player's own side is offset past the player's chosen index so a bot doesn't land on top of them.

## Verification

`npx tsc --noEmit` and `npm run build` both pass clean in this environment (node v22, npm install succeeded).
