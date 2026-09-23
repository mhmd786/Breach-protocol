# Tab: pure equip button (no UI, no F fallback) + hold-to-aim throwing

- **Removed the [F] fallback from [TAB]** — `toggleHeldGadget()` no longer calls `useAbility()`
  for operators with nothing holdable. Tab is now strictly a single-purpose equip/holster
  button (shield, camera, or breach charge) and does nothing for everyone else, instead of
  quietly duplicating [F]. There's still no menu/UI involved — same as before, just equip.
- **Removed the redundant instant-throw from [F] for Valkyrie/Maestro/Mira.** Their cameras
  used to throw immediately (no aim, full arc distance, straight off the crosshair) when you
  pressed [F], *in addition to* the separate Tab/G-equip-and-throw path — meaning there were
  two different ways to fire the same camera with different feel. [F] now just logs a
  reminder to use [TAB]; placing the camera only happens through the equip-then-throw flow.
  Added Mira to `getThrowableTypeForOperator()` so she gets that flow too (she previously
  only had the instant [F] throw and no Tab/G option at all).
- **Click-and-hold now previews where a throwable will land, release to actually throw/place
  it** — previously, clicking while a camera or breach charge was equipped executed
  instantly on mousedown with no aiming step:
  - Camera (Valkyrie/Maestro/Mira): the existing gravity-arc trajectory dots
    (`updateTrajectoryPreview()`) now only render while the mouse button is actually held
    down (`isAimingThrow`), instead of constantly while just equipped. Release throws it via
    `executeThrow()`, using whatever direction you're aiming at that instant.
  - Breach charge: added `updateBreachPlantPreview()` — a ring decal that follows the same
    raycast `plantBreachChargeAtAim()` itself uses, shown green on a valid wall/barricade
    within range or red at max range if nothing's hit. Release plants it there.
  - Both are cancelled and hidden if the gadget gets force-holstered mid-aim (entering
    drone/CCTV mode, or an operator/side change via `updateHeldGadgets()`'s safety net).

# Tab now equips ALL gadgets (not just the shield), plus fixed several gadgets that didn't actually work

- **[TAB] is now the universal equip/holster key**, contextual per operator (`toggleHeldGadget()`
  in `BreachProtocolEngine.ts`):
  - Montagne/Blackbeard: raises/lowers their shield (unchanged from before).
  - Valkyrie/Maestro: equips their throwable camera into your hands — same model [G] already
    threw, just as a press-toggle instead of hold-to-open. Left-click places it and auto-holsters.
  - Any attacker with breach charges: equips one into your hands (new held-breach-charge model
    added to `ModelFactory.createGadgetViewRig()`). Left-click plants it wherever you're aiming
    and auto-holsters; [B] still works too for an instant plant without equipping first.
  - Everyone else: falls back to firing their ability directly (same as [F]), so [TAB] always
    does *something* for every operator.
  - `updateGadgetViewmodel()` now rebuilds the held-gadget rig on demand instead of only ever
    showing the camera model, and gadgets are force-holstered when entering drone/CCTV mode
    (`holsterHeldGadgets()`, called from `toggleDroneMode()`/`toggleCctvMode()`) so you can't get
    stuck holding a breach charge while piloting a drone.

- **Fixed: flashbangs (and Frost's mat / Nomad's mine) never actually affected the human
  player.** `engine.player.stunned` was being *written* by GadgetSystem's welcome_mat/
  airjab_mine effects but was never declared on the player or read anywhere — and flashbang
  detonation only ever stunned bots, never you. Added a real `player.stunned` countdown,
  wired into movement (heavy slowdown) and firing (blocked while stunned), made flashbangs
  actually blind/stun the player within blast radius (respecting Warden's immunity), and
  added a fading white `flashWhiteout` screen overlay (driven directly off
  `engine.flashWhiteout` every frame via a dedicated rAF loop in `App.tsx`, not React state,
  so it fades smoothly without re-rendering the whole HUD).

- **Fixed: Glaz's thermal sight and IQ's/Solis's electronics detector did nothing.** Both
  toggled `player.isThermalVision`/`player.isElectronicsDetector` but nothing ever rendered
  anything for either flag (unlike Pulse's cardiac sensor and Lion's sonar scan, which already
  worked). Added matching wallhack pings for both in `updateWallhackPings()` — enemy-highlight
  pings for Glaz specifically (Warden reuses the same `isThermalVision` field for his own
  unrelated flash/smoke immunity, so it's gated to `op.id === 'glaz'` to avoid false pings for
  him), and pings on every enemy-owned `isElectronic` gadget in range for IQ/Solis.

## Audit notes (this pass)

Cross-checked every `gadgetSystem.deployGadget('type', ...)` call in the engine against the
model cases in `GadgetSystem.ts`'s `deployGadget()` switch and the trigger logic in its
`update()` loop — all 14 currently-deployed gadget types have both a real model and real
runtime behavior; no orphaned "logs a message and does nothing" stubs found there. Also
confirmed all 78 operators in the real, actually-used `Roster.ts` data (not the dead,
never-imported `src/data/operators.ts`/`weapons.ts` files) have a populated `case` in
`useAbility()`. This was a systematic check of the deploy/model/trigger wiring and the two
gaps above that it surfaced, not a full manual playtest of all 78 operators — there may still
be balance or edge-case issues in individual abilities that this pass wouldn't catch.

## Verification limitation (this pass)

This container has no network access, so `npm install` could not complete and `npm run build` /
`tsc --noEmit` could not be run against these changes. Edits were reviewed by hand for syntax,
type, and import correctness (including a brace-balance check across all three edited files)
but not compiled — please run a build before deploying.

# Twitch's Shock Drone now fires real bullets

- Replaced the drone's old narrow-angle hitscan "taser dart" (single check against bots
  only, no visuals, flat 15 dmg + stun) with an actual gun: `fireDroneGun()` now raycasts
  against the same target set a normal gunshot does — bots, remote players, deployed
  gadgets, security cameras, barricades, and walls — reusing `raycastShot()`'s hit-resolution
  logic, complete with a visible bullet tracer (`drawTracer`), impact sparks (`spawnImpact`),
  real gunfire sound, and 20 real bullet damage on whatever it hits (no more stun-only zap).
- It's now full-auto while piloting: left-click fires immediately and holding the button
  keeps firing every 0.12s (`ReconDrone.fireCooldown`, renamed from `shockCooldown`) for as
  long as it's held, instead of one dart per click on a 1.1s cooldown. `ReconDrone.canFire()`
  (renamed from `canFireShock()`) gates both the click and the new held-fire loop.
- Renamed the drone's `isArmed` mount from a taser-dart cone to a small mounted gun barrel
  mesh, and updated Twitch's ability/biography text in `operators.ts` and `Roster.ts` to
  describe live-fire rounds instead of a silent taser.

## Verification limitation (this pass)

This container has no network access, so `npm install` could not complete and `npm run build` /
`tsc --noEmit` could not be run against these changes. Edits were reviewed by hand for syntax,
type, and import correctness but not compiled — please run a build before deploying.

# Removed Tab gadget wheel, restored direct controls, Tab shield is now a toggle

- Removed the Tab-hold Gadget Wheel from `App.tsx` (`showGadgetWheel`/`hoveredGadget` state,
  `equipHoveredGadget()`, and its overlay). [B] Breach, [5] Drone, [6] Cameras go straight to
  `BreachProtocolEngine`'s own key handlers again, same as before the wheel was added — Tab no
  longer intercepts them or exits pointer lock to open a menu.
- Montagne's/Blackbeard's shield gadget on [TAB] is now a press-to-toggle instead of a
  press-and-hold: press Tab once to equip/raise the shield, press it again to holster it and
  return to the weapon. Renamed `updateHeldGadgets()`'s old hold-polling logic to
  `toggleHeldGadget()`, called once per keydown (ignoring OS key-repeat) instead of every frame
  off `this.keys['Tab']`. `updateHeldGadgets()` now only runs as a per-frame safety net that
  holsters the shield if the operator changes out from under it.

## Verification limitation (this pass)

This container has no network access, so `npm install` could not complete and `npm run build` /
`tsc --noEmit` could not be run against these changes. Edits were reviewed by hand for syntax,
type, and import correctness but not compiled — please run a build before deploying.

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
