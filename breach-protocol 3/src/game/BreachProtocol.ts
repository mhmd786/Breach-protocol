import * as THREE from 'three';
export { type OperatorDef, OPERATORS, ATTACKERS, DEFENDERS, getOperatorById } from './Roster';
import { OperatorDef, OPERATORS } from './Roster';

export interface WeaponDef {
  id: string;
  name: string;
  dmg: number;
  rate: number;
  spread: number;
  mag: number;
  reserve: number;
  auto: boolean;
  pellets?: number;
  isSniper?: boolean;
  isAssault?: boolean;
  isMelee?: boolean;
  isShield?: boolean;
}

export interface WallBox {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  style?: string;
}

export interface MapData {
  name: string;
  floorColor: number;
  floorSize: number;
  skyColor: number;
  walls: WallBox[];
  spawnsAtk: [number, number][];
  spawnsDef: [number, number][];
  objective: [number, number];
}

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
  temporary?: boolean;
  reinforced?: boolean;
}

export interface Personality {
  name: string;
  engageBonus: number;
  caution: number;
  hearRange: number;
  retreatHp: number;
  mistakeChance: number;
  holdBias: number;
}

export const WEAPONS: WeaponDef[] = [
  // Assault Rifles (AR)
  { id:'l85a2',      name:'L85A2 (Sledge/Thatcher)', dmg:47, rate:0.09,  spread:0.012, mag:30, reserve:120, auto:true,  isAssault:true },
  { id:'ak12',       name:'AK-12 (Ace/Fuze)',        dmg:45, rate:0.08,  spread:0.015, mag:30, reserve:120, auto:true,  isAssault:true },
  { id:'f2',         name:'F2 (Twitch)',             dmg:37, rate:0.062, spread:0.018, mag:25, reserve:100, auto:true,  isAssault:true },
  { id:'sc3000k',    name:'SC3000K (Zero)',          dmg:45, rate:0.075, spread:0.011, mag:30, reserve:120, auto:true,  isAssault:true },
  { id:'m4',         name:'M4 (Maverick)',           dmg:44, rate:0.08,  spread:0.014, mag:30, reserve:120, auto:true,  isAssault:true },
  { id:'carbine416', name:'416-C Carbine (Jäger)',   dmg:38, rate:0.081, spread:0.016, mag:30, reserve:120, auto:true,  isAssault:true },

  // Submachine Guns (SMG)
  { id:'mp5',        name:'MP5 ACOG (Doc/Rook)',     dmg:27, rate:0.075, spread:0.013, mag:30, reserve:120, auto:true },
  { id:'vector',     name:'Vector .45 ACP (Mira)',   dmg:23, rate:0.05,  spread:0.020, mag:25, reserve:125, auto:true },
  { id:'mpx',        name:'MPX (Valkyrie)',          dmg:26, rate:0.072, spread:0.011, mag:30, reserve:120, auto:true },
  { id:'t5smg',      name:'T-5 SMG (Lesion/Oryx)',   dmg:28, rate:0.067, spread:0.012, mag:30, reserve:120, auto:true },
  { id:'scorpion',   name:'Scorpion EVO 3 (Ela)',    dmg:23, rate:0.055, spread:0.022, mag:40, reserve:120, auto:true },

  // Marksman Rifles (DMR) & Snipers
  { id:'dmr417',     name:'417 DMR 3.5x Scope',      dmg:69, rate:0.18,  spread:0.003, mag:20, reserve:80,  auto:false, isSniper:true },
  { id:'csrx300',    name:'CSRX 300 Kali Sniper',    dmg:135,rate:0.85,  spread:0.001, mag:5,  reserve:25,  auto:false, isSniper:true },
  { id:'bosg',       name:'BOSG.12.2 Slug Sniper',   dmg:125,rate:0.35,  spread:0.005, mag:2,  reserve:30,  auto:false, isSniper:true },

  // Light Machine Guns (LMG)
  { id:'alda',       name:'ALDA 5.56 LMG (Maestro)', dmg:30, rate:0.067, spread:0.020, mag:80, reserve:240, auto:true,  isAssault:true },
  { id:'p641',       name:'6P41 LMG (Fuze/Finka)',   dmg:47, rate:0.088, spread:0.022, mag:100,reserve:200, auto:true,  isAssault:true },

  // Shotguns
  { id:'m590a1',     name:'M590A1 Soft Breacher',    dmg:48, rate:0.65,  spread:0.08,  mag:7,  reserve:35,  auto:false, pellets:8 },
  { id:'sgcqb',      name:'SG-CQB Shotgun',          dmg:53, rate:0.60,  spread:0.075, mag:7,  reserve:35,  auto:false, pellets:8 },

  // Sidearms & Machine Pistols
  { id:'smg11',      name:'SMG-11 Machine Pistol',   dmg:35, rate:0.047, spread:0.028, mag:16, reserve:80,  auto:true },
  { id:'pistolP9',   name:'P9 Tac Sidearm',          dmg:45, rate:0.15,  spread:0.015, mag:16, reserve:64,  auto:false },
  { id:'mag44',      name:'.44 Mag 3.0x Scope',      dmg:54, rate:0.25,  spread:0.005, mag:6,  reserve:36,  auto:false, isSniper:true },

  // Melee & Shield
  { id:'hammer',     name:'Breaching Hammer',        dmg:100,rate:0.50,  spread:0.01,  mag:99, reserve:99,  auto:false, isMelee:true },
  { id:'shield',     name:'Ballistic Shield',        dmg:40, rate:0.60,  spread:0.02,  mag:99, reserve:99,  auto:false, isShield:true },
];

export function getRecommendedWeaponIndex(op: OperatorDef): number {
  const opWeapons = getWeaponsForOperator(op);
  if (opWeapons.length === 0) return 0;
  const match = WEAPONS.findIndex(w => w.id === opWeapons[0].id);
  return match >= 0 ? match : 0;
}

export function getWeaponsForOperator(op: OperatorDef): WeaponDef[] {
  let allowedIds: string[] = [];
  if (op.id === 'sledge') allowedIds = ['l85a2', 'm590a1', 'smg11', 'pistolP9', 'hammer'];
  else if (op.id === 'montagne' || op.id === 'blitz') allowedIds = ['shield', 'pistolP9'];
  else if (op.id === 'glaz' || op.id === 'kali') allowedIds = ['csrx300', 'pistolP9'];
  else if (op.id === 'twitch') allowedIds = ['f2', 'dmr417', 'sgcqb', 'pistolP9'];
  else if (op.id === 'fuze' || op.id === 'ace') allowedIds = ['ak12', 'p641', 'pistolP9'];
  else if (op.id === 'maverick') allowedIds = ['m4', 'bosg', 'pistolP9'];
  else if (op.id === 'zero') allowedIds = ['sc3000k', 'mp5', 'pistolP9'];
  else if (op.id === 'jager') allowedIds = ['carbine416', 'm590a1', 'pistolP9'];
  else if (op.id === 'mira' || op.id === 'goyo') allowedIds = ['vector', 'm590a1', 'pistolP9'];
  else if (op.id === 'valkyrie') allowedIds = ['mpx', 'sgcqb', 'mag44'];
  else if (op.id === 'lesion' || op.id === 'oryx') allowedIds = ['t5smg', 'm590a1', 'pistolP9'];
  else if (op.id === 'ela') allowedIds = ['scorpion', 'sgcqb', 'pistolP9'];
  else if (op.id === 'maestro') allowedIds = ['alda', 'bosg', 'mag44'];
  else if (op.id === 'smoke' || op.id === 'mute') allowedIds = ['m590a1', 'smg11', 'pistolP9'];
  else if (op.id === 'doc' || op.id === 'rook') allowedIds = ['mp5', 'sgcqb', 'pistolP9'];
  else if (op.side === 'atk') allowedIds = ['l85a2', 'ak12', 'f2', 'sc3000k', 'm4', 'dmr417', 'csrx300', 'p641', 'm590a1', 'pistolP9'];
  else allowedIds = ['mp5', 'vector', 'mpx', 't5smg', 'scorpion', 'alda', 'carbine416', 'm590a1', 'pistolP9'];

  const filtered = WEAPONS.filter(w => allowedIds.includes(w.id));
  return filtered.length > 0 ? filtered : WEAPONS.slice(0, 4);
}

export const MAPS: Record<string, MapData> = {
  copperyard: {
    name:'Copper Yard',
    floorColor:0x3a3226, floorSize:60,
    skyColor:0x88a5c2,
    walls:[
      {x:0,z:-20,w:40,d:1,h:4,color:0x6b5a44},
      {x:0,z:20,w:40,d:1,h:4,color:0x6b5a44},
      {x:-20,z:0,w:1,d:40,h:4,color:0x6b5a44},
      {x:20,z:0,w:1,d:40,h:4,color:0x6b5a44},
      {x:-8,z:-6,w:6,d:1,h:3,color:0x8a7a5a},
      {x:8,z:6,w:6,d:1,h:3,color:0x8a7a5a},
      {x:0,z:0,w:1,d:10,h:2.2,color:0xa06a3a},
      {x:-10,z:8,w:5,d:5,h:3.5,color:0x7a6a50},
      {x:10,z:-8,w:5,d:5,h:3.5,color:0x7a6a50},
      {x:4,z:-12,w:8,d:1,h:2.6,color:0x8a7a5a},
      {x:-4,z:12,w:8,d:1,h:2.6,color:0x8a7a5a},
    ],
    spawnsAtk:[[-16,-16],[-16,-13],[-13,-16]],
    spawnsDef:[[16,16],[16,13],[13,16]],
    objective:[0,0],
  },
  harborrelay: {
    name:'Harbor Relay',
    floorColor:0x2c3a42, floorSize:64,
    skyColor:0x6c8fa8,
    walls:[
      {x:0,z:-22,w:44,d:1,h:4,color:0x3d5560},
      {x:0,z:22,w:44,d:1,h:4,color:0x3d5560},
      {x:-22,z:0,w:1,d:44,h:4,color:0x3d5560},
      {x:22,z:0,w:1,d:44,h:4,color:0x3d5560},
      {x:0,z:-6,w:14,d:1,h:3,color:0x4d6a78},
      {x:0,z:6,w:14,d:1,h:3,color:0x4d6a78},
      {x:-12,z:0,w:1,d:16,h:3,color:0x4d6a78},
      {x:12,z:0,w:1,d:16,h:3,color:0x4d6a78},
      {x:-6,z:-14,w:6,d:6,h:3.6,color:0x5a7a88},
      {x:6,z:14,w:6,d:6,h:3.6,color:0x5a7a88},
      {x:14,z:-6,w:5,d:5,h:2.8,color:0x35505c},
      {x:-14,z:6,w:5,d:5,h:2.8,color:0x35505c},
    ],
    spawnsAtk:[[-18,-18],[-18,-15],[-15,-18]],
    spawnsDef:[[18,18],[18,15],[15,18]],
    objective:[0,0],
  },
  oldmetro: {
    name:'Old Metro',
    floorColor:0x272524, floorSize:58,
    skyColor:0x3a3a44,
    walls:[
      {x:0,z:-20,w:40,d:1,h:4.5,color:0x40403c,style:'rust'},
      {x:0,z:20,w:40,d:1,h:4.5,color:0x40403c,style:'rust'},
      {x:-20,z:0,w:1,d:40,h:4.5,color:0x40403c,style:'rust'},
      {x:20,z:0,w:1,d:40,h:4.5,color:0x40403c,style:'rust'},
      {x:-6,z:0,w:1,d:24,h:3,color:0x50504a,style:'rust'},
      {x:6,z:0,w:1,d:24,h:3,color:0x50504a,style:'rust'},
      {x:0,z:-10,w:14,d:1,h:3,color:0x50504a,style:'rust'},
      {x:0,z:10,w:14,d:1,h:3,color:0x50504a,style:'rust'},
      {x:-13,z:-13,w:5,d:5,h:3.2,color:0x605c50,style:'rust'},
      {x:13,z:13,w:5,d:5,h:3.2,color:0x605c50,style:'rust'},
      {x:13,z:-13,w:5,d:5,h:3.2,color:0x605c50,style:'rust'},
      {x:-13,z:13,w:5,d:5,h:3.2,color:0x605c50,style:'rust'},
    ],
    spawnsAtk:[[-16,-16],[-16,-13],[-13,-16]],
    spawnsDef:[[16,16],[16,13],[13,16]],
    objective:[0,0],
  },
};

export const PERSONALITY_TYPES: Personality[] = [
  { name:'Aggressive', engageBonus:1.4, caution:0.5, hearRange:16, retreatHp:15, mistakeChance:0.10, holdBias:0.2 },
  { name:'Tactical',   engageBonus:1.0, caution:1.2, hearRange:20, retreatHp:35, mistakeChance:0.08, holdBias:0.6 },
  { name:'Defensive',  engageBonus:0.8, caution:1.4, hearRange:18, retreatHp:45, mistakeChance:0.06, holdBias:1.0 },
  { name:'Support',    engageBonus:0.9, caution:1.1, hearRange:22, retreatHp:40, mistakeChance:0.07, holdBias:0.7 },
  { name:'Roamer',     engageBonus:1.2, caution:0.7, hearRange:24, retreatHp:25, mistakeChance:0.12, holdBias:0.1 },
];

export const TextureFactory = (function(){
  function clamp(v: number){ return Math.max(0,Math.min(255,v)); }

  function hexToRgb(hex: number): [number, number, number]{
    return [(hex>>16)&255, (hex>>8)&255, hex&255];
  }

  function noiseCanvas(w: number, h: number, baseColor: [number, number, number], variance: number, opts: any = {}){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const [br,bg,bb] = baseColor;
    const img = ctx.createImageData(w,h);
    for(let i=0;i<img.data.length;i+=4){
      const n = (Math.random()-0.5)*variance;
      img.data[i]   = clamp(br+n);
      img.data[i+1] = clamp(bg+n);
      img.data[i+2] = clamp(bb+n);
      img.data[i+3] = 255;
    }
    ctx.putImageData(img,0,0);

    if(opts.grime){
      ctx.globalAlpha = 0.15;
      for(let i=0;i<40;i++){
        ctx.fillStyle = Math.random()<0.5 ? '#000' : '#222';
        const rw = 4+Math.random()*30, rh = 4+Math.random()*30;
        ctx.fillRect(Math.random()*w, Math.random()*h, rw, rh);
      }
      ctx.globalAlpha = 1;
    }
    if(opts.panelLines){
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      const step = opts.panelStep || 64;
      for(let x=0;x<w;x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for(let y=0;y<h;y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    }
    if(opts.rust){
      ctx.globalAlpha = 0.25;
      for(let i=0;i<18;i++){
        const grd = ctx.createRadialGradient(
          Math.random()*w, Math.random()*h, 1,
          Math.random()*w, Math.random()*h, 10+Math.random()*24
        );
        grd.addColorStop(0, 'rgba(120,60,20,0.9)');
        grd.addColorStop(1, 'rgba(120,60,20,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,w,h);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function makeTexture(canvas: HTMLCanvasElement, repeatX=1, repeatY=1){
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    return tex;
  }

  function wallTexture(hexColor: number, repeat=2, style='panel'){
    const rgb = hexToRgb(hexColor);
    const opts = style==='rust'
      ? { grime:true, rust:true, panelLines:true, panelStep:96 }
      : { grime:true, panelLines:true, panelStep:64 };
    const canvas = noiseCanvas(256,256, rgb, 14, opts);
    return makeTexture(canvas, repeat, repeat);
  }

  function floorTexture(hexColor: number, repeat=10){
    const rgb = hexToRgb(hexColor);
    const canvas = noiseCanvas(256,256, rgb, 10, { grime:true, panelLines:true, panelStep:32 });
    return makeTexture(canvas, repeat, repeat);
  }

  function skyGradient(hexTop: number, hexBottom: number){
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(c);
    const grd = ctx.createLinearGradient(0,0,0,256);
    grd.addColorStop(0, '#'+hexTop.toString(16).padStart(6,'0'));
    grd.addColorStop(1, '#'+hexBottom.toString(16).padStart(6,'0'));
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,2,256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  function muzzleFlashSprite(){
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grd = ctx.createRadialGradient(32,32,0,32,32,32);
      grd.addColorStop(0,'rgba(255,240,180,1)');
      grd.addColorStop(0.4,'rgba(255,190,80,0.9)');
      grd.addColorStop(1,'rgba(255,140,40,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0,0,64,64);
    }
    return new THREE.CanvasTexture(c);
  }

  return { wallTexture, floorTexture, skyGradient, muzzleFlashSprite };
})();
