import React, { useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, Sparkles, X, Gift } from 'lucide-react';
import { RankedSystem } from '../game/RankedSystem';
import { SkinManager } from '../game/SkinShopData';
import { sound as audioSystem } from '../audio/SoundEngine';

interface CodeRedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenownUpdated: (newRenown: number) => void;
}

export const CodeRedeemModal: React.FC<CodeRedeemModalProps> = ({
  isOpen,
  onClose,
  onRenownUpdated,
}) => {
  const [code, setCode] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toLowerCase();

    if (!cleanCode) return;

    let redeemedList: string[] = [];
    try {
      const stored = localStorage.getItem('breach_protocol_redeemed_codes_v1');
      if (stored) redeemedList = JSON.parse(stored);
    } catch {}

    if (redeemedList.includes(cleanCode)) {
      setStatus('error');
      setMessage('This code has already been redeemed on this account.');
      audioSystem.roundLoss();
      return;
    }

    if (cleanCode === 'devkey' || cleanCode === 'master' || cleanCode === 'godmode' || cleanCode === 'unlimited') {
      // Secret developer cheat code: Give Infinite Renown and unlock exclusive packs!
      const newRenown = RankedSystem.setInfiniteRenown();
      SkinManager.unlockAllSkins();
      SkinManager.addDeltaPacks(20);
      onRenownUpdated(newRenown);

      redeemedList.push(cleanCode);
      try { localStorage.setItem('breach_protocol_redeemed_codes_v1', JSON.stringify(redeemedList)); } catch {}

      setStatus('success');
      setMessage('👑 MASTER ACCESS UNLOCKED: 999,999,999 INFINITE RENOWN GRANTED + ALL LEGENDARY SKINS & 20 DELTA PACKS!');
      audioSystem.secure();
    } else if (cleanCode === 'breach2026' || cleanCode === 'tactical' || cleanCode === 'operator') {
      const newRenown = RankedSystem.addRenown(10000);
      SkinManager.addDeltaPacks(5);
      onRenownUpdated(newRenown);

      redeemedList.push(cleanCode);
      try { localStorage.setItem('breach_protocol_redeemed_codes_v1', JSON.stringify(redeemedList)); } catch {}

      setStatus('success');
      setMessage('PROMO CODE REDEEMED: +10,000 Renown & 5 Delta Packs added!');
      audioSystem.roundWin();
    } else {
      setStatus('error');
      setMessage('Invalid or expired promo code. Please double-check spelling.');
      audioSystem.roundLoss();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0a121c] border border-[#38bdf8]/40 rounded-2xl shadow-[0_0_50px_rgba(56,189,248,0.2)] p-6 text-white flex flex-col gap-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#1e3448] pb-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-wider text-[#7fd6ff] font-mono uppercase">
              TACTICAL CODE REDEMPTION
            </h2>
            <p className="text-xs text-gray-400">
              Enter secret promo codes, developer keys, or creator passcodes
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-gray-300 font-bold tracking-wider">
              ENTER PASSCODE
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setStatus('idle');
                }}
                placeholder="e.g. BREACH2026"
                className="w-full bg-[#111f2e] border border-[#23455a] focus:border-[#38bdf8] rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-amber-300 outline-none transition-all placeholder:text-gray-600 uppercase font-black"
                autoFocus
              />
              <Gift className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Feedback status message */}
          {status === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-start gap-2.5 text-xs text-emerald-300 font-mono animate-in zoom-in-95 duration-150">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <b className="font-bold text-emerald-200">CODE SUCCESSFUL!</b>
                <p className="mt-0.5 text-emerald-300/90 leading-relaxed">{message}</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 flex items-center gap-2.5 text-xs text-rose-300 font-mono animate-in zoom-in-95 duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#142332] hover:bg-[#1a2e42] text-gray-300 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={!code.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black rounded-xl text-xs font-mono tracking-wider transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              REDEEM CODE
            </button>
          </div>
        </form>

        <div className="bg-[#0e1925]/60 border border-[#1b3145] rounded-xl p-3 text-[11px] text-gray-400 font-mono flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Tip: Codes are case-insensitive. Try creator & developer passcodes!</span>
        </div>
      </div>
    </div>
  );
};
