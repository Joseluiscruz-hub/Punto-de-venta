import React, { useState } from 'react';
import { Store as StoreIcon, Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { errorMessage } from '../utils/helpers';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, pin);
    } catch (error) {
      setError(errorMessage(error, 'Error al iniciar sesión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden font-sans">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] p-4 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-slate-800 rounded-[32px] shadow-2xl shadow-black/20 overflow-hidden">
          <div className="p-8 sm:p-12">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center shadow-xl shadow-primary/30 mb-6">
                <StoreIcon size={40} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                Bienvenido
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                El Triunfo SaaS Retail System
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Usuario
                </label>
                <div className="relative group">
                  <Users
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-light transition-colors"
                    size={18}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-light focus:bg-white dark:focus:bg-slate-900 rounded-2xl outline-none transition-all font-bold text-slate-900 dark:text-white"
                    placeholder="ej. admin"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  PIN de Acceso
                </label>
                <div className="relative group">
                  <ShieldCheck
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-light transition-colors"
                    size={18}
                  />
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-light focus:bg-white dark:focus:bg-slate-900 rounded-2xl outline-none transition-all font-bold tracking-[0.5em] text-xl text-slate-900 dark:text-white"
                    maxLength={4}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-error/10 border border-error/20 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={18} className="text-error" />
                  <p className="text-error text-xs font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary hover:bg-primary-light text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
              >
                {loading ? 'Verificando...' : 'Entrar al Sistema'}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                Módulos Corporativos
              </p>
              <div className="flex justify-center gap-4">
                {['POS', 'ERP', 'CRM', 'BI'].map((mod) => (
                  <span
                    key={mod}
                    className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 text-white/40">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
