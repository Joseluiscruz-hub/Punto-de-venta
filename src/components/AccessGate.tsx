import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, LockKeyhole } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const STORAGE_KEY = 'el-triunfo-demo-unlock';

function expectedCode(): string {
  return String(import.meta.env.VITE_DEMO_ACCESS_CODE ?? '').trim();
}

function isUnlocked(code: string): boolean {
  if (!code) return true;
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_KEY) === code;
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const code = useMemo(expectedCode, []);
  const [unlocked, setUnlocked] = useState(() => isUnlocked(code));
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const logoSrc = `${import.meta.env.BASE_URL}el-triunfo-logo.webp`;

  if (!code || unlocked) {
    return children;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim() === code) {
      sessionStorage.setItem(STORAGE_KEY, code);
      setError(null);
      setUnlocked(true);
      return;
    }
    setError('Código incorrecto. El acceso de prueba ya no está disponible.');
  };

  return (
    <main className="login-shell animate-fadeIn">
      <section className="login-brand" aria-label="El Triunfo Punto de Venta">
        <img
          src={logoSrc}
          alt="El Triunfo Punto de Venta"
          className="login-brand-logo"
          decoding="async"
        />
        <div className="login-brand-footer">
          <span>Acceso restringido</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </section>

      <section className="login-access">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="login-form-shell">
          <img src={logoSrc} alt="" className="login-mobile-logo lg:hidden" decoding="async" />
          <p className="section-kicker">Demo cerrado</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">
            Acceso restringido
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Esta publicación sigue activa, pero el acceso de prueba terminó. Ingresa el código del
            propietario.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="demo-access-code" className="form-label">
                Código de acceso
              </label>
              <div className="relative">
                <LockKeyhole
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="demo-access-code"
                  name="demo-access-code"
                  type="password"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="input-premium w-full py-3.5 pl-11 pr-4"
                  placeholder="Código"
                  autoComplete="off"
                  autoFocus
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

            <button type="submit" className="btn-primary h-12 w-full">
              Continuar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
