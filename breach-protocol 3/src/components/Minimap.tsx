import React, { useEffect, useRef } from 'react';

interface MinimapProps {
  engine: any;
}

export const Minimap: React.FC<MinimapProps> = ({ engine }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const localPlayer = engine?.player;
  if (!localPlayer) return null;

  // Determine current floor: Y-height of camera/eyes is 1.7 on 1F, 4.9 on 2F (base is 3.2)
  const playerY = localPlayer.pos.y;
  const isFloor2 = playerY >= 4.2;
  const floorName = isFloor2 ? '2F' : '1F';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background with translucent dark navy grid aesthetic
    ctx.fillStyle = 'rgba(10, 18, 30, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(74, 200, 255, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Coordinate conversion: Map [-24, 24] space to [0, w] canvas coordinates
    const mapRange = 24; // Meters from center
    const toCanvasX = (worldX: number) => {
      return (worldX / (mapRange * 2) + 0.5) * w;
    };
    const toCanvasY = (worldZ: number) => {
      return (worldZ / (mapRange * 2) + 0.5) * h;
    };

    // Draw Map Outer Bounds / Footprint
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(toCanvasX(-18), toCanvasY(-18), toCanvasX(18) - toCanvasX(-18), toCanvasY(18) - toCanvasY(-18));

    // Draw Doors and Windows from barricades
    if (engine.barricades) {
      engine.barricades.forEach((dw: any) => {
        // Check floor matching
        const dwFloor2 = dw.floor === 2;
        if (dwFloor2 !== isFloor2) return;

        const dwX = toCanvasX(dw.position.x);
        const dwY = toCanvasY(dw.position.z);

        ctx.fillStyle = dw.isBreached ? '#10b981' : '#d97706';
        ctx.beginPath();
        ctx.arc(dwX, dwY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Label doors/windows with subtle border
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Draw Walls from colliders list
    if (engine.colliders) {
      engine.colliders.forEach((c: any) => {
        // Skip barricades which are drawn separately
        if (c.name) return;

        // Filter by floor
        const isOnFloor2 = c.minY >= 2.0;
        if (isFloor2 !== isOnFloor2) return;

        // Convert coordinates
        const minX = toCanvasX(c.minX);
        const maxX = toCanvasX(c.maxX);
        const minZ = toCanvasY(c.minZ);
        const maxZ = toCanvasY(c.maxZ);

        // Draw the wall rectangle
        ctx.fillStyle = 'rgba(74, 200, 255, 0.35)'; // Cool semi-transparent blue for walls
        ctx.fillRect(minX, minZ, Math.max(1.5, maxX - minX), Math.max(1.5, maxZ - minZ));
      });
    }

    // Draw Objective Site B (Site B is on 2F, Site A is on 1F or center)
    if (engine.objectivePos) {
      const objFloor2 = engine.objectivePos.y >= 3.0;
      if (objFloor2 === isFloor2) {
        const ox = toCanvasX(engine.objectivePos.x);
        const oy = toCanvasY(engine.objectivePos.z);

        // Pulse circle for objectives
        const pulseRadius = 8 + Math.sin(Date.now() * 0.005) * 2;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.beginPath();
        ctx.arc(ox, oy, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Main badge
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', ox, oy);
      }
    }

    // Draw Static/Suction Security Cameras
    if (engine.securityCameras) {
      engine.securityCameras.forEach((cam: any) => {
        const camFloor2 = cam.pos.y >= 3.0;
        if (camFloor2 !== isFloor2) return;

        const cx = toCanvasX(cam.pos.x);
        const cy = toCanvasY(cam.pos.z);

        ctx.fillStyle = cam.isDestroyed ? '#ef4444' : '#10b981';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        // Mini lens indicator pointing in yaw direction
        if (!cam.isDestroyed && cam.rot) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(
            cx - Math.sin(cam.rot.yaw) * 8,
            cy - Math.cos(cam.rot.yaw) * 8
          );
          ctx.stroke();
        }
      });
    }

    // Draw Other Players (Teammates & Spotted Enemies)
    if (engine.bots) {
      engine.bots.forEach((b: any) => {
        if (!b.alive) return;

        const bFloor2 = b.mesh.position.y >= 2.0;
        if (bFloor2 !== isFloor2) return;

        const bx = toCanvasX(b.mesh.position.x);
        const by = toCanvasY(b.mesh.position.z);

        const isTeammate = b.side === localPlayer.side;
        if (isTeammate) {
          // Draw teammate
          ctx.fillStyle = '#3b82f6'; // Friendly blue
          ctx.beginPath();
          ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Direction line
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(
            bx - Math.sin(b.mesh.rotation.y) * 7,
            by - Math.cos(b.mesh.rotation.y) * 7
          );
          ctx.stroke();
        }
      });
    }

    // Draw Spotted Enemies (red flashing diamonds)
    if (engine.spottedEnemies) {
      engine.spottedEnemies.forEach((info: any) => {
        const eFloor2 = info.y >= 3.0;
        if (eFloor2 !== isFloor2) return;

        const ex = toCanvasX(info.x);
        const ey = toCanvasY(info.z);

        // Flashing effect
        const flash = Math.floor(Date.now() / 200) % 2 === 0;
        ctx.fillStyle = flash ? '#ef4444' : '#b91c1c';

        ctx.beginPath();
        ctx.moveTo(ex, ey - 6);
        ctx.lineTo(ex + 6, ey);
        ctx.lineTo(ex, ey + 6);
        ctx.lineTo(ex - 6, ey);
        ctx.closePath();
        ctx.fill();

        // Enemy '!' text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', ex, ey);
      });
    }

    // Draw Local Player Arrow
    const lpx = toCanvasX(localPlayer.pos.x);
    const lpy = toCanvasY(localPlayer.pos.z);

    // Subtle look cone for local player
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(lpx, lpy);
    const coneAngle = 0.5; // Field of view visual angle
    ctx.arc(
      lpx,
      lpy,
      25,
      localPlayer.yaw - coneAngle - Math.PI/2,
      localPlayer.yaw + coneAngle - Math.PI/2
    );
    ctx.closePath();
    ctx.fill();

    // Player sharp triangle pointer
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;

    ctx.save();
    ctx.translate(lpx, lpy);
    ctx.rotate(localPlayer.yaw); // Rotation facing towards look angle

    ctx.beginPath();
    ctx.moveTo(0, -7); // Nose of arrow
    ctx.lineTo(-5, 5); // Rear left
    ctx.lineTo(5, 5);  // Rear right
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

  }, [engine, localPlayer, isFloor2]);

  return (
    <div 
      id="tactical-minimap" 
      className="absolute right-5 top-16 bg-black/75 border border-slate-800 p-2.5 rounded-xl shadow-2xl backdrop-blur-md select-none pointer-events-auto"
    >
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono font-bold tracking-wider mb-1.5 uppercase">
        <span>🛰️ SURVEILLANCE MAP</span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${isFloor2 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
          {floorName}
        </span>
      </div>
      <canvas 
        ref={canvasRef} 
        width={170} 
        height={170} 
        className="rounded-lg border border-slate-900 bg-slate-950/80"
      />
    </div>
  );
};
