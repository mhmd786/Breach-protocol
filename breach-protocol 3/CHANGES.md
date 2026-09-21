# Dead-code removal + exterior map pass + gadget viewmodel

- Deleted the entire unused legacy engine cluster that was never wired into the running game: `src/engine/` (GameEngine.ts, BotAI.ts, DestructionEngine.ts, PlayerController.ts, WeaponMeshFactory.ts), `components/HUD.tsx`, `components/OperatorSelect.tsx`, and `maps/mapData.ts` (the placeholder Copper Yard/Harbor Relay/Old Metro data, which reused identical geometry across all three and was never selectable in-game). Verified nothing in the live `App.tsx` → `BreachProtocolEngine.ts` path imported any of it before removing.
- Added exterior dressing to all three playable maps: Suburban Villa gets two curbside parked cars, side-yard hedge rows, and a rear-yard tool shed (previously had no cover between the fence line and the house); Warehouse District gets loading-yard dumpsters and a security checkpoint booth; Office Tower gets plaza benches and a bike rack.
- Added a hand-held gadget viewmodel (`ModelFactory.createGadgetViewRig`) that swaps in for the weapon viewmodel while holding [G] to place a Valkyrie/Maestro camera, then swaps back on release/throw. Wired through a new `updateGadgetViewmodel()` that respects existing drone/CCTV/death visibility rules so it doesn't fight with those.

## Verification limitation (this pass)

This container has no network access, so `npm install` could not complete and `npm run build` / `tsc --noEmit` could not be run against these changes. Edits were reviewed by hand for syntax, type, and import correctness but not compiled — please run a build before deploying.

# Gadget wheel + menu mouse-lock fix

- Added a Gadget Wheel: hold TAB to open it, hover an item (ability, breach charge, recon drone, CCTV feed, or Valkyrie/Maestro camera, depending on operator/side), release TAB to use/equip whatever's hovered. Escape or releasing with nothing hovered cancels. Scoreboard moved from TAB to O to free up the key.
- Fixed a bug where opening the in-game Operator/Loadout modal (N key or the on-screen button) left the mouse pointer-locked to the canvas, making its buttons unclickable. The mouse is now released whenever that modal (or the new gadget wheel) is open, and reclaimed automatically when it closes.

## Verification limitation (this pass)

This container has no network access, so `npm install` could not complete and `npm run build` / `tsc --noEmit` could not be run against these changes. The edits were reviewed by hand for syntax and type consistency but not compiled — please run a build before deploying.

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

# Map trim, office stairs fix, round-carryover fix, Tab-hold shield, Twitch drone

- Deleted Harbor Villa and Chalet: removed their dropdown options, dispatch branches, build
  functions, spawn-point labels, and dead floor-height branches. Only Suburban House,
  Warehouse District, and Office Tower remain.
- **Real bug fixed — Office Tower stairs were unusable.** The staircase pushed a solid,
  full-height collider over the exact same footprint as its own walkable ramp, so the whole
  stairwell acted like a wall. Removed the collider; stairs now work like the house's (visual
  steps + a getFloorHeight() ramp, no blocking collider).
- **Real bug fixed — delayed gadget effects (Ace's SELMA, Thermite, Fuze, timed intel reveals,
  Dokkaebi, Lion, cloak timers) could fire into the next round.** They look up live
  `this.bots`/`this.barricades` when their `setTimeout` fires; if a round ended first, the
  leftover stages fired into the freshly-spawned next round, sometimes ending it immediately.
  Added `scheduleTimeout()` (tracks pending timers) and cancel them all in
  `clearRoundEntities()`.
- **Twitch's Shock Drone is now an actual piloted, armed drone** instead of an instant
  no-drone zap. Reuses the exact same ReconDrone class/camera-control system as the recon
  drone (`this.drone`/`inDroneMode`), just spawned from a gadget charge and flagged
  `isArmed` — left-click while piloting fires a taser dart (`fireDroneShock()`, hitscan +
  stun, 1.1s cooldown) instead of doing nothing.
- **Montagne's and Blackbeard's shields are now hold-based on [TAB]** instead of a
  click-to-toggle-forever ability. `updateHeldGadgets()` syncs `player.shielded` to whether
  Tab is currently held, every frame, for exactly as long as it's held. The old ability-key
  cases for both now just remind the player to hold Tab instead of toggling.

## Scope note
"Do that for all opps" (armed pilotable drones / hold-to-use gadgets for every operator) is a
real, multi-session feature build across ~78 operators, not a single-pass change. The two
reusable systems above (`isArmed` drones via `setArmed()`/`canFireShock()`, and
`updateHeldGadgets()`'s per-op branch) are built so more operators can be wired into them
incrementally — happy to keep going operator-by-operator on request.

## Verification
`npx tsc --noEmit` and `npm run build` both pass clean.
