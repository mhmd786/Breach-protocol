import * as THREE from 'three';

/**
 * High-definition procedural canvas texture generator for architectural materials,
 * realistic tactical uniforms, weapons, and props.
 */
export class ProceduralTextures {
  private static cache: Record<string, THREE.CanvasTexture> = {};

  /**
   * Generates authentic red/tan masonry brick with mortar lines
   */
  public static createBrickTexture(repeatX = 4, repeatY = 4): THREE.CanvasTexture {
    const key = `brick_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    // Mortar background
    ctx.fillStyle = '#b8b0a2';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const rowH = 512 / rows;
    const cols = 8;
    const colW = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2) * (colW / 2);
      for (let col = -1; col < cols + 1; col++) {
        const x = col * colW + offsetX + 2;
        const y = r * rowH + 2;
        const w = colW - 4;
        const h = rowH - 4;

        // Brick color variation (terracotta, deep red, burnt sienna)
        const tone = 120 + Math.floor(Math.random() * 40);
        const red = tone + 40 + Math.floor(Math.random() * 20);
        const blue = Math.floor(tone * 0.45);
        ctx.fillStyle = `rgb(${red},${tone},${blue})`;
        ctx.fillRect(x, y, w, h);

        // Brick texture noise
        for (let i = 0; i < 20; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
          ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 3, 2);
        }

        // Inner shadow on brick
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Generates rich parquet / hardwood floor with realistic wood grain & individual planks
   */
  public static createWoodFloorTexture(repeatX = 6, repeatY = 6): THREE.CanvasTexture {
    const key = `wood_floor_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    const planks = 12;
    const plankW = 512 / planks;

    for (let i = 0; i < planks; i++) {
      const x = i * plankW;
      // Base wood tone variations
      const baseR = 140 + Math.floor(Math.random() * 30);
      const baseG = 95 + Math.floor(Math.random() * 25);
      const baseB = 55 + Math.floor(Math.random() * 20);

      ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
      ctx.fillRect(x, 0, plankW, 512);

      // Wood grain lines
      ctx.fillStyle = 'rgba(60,35,15,0.18)';
      for (let g = 0; g < 14; g++) {
        const gx = x + Math.random() * plankW;
        ctx.fillRect(gx, 0, 1.5, 512);
      }

      // Plank end joints
      ctx.strokeStyle = 'rgba(25,12,5,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, 0, plankW, 512);

      const cuts = [120, 290, 430];
      for (const cut of cuts) {
        if (Math.random() > 0.4) {
          ctx.beginPath();
          ctx.moveTo(x, cut);
          ctx.lineTo(x + plankW, cut);
          ctx.stroke();
        }
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Generates modern kitchen/bath ceramic tile with grout
   */
  public static createTileTexture(repeatX = 5, repeatY = 5): THREE.CanvasTexture {
    const key = `tiles_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    // Grout
    ctx.fillStyle = '#2b2e33';
    ctx.fillRect(0, 0, 256, 256);

    const step = 64;
    for (let y = 0; y < 256; y += step) {
      for (let x = 0; x < 256; x += step) {
        ctx.fillStyle = '#7a8594';
        ctx.fillRect(x + 2, y + 2, step - 4, step - 4);

        // Subtle specular highlight
        const grd = ctx.createLinearGradient(x + 2, y + 2, x + step - 2, y + step - 2);
        grd.addColorStop(0, 'rgba(255,255,255,0.18)');
        grd.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = grd;
        ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Generates high-end interior drywall wallpaper with subtle plaster texture
   */
  public static createDrywallTexture(hexColor: number, repeatX = 6, repeatY = 6): THREE.CanvasTexture {
    const key = `drywall_${hexColor}_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    const hexStr = '#' + hexColor.toString(16).padStart(6, '0');
    ctx.fillStyle = hexStr;
    ctx.fillRect(0, 0, 256, 256);

    // Fine plaster micro-stipple
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Roof tiles / Asphalt Shingle texture
   */
  public static createRoofShingleTexture(repeatX = 8, repeatY = 8): THREE.CanvasTexture {
    const key = `roof_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#1c2024';
    ctx.fillRect(0, 0, 256, 256);

    const rows = 8;
    const rowH = 256 / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      ctx.fillStyle = r % 2 === 0 ? '#2a3036' : '#23272c';
      ctx.fillRect(0, y, 256, rowH - 2);

      // Shingle line shadows
      ctx.strokeStyle = '#0e1114';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y + rowH - 1);
      ctx.lineTo(256, y + rowH - 1);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Tactical Multicam / Digital camouflage for operators
   */
  public static createCamoTexture(side: 'atk' | 'def'): THREE.CanvasTexture {
    const key = `camo_${side}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    const baseColor = side === 'atk' ? '#3d443b' : '#333e48';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 256);

    const blotches = side === 'atk'
      ? ['#262d24', '#5a6252', '#1c1f1a', '#78735a']
      : ['#20272e', '#455563', '#161a20', '#566675'];

    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = blotches[Math.floor(Math.random() * blotches.length)];
      const bx = Math.random() * 256;
      const by = Math.random() * 256;
      const bw = 15 + Math.random() * 35;
      const bh = 10 + Math.random() * 25;
      ctx.beginPath();
      ctx.ellipse(bx, by, bw / 2, bh / 2, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Heavy Tactical Reinforced Steel Wall Texture with cross-bracing and anchor bolts
   */
  public static createReinforcedWallTexture(repeatX = 2, repeatY = 2): THREE.CanvasTexture {
    const key = `reinforced_wall_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    // Dark ballistic steel backing
    ctx.fillStyle = '#1e252b';
    ctx.fillRect(0, 0, 512, 512);

    // Corrugated heavy steel armor plating
    for (let x = 0; x < 512; x += 64) {
      const grad = ctx.createLinearGradient(x, 0, x + 64, 0);
      grad.addColorStop(0, '#2d3748');
      grad.addColorStop(0.5, '#4a5568');
      grad.addColorStop(1, '#1a202c');
      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, 8, 60, 496);
    }

    // Heavy X-cross structural steel bracing
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(496, 496);
    ctx.moveTo(496, 16);
    ctx.lineTo(16, 496);
    ctx.stroke();

    // Steel anchor bolts & red warning locking pins
    for (let by = 32; by <= 480; by += 64) {
      for (let bx of [32, 256, 480]) {
        // Metallic flange
        ctx.fillStyle = '#1a202c';
        ctx.beginPath();
        ctx.arc(bx, by, 10, 0, Math.PI * 2);
        ctx.fill();
        // Red locking head
        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Yellow hazard warning stripe border at top and bottom
    const addHazardBand = (y: number) => {
      ctx.fillStyle = '#ecc94b';
      ctx.fillRect(0, y, 512, 20);
      ctx.fillStyle = '#1a202c';
      for (let s = -20; s < 532; s += 30) {
        ctx.beginPath();
        ctx.moveTo(s, y);
        ctx.lineTo(s + 15, y);
        ctx.lineTo(s + 30, y + 20);
        ctx.lineTo(s + 15, y + 20);
        ctx.closePath();
        ctx.fill();
      }
    };
    addHazardBand(0);
    addHazardBand(492);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Destructible Interior Soft Wall drywall with panel seams and stud markers
   */
  public static createSoftWallDrywallTexture(hexColor = 0xece5d8, repeatX = 2, repeatY = 2): THREE.CanvasTexture {
    const key = `soft_drywall_${hexColor}_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    const hexStr = '#' + hexColor.toString(16).padStart(6, '0');
    ctx.fillStyle = hexStr;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle drywall plaster noise
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }

    // Vertical drywall panel seams
    for (let px = 128; px < 512; px += 128) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, 512);
      ctx.stroke();

      // Subtle drywall screw dimples
      for (let sy = 32; sy < 512; sy += 64) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.arc(px, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Framed Canvas Oil Painting for house walls
   */
  public static createFramedArt(artType = 0): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const ctx = c.getContext('2d')!;

    // Gold / Dark wood frame border
    ctx.fillStyle = '#1c140a';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#cda250';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 244, 148);

    // Painting canvas inner
    if (artType === 0) {
      // Landscape sunset over mountains
      const sky = ctx.createLinearGradient(0, 10, 0, 100);
      sky.addColorStop(0, '#f97b4f');
      sky.addColorStop(1, '#ffd166');
      ctx.fillStyle = sky;
      ctx.fillRect(10, 10, 236, 140);

      // Mountains
      ctx.fillStyle = '#2b2d42';
      ctx.beginPath();
      ctx.moveTo(10, 150);
      ctx.lineTo(80, 70);
      ctx.lineTo(150, 130);
      ctx.lineTo(210, 50);
      ctx.lineTo(246, 150);
      ctx.fill();
    } else {
      // Modern Abstract Art
      ctx.fillStyle = '#edf2f4';
      ctx.fillRect(10, 10, 236, 140);
      ctx.fillStyle = '#ef233c';
      ctx.beginPath();
      ctx.arc(80, 80, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2d42';
      ctx.fillRect(110, 40, 90, 80);
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(150, 20);
      ctx.lineTo(230, 140);
      ctx.lineTo(120, 140);
      ctx.fill();
    }

    return new THREE.CanvasTexture(c);
  }

  /**
   * Generates realistic road asphalt with double yellow lines and curb markings
   */
  public static createRoadAsphaltTexture(repeatX = 1, repeatY = 4): THREE.CanvasTexture {
    const key = `road_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    // Dark asphalt
    ctx.fillStyle = '#1b1e22';
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt aggregate speckles
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.15)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Double yellow center divider lines
    ctx.fillStyle = '#e5a823';
    ctx.fillRect(250, 0, 5, 512);
    ctx.fillRect(260, 0, 5, 512);

    // White edge lines
    ctx.fillStyle = '#d8dce2';
    ctx.fillRect(35, 0, 6, 512);
    ctx.fillRect(471, 0, 6, 512);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Industrial polished concrete texture (garage, basement, sidewalks)
   */
  public static createConcreteTexture(repeatX = 4, repeatY = 4): THREE.CanvasTexture {
    const key = `concrete_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#656b72';
    ctx.fillRect(0, 0, 512, 512);

    // Noise variation & fine cracks
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }

    // Expansion joint seams
    ctx.strokeStyle = 'rgba(30,35,40,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Exterior lawn / grass ground texture — mottled green with light blade streaks
   * so open grounds around a map don't read as a flat solid-color plane.
   */
  public static createGrassTexture(repeatX = 20, repeatY = 20): THREE.CanvasTexture {
    const key = `grass_${repeatX}_${repeatY}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#3a5a2c';
    ctx.fillRect(0, 0, 512, 512);

    // Patchy mottling for tonal variation
    for (let i = 0; i < 220; i++) {
      const shade = Math.random() > 0.5 ? 'rgba(70,105,50,0.35)' : 'rgba(30,48,22,0.3)';
      ctx.fillStyle = shade;
      const r = 14 + Math.random() * 30;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Short blade-like streaks
    for (let i = 0; i < 1400; i++) {
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(90,130,60,0.5)' : 'rgba(20,38,16,0.4)';
      ctx.lineWidth = 1;
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 5, y - 4 - Math.random() * 4);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Luxury Persian / Modern area rug texture
   */
  public static createCarpetTexture(): THREE.CanvasTexture {
    const key = 'carpet_rug';
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#222d3d';
    ctx.fillRect(0, 0, 512, 512);

    // Border
    ctx.strokeStyle = '#cda250';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, 472, 472);

    ctx.strokeStyle = '#e07a5f';
    ctx.lineWidth = 6;
    ctx.strokeRect(35, 35, 442, 442);

    // Geometric diamond medallion in center
    ctx.fillStyle = '#e07a5f';
    ctx.beginPath();
    ctx.moveTo(256, 120);
    ctx.lineTo(392, 256);
    ctx.lineTo(256, 392);
    ctx.lineTo(120, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#cda250';
    ctx.beginPath();
    ctx.arc(256, 256, 50, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * High-contrast black & yellow diagonal hazard caution stripes
   */
  public static createHazardTapeTexture(): THREE.CanvasTexture {
    const key = 'hazard_tape';
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, 256, 64);

    ctx.fillStyle = '#111111';
    for (let x = -64; x < 320; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x - 12, 64);
      ctx.lineTo(x - 32, 64);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache[key] = tex;
    return tex;
  }

  /**
   * High-tech server rack front with blinking LEDs and server blades
   */
  public static createServerRackTexture(): THREE.CanvasTexture {
    const key = 'server_rack';
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#14181c';
    ctx.fillRect(0, 0, 256, 512);

    const units = 16;
    const uH = 512 / units;
    for (let i = 0; i < units; i++) {
      const y = i * uH;
      ctx.fillStyle = i % 2 === 0 ? '#1e242a' : '#232a32';
      ctx.fillRect(8, y + 2, 240, uH - 4);

      // Server vents
      ctx.fillStyle = '#0a0d0f';
      ctx.fillRect(16, y + 6, 120, uH - 12);

      // Status LEDs
      const colors = ['#00ff88', '#00ddff', '#ffb703', '#3a86ff'];
      for (let l = 0; l < 4; l++) {
        ctx.fillStyle = colors[l % colors.length];
        ctx.beginPath();
        ctx.arc(150 + l * 18, y + uH / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cable port
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(222, y + uH / 2 - 4, 16, 8);
    }

    const tex = new THREE.CanvasTexture(c);
    this.cache[key] = tex;
    return tex;
  }

  /**
   * Generates authentic Rainbow Six Siege Black Ice crystalline glacier textures (Blue, Green, Purple, Red)
   */
  public static createBlackIceTexture(variant: 'blue' | 'green' | 'purple' | 'red' = 'blue'): THREE.CanvasTexture {
    const key = `black_ice_texture_hd_${variant}`;
    if (this.cache[key]) return this.cache[key];

    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d')!;

    // Rich R6 Siege Black Ice Palettes
    let baseHex1 = '#041c2c';
    let baseHex2 = '#0b3c5d';
    let highlightHex = '#328cc1';
    let crystalFrost = 'rgba(215, 248, 255, 0.65)';

    if (variant === 'green') {
      baseHex1 = '#022c22';
      baseHex2 = '#065f46';
      highlightHex = '#059669';
      crystalFrost = 'rgba(209, 250, 229, 0.65)';
    } else if (variant === 'purple') {
      baseHex1 = '#1e1b4b';
      baseHex2 = '#4c1d95';
      highlightHex = '#7c3aed';
      crystalFrost = 'rgba(237, 233, 254, 0.65)';
    } else if (variant === 'red') {
      baseHex1 = '#450a0a';
      baseHex2 = '#7f1d1d';
      highlightHex = '#dc2626';
      crystalFrost = 'rgba(254, 226, 226, 0.65)';
    }

    // 1. Unified seamless glacial depth background gradient
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0.0, '#ffffff'); // Frosted white crystal top
    grad.addColorStop(0.2, '#e0f7fc');
    grad.addColorStop(0.45, highlightHex);
    grad.addColorStop(0.75, baseHex2);
    grad.addColorStop(1.0, baseHex1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Large unified geometric crystal facets (seamless polygon network)
    for (let i = 0; i < 65; i++) {
      ctx.beginPath();
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const size = 80 + Math.random() * 180;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * size, y + (Math.random() - 0.5) * size);
      ctx.lineTo(x + (Math.random() - 0.5) * size, y + (Math.random() - 0.5) * size);
      ctx.lineTo(x + (Math.random() - 0.5) * size, y + (Math.random() - 0.5) * size);
      ctx.closePath();
      ctx.fillStyle = Math.random() > 0.4 ? 'rgba(255, 255, 255, 0.18)' : crystalFrost;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 3. Flowing glacier marble crystallization veins
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = Math.random() > 0.3 ? 'rgba(255, 255, 255, 0.6)' : crystalFrost;
      ctx.lineWidth = 1.2 + Math.random() * 4.5;
      ctx.beginPath();
      const sx = Math.random() * 1024;
      const sy = Math.random() * 1024;
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(
        sx + (Math.random() - 0.5) * 500,
        sy + (Math.random() - 0.5) * 500,
        sx + (Math.random() - 0.5) * 700,
        sy + (Math.random() - 0.5) * 700,
        sx + (Math.random() - 0.5) * 900,
        sy + (Math.random() - 0.5) * 900
      );
      ctx.stroke();
    }

    // 4. Sharp dark frost fracture network
    for (let i = 0; i < 45; i++) {
      ctx.strokeStyle = 'rgba(2, 8, 18, 0.8)';
      ctx.lineWidth = 1.0 + Math.random() * 2.8;
      ctx.beginPath();
      let px = Math.random() * 1024;
      let py = Math.random() * 1024;
      ctx.moveTo(px, py);
      for (let s = 0; s < 7; s++) {
        px += (Math.random() - 0.5) * 200;
        py += (Math.random() - 0.5) * 200;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 5. Crystalline diamond glitter sparkle dots
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = Math.random() > 0.25 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(180, 240, 255, 0.95)';
      const sz = 1 + Math.random() * 3.5;
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, sz, sz);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.cache[key] = tex;
    return tex;
  }
}
