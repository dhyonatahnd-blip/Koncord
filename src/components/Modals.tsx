import React, { useState } from 'react';
import {
  Ban,
  Bell,
  Camera,
  Check,
  Copy,
  Hash,
  LogOut,
  MessageSquare,
  Shield,
  ShieldOff,
  UserPlus,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import {
  CategoryDoc,
  ChannelDoc,
  ChannelType,
  NotificationItem,
  PresenceStatus,
  ServerDoc,
  ServerRole,
  UserPrivate,
  UserPublic,
} from '../types';
import { FIELD_LIMITS, fileToCompressedDataUrl } from '../lib/validation';
import { Avatar, presenceLabel } from './Avatar';

const ModalFrame: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, children }) => (
  <div
    onClick={onClose}
    className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-lg rounded-2xl border border-white/12 glass-elevated shadow-2xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

export const UserSettingsModal: React.FC<{
  publicProfile: UserPublic;
  privateProfile: UserPrivate;
  onClose: () => void;
  onSave: (updates: {
    displayName: string;
    username: string;
    bio: string;
    customStatus: string;
    presence: PresenceStatus;
    avatarDataUrl: string;
    notificationsEnabled: boolean;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
}> = ({ publicProfile, privateProfile, onClose, onSave, onLogout }) => {
  const [displayName, setDisplayName] = useState(publicProfile.displayName);
  const [username, setUsername] = useState(publicProfile.username);
  const [bio, setBio] = useState(publicProfile.bio);
  const [customStatus, setCustomStatus] = useState(publicProfile.customStatus);
  const [presence, setPresence] = useState<PresenceStatus>(publicProfile.presence);
  const [avatarDataUrl, setAvatarDataUrl] = useState(publicProfile.avatarDataUrl);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    privateProfile.notificationsEnabled
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const res = await fileToCompressedDataUrl(file, FIELD_LIMITS.AVATAR_DATA_URL_MAX, 512);
      setAvatarDataUrl(res.dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        displayName,
        username,
        bio,
        customStatus,
        presence,
        avatarDataUrl,
        notificationsEnabled,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Configurações da Conta"
      subtitle={`Conectado como ${privateProfile.email}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Avatar name={displayName || 'U'} src={avatarDataUrl} size="xl" presence={presence} />
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-white cursor-pointer transition-colors">
              <Camera className="w-3.5 h-3.5" />
              Alterar foto de perfil
              <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
            </label>
            <p className="text-[11px] text-zinc-500">JPG, PNG ou WebP redimensionado automaticamente.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome de exibição</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Usuário (@)</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.USERNAME_MAX}
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
              }
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Status personalizado</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.CUSTOM_STATUS_MAX}
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="Ex: Em reunião de design"
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Presença</label>
            <select
              value={presence}
              onChange={(e) => setPresence(e.target.value as PresenceStatus)}
              className="w-full px-3 py-2 rounded-xl bg-[#151720] border border-white/10 text-sm text-white"
            >
              <option value="online">Disponível</option>
              <option value="idle">Ausente</option>
              <option value="dnd">Ocupado</option>
              <option value="invisible">Invisível</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Biografia</label>
          <textarea
            rows={3}
            maxLength={FIELD_LIMITS.BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white resize-none"
          />
        </div>

        <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 cursor-pointer">
          <span className="text-xs text-zinc-200">Receber alertas de notificações em tempo real</span>
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="accent-indigo-500 w-4 h-4"
          />
        </label>

        <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/6 text-[11px] text-zinc-400 leading-relaxed">
          Privacidade e RGPD (União Europeia): áudio, câmera e compartilhamento de tela são transmitidos em tempo real apenas aos participantes conectados na sala, sem gravação automática em servidor.
        </div>

        <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/8">
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold"
            >
              {busy ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </form>
    </ModalFrame>
  );
};

export const ParticipantProfileModal: React.FC<{
  user: UserPublic;
  roleInServer?: ServerRole;
  currentUserUid: string;
  viewerRoleInServer?: ServerRole;
  isFriend: boolean;
  isBlocked: boolean;
  onClose: () => void;
  onSendDm: () => void;
  onAddFriend: () => Promise<void>;
  onToggleBlock: () => Promise<void>;
  onToggleAdminRole?: (nextRole: 'admin' | 'member') => Promise<void>;
}> = ({
  user,
  roleInServer,
  currentUserUid,
  viewerRoleInServer,
  isFriend,
  isBlocked,
  onClose,
  onSendDm,
  onAddFriend,
  onToggleBlock,
  onToggleAdminRole,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const isSelf = user.uid === currentUserUid;

  return (
    <ModalFrame title={user.displayName} subtitle={`@${user.username}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.displayName} src={user.avatarDataUrl} size="xl" presence={user.presence} />
          <div className="min-w-0">
            <div className="text-base font-semibold text-white">{user.displayName}</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {presenceLabel(user.presence)}
              {user.customStatus ? ` · ${user.customStatus}` : ''}
            </div>
            {roleInServer && (
              <div className="text-xs text-indigo-300 mt-1">
                Cargo:{' '}
                {roleInServer === 'owner'
                  ? 'Proprietário'
                  : roleInServer === 'admin'
                  ? 'Administrador'
                  : 'Membro'}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
          <div className="text-[11px] font-medium text-zinc-500 mb-1">Biografia</div>
          <p className="text-xs text-zinc-200 leading-relaxed">
            {user.bio || 'Este participante ainda não adicionou uma biografia.'}
          </p>
        </div>

        {feedback && (
          <div className="px-3 py-2 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-xs text-indigo-200">
            {feedback}
          </div>
        )}

        {!isSelf && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSendDm();
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Mensagem Direta
            </button>

            {!isFriend && !isBlocked && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onAddFriend();
                    setFeedback('Solicitação de amizade enviada.');
                  } catch (err) {
                    setFeedback(err instanceof Error ? err.message : 'Erro ao enviar solicitação.');
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-white flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Adicionar Amigo
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                await onToggleBlock();
                setFeedback(isBlocked ? 'Usuário desbloqueado.' : 'Usuário bloqueado.');
              }}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs text-zinc-300 hover:text-rose-200 flex items-center gap-1.5"
            >
              {isBlocked ? <ShieldOff className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {isBlocked ? 'Desbloquear' : 'Bloquear'}
            </button>

            {viewerRoleInServer === 'owner' && roleInServer !== 'owner' && onToggleAdminRole && (
              <button
                type="button"
                onClick={async () => {
                  const next = roleInServer === 'admin' ? 'member' : 'admin';
                  await onToggleAdminRole(next);
                  setFeedback(
                    next === 'admin' ? 'Promovido a Administrador.' : 'Alterado para Membro.'
                  );
                }}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-200 flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                {roleInServer === 'admin' ? 'Remover Admin' : 'Promover a Admin'}
              </button>
            )}
          </div>
        )}
      </div>
    </ModalFrame>
  );
};

export const CreateServerModal: React.FC<{
  onClose: () => void;
  onCreate: (data: { name: string; description: string; iconColor: string }) => Promise<void>;
}> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconColor, setIconColor] = useState('#5B6AF0');
  const [busy, setBusy] = useState(false);

  const colors = ['#5B6AF0', '#38BDF8', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];

  return (
    <ModalFrame
      title="Criar Nova Comunidade"
      subtitle="Configure seu servidor com canais de texto, voz e vídeo."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          try {
            await onCreate({ name: name.trim(), description: description.trim(), iconColor });
            onClose();
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome do servidor</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.SERVER_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Equipe Produto & Design"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Descrição</label>
          <input
            type="text"
            maxLength={FIELD_LIMITS.SERVER_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Espaço para alinhamentos, chamadas e compartilhamento de tela"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">Cor do emblema</label>
          <div className="flex items-center gap-2.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setIconColor(c)}
                style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${
                  iconColor === c ? 'ring-2 ring-white scale-110' : 'opacity-75 hover:opacity-100'
                }`}
              >
                {iconColor === c && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold"
          >
            {busy ? 'Criando...' : 'Criar Servidor'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
};

export const JoinServerModal: React.FC<{
  onClose: () => void;
  onJoin: (inviteCode: string) => Promise<void>;
}> = ({ onClose, onJoin }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalFrame
      title="Entrar em uma Comunidade"
      subtitle="Informe o código de convite compartilhado pelo administrador."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!code.trim() || busy) return;
          setBusy(true);
          setError(null);
          try {
            await onJoin(code.trim());
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Convite inválido.');
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Código do convite</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EX: A7K9M2P4"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-mono text-white uppercase"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold"
          >
            {busy ? 'Entrando...' : 'Entrar no Servidor'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
};

export const ServerSettingsModal: React.FC<{
  server: ServerDoc;
  friends: UserPublic[];
  onClose: () => void;
  onSave: (updates: { name: string; description: string; iconDataUrl: string }) => Promise<void>;
  onInviteFriend: (friendUid: string) => Promise<void>;
}> = ({ server, friends, onClose, onSave, onInviteFriend }) => {
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description);
  const [iconDataUrl, setIconDataUrl] = useState(server.iconDataUrl);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invitedUids, setInvitedUids] = useState<Record<string, boolean>>({});

  const handleIconPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const processed = await fileToCompressedDataUrl(file, FIELD_LIMITS.AVATAR_DATA_URL_MAX, 512);
    setIconDataUrl(processed.dataUrl);
  };

  return (
    <ModalFrame title="Configurações da Comunidade" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-400">Código de convite do servidor</div>
            <div className="font-mono text-base font-semibold text-white mt-0.5">
              {server.inviteCode}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(server.inviteCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar código'}
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSave({ name, description, iconDataUrl });
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center font-display font-bold text-white border border-white/10"
              style={{ backgroundColor: server.iconColor }}
            >
              {iconDataUrl ? (
                <img src={iconDataUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                server.iconInitials
              )}
            </div>
            <label className="px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-white cursor-pointer">
              Alterar ícone
              <input type="file" accept="image/*" onChange={handleIconPick} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome</label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.SERVER_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.SERVER_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
            />
          </div>

          {friends.length > 0 && (
            <div className="pt-2 border-t border-white/8">
              <div className="text-xs font-medium text-zinc-400 mb-2">Convidar amigos diretamente</div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {friends.map((f) => (
                  <div
                    key={f.uid}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={f.displayName} src={f.avatarDataUrl} size="xs" />
                      <span className="text-xs text-zinc-200 truncate">{f.displayName}</span>
                    </div>
                    <button
                      type="button"
                      disabled={invitedUids[f.uid]}
                      onClick={async () => {
                        await onInviteFriend(f.uid);
                        setInvitedUids((p) => ({ ...p, [f.uid]: true }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200 text-xs disabled:opacity-50"
                    >
                      {invitedUids[f.uid] ? 'Enviado' : 'Convidar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </ModalFrame>
  );
};

export const CategoryModal: React.FC<{
  initial?: CategoryDoc | null;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}> = ({ initial, onClose, onSubmit }) => {
  const [name, setName] = useState(initial?.name || '');
  const [busy, setBusy] = useState(false);

  return (
    <ModalFrame title={initial ? 'Editar Categoria' : 'Nova Categoria'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          try {
            await onSubmit(name.trim());
            onClose();
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Nome da categoria</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.CATEGORY_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Projetos"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-semibold">
            Salvar
          </button>
        </div>
      </form>
    </ModalFrame>
  );
};

export const ChannelModal: React.FC<{
  initial?: ChannelDoc | null;
  categories: CategoryDoc[];
  defaultCategoryId: string;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    topic: string;
    type: ChannelType;
    categoryId: string;
  }) => Promise<void>;
}> = ({ initial, categories, defaultCategoryId, onClose, onSubmit }) => {
  const [name, setName] = useState(initial?.name || '');
  const [topic, setTopic] = useState(initial?.topic || '');
  const [type, setType] = useState<ChannelType>(initial?.type || 'text');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || defaultCategoryId);
  const [busy, setBusy] = useState(false);

  return (
    <ModalFrame title={initial ? 'Editar Canal' : 'Criar Canal ou Sala'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          try {
            await onSubmit({ name: name.trim(), topic: topic.trim(), type, categoryId });
            onClose();
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">Tipo de canal</label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'text', label: 'Texto', icon: Hash },
                { id: 'voice', label: 'Voz', icon: Volume2 },
                { id: 'video', label: 'Vídeo', icon: Video },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                    type === opt.id
                      ? 'bg-indigo-500/20 border-indigo-400/50 text-white'
                      : 'bg-white/[0.03] border-white/8 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#151720] border border-white/10 text-sm text-white"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Nome</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.CHANNEL_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'text' ? 'ex: ideias-produto' : 'ex: Reunião Diária'}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Tópico / Descrição</label>
          <input
            type="text"
            maxLength={FIELD_LIMITS.CHANNEL_TOPIC_MAX}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Assunto principal do canal"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-semibold">
            {initial ? 'Salvar Canal' : 'Criar Canal'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
};

export const NotificationsModal: React.FC<{
  notifications: NotificationItem[];
  onClose: () => void;
  onClickNotification: (n: NotificationItem) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}> = ({ notifications, onClose, onClickNotification, onMarkAllRead }) => (
  <ModalFrame
    title="Central de Notificações"
    subtitle="Atualizações em tempo real de mensagens, convites e salas"
    onClose={onClose}
  >
    <div className="space-y-4">
      {notifications.some((n) => !n.read) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Marcar todas como lidas
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-400">
          <Bell className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
          Você está em dia com todas as notificações.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onClickNotification(n)}
              className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                n.read
                  ? 'bg-white/[0.02] border-white/8 text-zinc-400 hover:bg-white/[0.04]'
                  : 'bg-indigo-500/10 border-indigo-400/25 text-zinc-100 hover:bg-indigo-500/15'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{n.title}</span>
                {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />}
              </div>
              {n.body && <p className="text-xs text-zinc-400 mt-1">{n.body}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  </ModalFrame>
);
