import React from 'react';
import { sound } from '../audio/SoundEngine';
import { Volume2, Keyboard, Shield, HelpCircle, X } from 'lucide-react';

interface PauseMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToRoster: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ isOpen, onClose, onReturnToRoster }) => {
  if (!isOpen) return null;

  return (
    <div id="pause-modal" className="absolute inset-0 bg-black/85 flex items-center justify-center p-6 z-50 font-mono text-white select-none backdrop-blur-sm pointer-events-auto">
      <div className="bg-zinc-950 border-2 border-zinc-800 rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-400 hover:text-white cursor-pointer"
        >
          <X size={22} />
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-6">
          <Shield className="text-amber-500" size={24} />
          <div>
            <h2 className="text-xl font-black tracking-widest text-amber-500">BREACH PROTOCOL</h2>
            <span className="text-xs text-zinc-400">TACTICAL CONTROLS & FIELD MANUAL</span>
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800">
            <span className="text-amber-400 font-bold block mb-3">INFANTRY CONTROLS</span>
            <div className="flex flex-col gap-2 text-zinc-300">
              <div className="flex justify-between"><span className="text-zinc-400">MOVE (A=LEFT, D=RIGHT)</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">W A S D</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">TACTICAL LEAN</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">Q / E</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">STANCE (CROUCH)</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">C</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">SPRINT</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">SHIFT</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">ADS OPTIC ZOOM</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">RIGHT MOUSE</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">FIRE WEAPON</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">LEFT MOUSE</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">RELOAD</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">R</span></div>
            </div>
          </div>

          <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800">
            <span className="text-blue-400 font-bold block mb-3">TACTICAL INTERACTIONS</span>
            <div className="flex flex-col gap-2 text-zinc-300">
              <div className="flex justify-between"><span className="text-zinc-400">CONTEXT ACTION / INTERACT</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">F</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">SPECIALIST ABILITY</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">F / BUTTON</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">ATTACH / DETACH RAPPEL</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">F / SPACE</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">RAPPEL WINDOW ENTRY</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">F NEAR WINDOW</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">RECON DRONE / CCTV FEED</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">5 / BUTTON</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">DRONE HOP</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">SPACE</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">PLANT / DEFUSE OBJECTIVE</span> <span className="font-bold text-white bg-black px-1.5 py-0.5 rounded">HOLD F</span></div>
            </div>
          </div>
        </div>

        {/* Audio Volume Controller */}
        <div className="mt-6 bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="text-emerald-400" size={20} />
            <div>
              <span className="text-xs font-bold block">PROCEDURAL TACTICAL AUDIO</span>
              <span className="text-[10px] text-zinc-400">Web Audio synthesis for gunshots, spatial pans, footsteps, and explosions</span>
            </div>
          </div>
          <button
            onClick={() => sound.playRadioPing(true)}
            className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-xs text-emerald-400 font-bold cursor-pointer"
          >
            TEST AUDIO PING
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 flex justify-between items-center pt-4 border-t border-zinc-800">
          <button
            onClick={onReturnToRoster}
            className="bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700 px-5 py-2 rounded-lg text-xs font-bold cursor-pointer"
          >
            RETURN TO MAIN MENU
          </button>

          <button
            onClick={onClose}
            className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-2 rounded-lg text-xs font-black cursor-pointer shadow"
          >
            RESUME OPERATION (ESC)
          </button>
        </div>
      </div>
    </div>
  );
};
