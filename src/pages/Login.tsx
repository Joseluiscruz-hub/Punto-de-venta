import React, { useState } from 'react';
import { AlertCircle, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';

export function LoginScreen() {
  const { login, isLoading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const logoSrc = `${import.meta.env.BASE_URL}el-triunfo-logo.png.png`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await login(username, pin);
  };

  return (
    <main className="login-shell animate-fadeIn">
      <section className="login-brand" aria-label="El Triunfo Punto de Venta">
        <img src={logoSrc} alt="El Triunfo Punto de Venta" className="login-brand-logo" />
        <div className="login-brand-footer">
          <span>Sistema operativo de tienda</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </section>

      <section className="login-access">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="login-form-shell">
          <img src={logoSrc} alt="" className="login-mobile-logo lg:hidden" />
          <p className="section-kicker">Acceso seguro</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ingresa tus credenciales asignadas.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="form-label">
                Usuario
              </label>
              <div className="relative">
                <UserRound
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="input-premium w-full py-3.5 pl-11 pr-4"
                  placeholder="Nombre de usuario"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="pin" className="form-label">
                PIN
              </label>
              <div className="relative">
                <LockKeyhole
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                  className="input-premium w-full py-3.5 pl-11 pr-4 text-lg font-bold tabular-nums"
                  placeholder="4 a 12 dígitos"
                  autoComplete="current-password"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={12}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="btn-primary h-12 w-full">
              {isLoading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Acceso exclusivo para personal autorizado
          </p>
        </div>
      </section>
    </main>
  );
}
