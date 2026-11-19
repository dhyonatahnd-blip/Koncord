import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, KeyRound, Lock, Mail, MonitorUp, RefreshCw, ShieldCheck, User as UserIcon, Video } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

type AuthMode = 'login' | 'register' | 'forgot';

interface AuthViewProps {
  unverifiedUser: User | null;
  onVerifiedRefresh: () => Promise<void>;
  onEnterInstantMode: (displayName: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  unverifiedUser,
  onVerifiedRefresh,
  onEnterInstantMode,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
      return `Domínio (${host}) ainda não autorizado no Firebase Authentication. Adicione-o em Firebase Console → Authentication → Settings → Authorized domains, ou entre imediatamente pelo Modo Instantâneo acima.`;
    }
    if (code === 'auth/operation-not-allowed') {
      return 'O login por E-mail e Senha ainda não foi ativado no Firebase Console (Authentication → Sign-in method → Email/Password). Use "Entrar com Google" para acesso imediato ou ative o provedor no console.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'E-mail ou senha inválidos.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.';
    }
    if (code === 'auth/weak-password') {
      return 'A senha deve conter pelo menos 6 caracteres.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Janela de autenticação fechada antes da conclusão.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Muitas tentativas seguidas. Aguarde alguns instantes.';
    }
    return err instanceof Error ? err.message : 'Erro ao autenticar. Tente novamente.';
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        if (username.trim()) {
          sessionStorage.setItem('vesper_pending_username', username.trim());
        }
        await sendEmailVerification(cred.user);
        setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail.');
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo('Enviamos instruções de redefinição de senha para o seu e-mail.');
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  if (unverifiedUser) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 glass-elevated p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 mb-5">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Confirme seu e-mail para continuar</h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            Para proteger a sua conta e liberar o acesso às comunidades em tempo real, confirme o endereço{' '}
            <span className="text-zinc-200 font-medium">{unverifiedUser.email}</span> clicando no link enviado.
          </p>
          {info && (
            <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-xs text-emerald-300">
              {info}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-xs text-rose-300">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onVerifiedRefresh();
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Já confirmei meu e-mail
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await sendEmailVerification(unverifiedUser);
                  setInfo('Novo e-mail de verificação enviado.');
                } catch (err) {
                  setError(mapAuthError(err));
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reenviar verificação
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Sair e entrar com outra conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Subtle architectural ambient gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(91,106,240,0.12),_transparent_55%)]"
      />

      <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-white/10 glass-panel shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* Left Editorial / Product Showcase Column */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-gradient-to-b from-[#13151C] to-[#0D0E13] border-b lg:border-b-0 lg:border-r border-white/8">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <span className="font-display font-bold text-lg text-white">V</span>
              </div>
              <span className="font-display text-xl font-semibold tracking-tight text-white">Vesper</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-[1.15] mb-4">
              Comunicação fluida para comunidades exigentes.
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md">
              Salas de texto em tempo real, chamadas de voz e vídeo multi-participante e compartilhamento de tela em alta definição com modo cinema.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 shrink-0">
                <MonitorUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-100">Compartilhamento de tela nativo WebRTC</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Transmita tela inteira, janela ou guia com áudio do sistema e modo Tela Cheia sem distorções.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-100">Salas de voz e vídeo com detecção ativa</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Controle individual de volume, câmera, microfone e indicador visual de fala em tempo real.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-100">Arquitetura autenticada e protegida</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Mensagens, comunidades e arquivos sincronizados com regras rígidas de segurança.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Authentication Form Column */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-center bg-[#0D0E12]/90">
          {/* Instant Access Without Account or Database */}
          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-400/25">
            <div className="text-xs font-semibold text-indigo-200 mb-1">
              Acesso Rápido — Sem Conta e Sem Banco de Dados
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
              Entre agora em tempo real para chat, voz, vídeo e compartilhamento de tela usando apenas o servidor ativo.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                maxLength={48}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onEnterInstantMode(guestName.trim() || 'Visitante');
                  }
                }}
                placeholder="Seu apelido (opcional)"
                className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => onEnterInstantMode(guestName.trim() || 'Visitante')}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                Entrar Agora
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/8 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                mode === 'login' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                mode === 'register' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Criar Conta
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                mode === 'forgot' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Recuperar Senha
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors shadow-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.54-5.17 3.54-8.97Z"
              />
              <path
                fill="#34A853"
                d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96h-3.98v3.14C3.515 21.3 7.565 24 12.255 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.535 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62h-3.98a11.74 11.74 0 0 0 0 10.76l3.98-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0 7.565 0 3.515 2.7 1.555 6.62l3.98 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            Continuar com Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-zinc-500">ou com e-mail</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-xs text-rose-300 leading-relaxed">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-xs text-emerald-300 leading-relaxed">
              {info}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome de exibição</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      maxLength={48}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Marina Silva"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Usuário (@)</label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="marina.silva"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {mode === 'login' && (
                <>
                  Entrar na conta
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
              {mode === 'register' && (
                <>
                  Criar conta e verificar e-mail
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
              {mode === 'forgot' && (
                <>
                  Enviar link de recuperação
                  <KeyRound className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
