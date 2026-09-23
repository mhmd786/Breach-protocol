import React, { useState, useEffect } from 'react';
import { User, Lock, ShieldCheck, LogOut, Check, X, Sparkles, AlertCircle } from 'lucide-react';
import { RankedSystem } from '../game/RankedSystem';
import { SkinManager } from '../game/SkinShopData';
import { sound as audioSystem } from '../audio/SoundEngine';

interface AccountAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenownUpdated: (renown: number) => void;
}

interface UserAccount {
  username: string;
  renown: number;
  unlockedSkins: string[];
  equippedSkin: string;
  totalRP: number;
  redeemedCodes: string[];
}

export const AccountAuthModal: React.FC<AccountAuthModalProps> = ({
  isOpen,
  onClose,
  onRenownUpdated
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const activeAcc = localStorage.getItem('breach_protocol_active_account');
        if (activeAcc) {
          const parsed = JSON.parse(activeAcc);
          setCurrentUser(parsed);
        }
      } catch {}
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    const accountsKey = 'breach_protocol_accounts_db';
    let db: Record<string, UserAccount> = {};
    try {
      const stored = localStorage.getItem(accountsKey);
      if (stored) db = JSON.parse(stored);
    } catch {}

    if (mode === 'register') {
      if (db[cleanUser]) {
        setErrorMsg('Account username already exists! Please log in.');
        return;
      }
      const profile = RankedSystem.getProfile();
      const newAcc: UserAccount = {
        username: cleanUser,
        renown: profile.renown,
        unlockedSkins: SkinManager.getUnlockedSkins(),
        equippedSkin: SkinManager.getEquippedSkinId(),
        totalRP: profile.totalRP,
        redeemedCodes: []
      };
      db[cleanUser] = newAcc;
      try {
        localStorage.setItem(accountsKey, JSON.stringify(db));
        localStorage.setItem('breach_protocol_active_account', JSON.stringify(newAcc));
      } catch {}
      setCurrentUser(newAcc);
      setSuccessMsg(`Account "${cleanUser}" created successfully! Progress synced.`);
      audioSystem.secure();
    } else {
      // Login
      const acc = db[cleanUser];
      if (!acc) {
        ErrorMsg: 'Account not found. Please register first.';
        setErrorMsg('Account not found. Please register first.');
        return;
      }
      try {
        localStorage.setItem('breach_protocol_active_account', JSON.stringify(acc));
        // Sync local managers
        const currentRenown = RankedSystem.getProfile().renown;
        const diff = acc.renown - currentRenown;
        if (diff !== 0) {
          RankedSystem.addRenown(diff);
        }
        SkinManager.saveUnlockedSkins(acc.unlockedSkins);
        SkinManager.setEquippedSkinId(acc.equippedSkin);
        onRenownUpdated(acc.renown);
      } catch {}
      setCurrentUser(acc);
      setSuccessMsg(`Logged in as "${cleanUser}"! Progress loaded.`);
      audioSystem.roundWin();
    }
  };

  const handleSaveProgress = () => {
    if (!currentUser) return;
    const profile = RankedSystem.getProfile();
    const activeAcc: UserAccount = {
      username: currentUser.username,
      renown: profile.renown,
      unlockedSkins: SkinManager.getUnlockedSkins(),
      equippedSkin: SkinManager.getEquippedSkinId(),
      totalRP: profile.totalRP,
      redeemedCodes: currentUser.redeemedCodes || []
    };
    try {
      const accountsKey = 'breach_protocol_accounts_db';
      let db: Record<string, UserAccount> = {};
      const stored = localStorage.getItem(accountsKey);
      if (stored) db = JSON.parse(stored);
      db[currentUser.username] = activeAcc;
      localStorage.setItem(accountsKey, JSON.stringify(db));
      localStorage.setItem('breach_protocol_active_account', JSON.stringify(activeAcc));
    } catch {}
    setCurrentUser(activeAcc);
    setSuccessMsg('Progress successfully saved to cloud account profile!');
    audioSystem.secure();
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('breach_protocol_active_account');
    } catch {}
    setCurrentUser(null);
    setUsername('');
    setPassword('');
    setSuccessMsg('Logged out of active account.');
    audioSystem.woodSnap();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0a121c] border border-[#38bdf8]/40 rounded-2xl shadow-[0_0_50px_rgba(56,189,248,0.25)] p-6 text-white flex flex-col gap-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-[#1e3448] pb-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-wider text-[#7fd6ff] font-mono uppercase">
              TACTICAL OPERATOR ACCOUNT
            </h2>
            <p className="text-xs text-gray-400">
              Save your progress, stats, unlocked skins, and renown across sessions
            </p>
          </div>
        </div>

        {currentUser ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-[#111f2e] border border-cyan-500/30 flex flex-col gap-2 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">LOGGED IN AS</span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-xs border border-cyan-500/40 font-bold">ONLINE</span>
              </div>
              <div className="text-lg font-black text-amber-300 tracking-wider">
                👤 {currentUser.username}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div className="bg-[#0b141d] p-2 rounded border border-[#1e3448]">
                  <div className="text-gray-400 text-[10px]">RENOWN BALANCE</div>
                  <div className="text-amber-400 font-bold">{RankedSystem.getProfile().renown.toLocaleString()}</div>
                </div>
                <div className="bg-[#0b141d] p-2 rounded border border-[#1e3448]">
                  <div className="text-gray-400 text-[10px]">UNLOCKED SKINS</div>
                  <div className="text-cyan-300 font-bold">{SkinManager.getUnlockedSkins().length} items</div>
                </div>
              </div>
            </div>

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-300 font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSaveProgress}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black rounded-xl text-xs font-mono tracking-wider transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                SAVE PROGRESS
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-3 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-500/50 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                LOGOUT
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 bg-[#111f2e] p-1 rounded-xl border border-[#23455a]">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${mode === 'login' ? 'bg-[#38bdf8] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                LOGIN
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${mode === 'register' ? 'bg-[#38bdf8] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                REGISTER
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-300 font-bold tracking-wider">USERNAME</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setErrorMsg(null); }}
                  placeholder="e.g. OperatorDelta"
                  className="w-full bg-[#111f2e] border border-[#23455a] focus:border-[#38bdf8] rounded-xl px-4 py-3 text-sm font-mono text-white outline-none transition-all placeholder:text-gray-600"
                  autoFocus
                />
                <User className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-300 font-bold tracking-wider">PASSWORD</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(null); }}
                  placeholder="••••••••"
                  className="w-full bg-[#111f2e] border border-[#23455a] focus:border-[#38bdf8] rounded-xl px-4 py-3 text-sm font-mono text-white outline-none transition-all placeholder:text-gray-600"
                />
                <Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-300 font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-300 font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="mt-2 w-full py-3 bg-gradient-to-r from-[#38bdf8] to-blue-600 hover:from-[#2ca8e0] hover:to-blue-500 text-black font-black rounded-xl text-xs font-mono tracking-wider transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {mode === 'login' ? 'LOGIN TO ACCOUNT' : 'CREATE ACCOUNT & SYNC'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
