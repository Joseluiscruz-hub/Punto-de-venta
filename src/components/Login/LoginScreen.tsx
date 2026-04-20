import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
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
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-slate-900 text-white p-4 rounded-2xl mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800">Acceso al Sistema</h1>
          <p className="text-slate-500 text-center mt-2 text-sm">
            Ingresa tus credenciales operativas. <br />
            <span className="text-xs bg-slate-100 p-1.5 rounded mt-2 inline-block text-slate-600 font-mono">
              Admin: admin / 1234 <br /> Caja: caja1 / 0000
            </span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
              placeholder="Ej. admin"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">PIN de Seguridad</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full text-center text-2xl tracking-[1em] p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-all font-mono"
              maxLength={4}
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username || !pin}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            {loading ? 'Verificando...' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
