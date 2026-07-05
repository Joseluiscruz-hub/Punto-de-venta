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
    <div className="login-shell min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4 py-8">
      <div className="absolute inset-0 z-0 opacity-70" />

      <div className="login-stage relative z-10 w-full animate-in fade-in zoom-in duration-500">
        <div className="login-card rounded-4xl overflow-hidden">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="hidden lg:flex flex-col justify-between p-10 xl:p-12 text-white brand-panel">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full bg-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em]">
                  <StoreIcon size={14} />
                  Punto de venta premium
                </div>
                <h1 className="mt-8 text-5xl font-black tracking-tight leading-none">
                  El Triunfo
                </h1>
                <p className="mt-4 max-w-md text-white/80 text-sm leading-6">
                  Acceso rápido, ventas ágiles y una interfaz pensada para trabajar todo el día sin fatiga visual.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
                {['POS', 'Inventario', 'Clientes'].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 xl:p-12 bg-(--ui-surface-solid)">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-18 h-18 bg-primary text-white rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20 mb-5">
                  <StoreIcon size={36} />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                  Bienvenido
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                  El Triunfo SaaS Retail System
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                <label className="text-label text-slate-400 ml-1">
                  Usuario
                </label>
                  <div className="relative group">
                    <Users
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors"
                      size={18}
                    />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="input-premium w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                      placeholder="ej. admin"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                <label className="text-label text-slate-400 ml-1">
                  PIN de Acceso
                </label>
                  <div className="relative group">
                    <ShieldCheck
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors"
                      size={18}
                    />
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••"
                      className="input-premium w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 font-bold tracking-[0.5em] text-xl text-slate-900 dark:text-white"
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
                  className="btn-primary w-full mt-4"
                >
                  {loading ? 'Verificando...' : 'Entrar al Sistema'}
                </button>
              </form>

              <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-label text-slate-400 mb-4">
                  Módulos Corporativos
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {['POS', 'ERP', 'CRM', 'BI'].map((mod) => (
                    <span
                      key={mod}
                      className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-caption text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                    >
                      {mod}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-6 text-white/40">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
