import React, { useState } from 'react';
import {
  Ban,
  Bell,
  Camera,
  Check,
  Copy,
  Globe,
  Hash,
  Link2,
  Lock,
  LogOut,
  MessageSquare,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import {
  CategoryDoc,
  ChannelDoc,
  ChannelType,
  LanguageCode,
  MessageRetention,
  NotificationItem,
  PresenceStatus,
  RoomVisibility,
  ServerDoc,
  ServerRole,
  UserPrivate,
  UserPublic,
} from '../types';
import { useI18n } from '../i18n/I18nContext';
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
    className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-lg rounded-2xl border border-white/12 glass-elevated shadow-2xl overflow-hidden"
    >
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/8 flex items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-white truncate">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] min-w-[40px] rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 sm:p-6 max-h-[82dvh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

export const UserSettingsModal: React.FC<{
  publicProfile: UserPublic;
  privateProfile: UserPrivate;
  onClose: () => void;
  onOpenPrivacy: () => void;
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
}> = ({ publicProfile, privateProfile, onClose, onOpenPrivacy, onSave, onLogout }) => {
  const { lang, setLang, t } = useI18n();
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
      setError(err instanceof Error ? err.message : t.tempFileOpenError);
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
      setError(err instanceof Error ? err.message : t.tempFileOpenError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title={t.accountSettingsTitle}
      subtitle={`${t.sessionTagLabel}: ${publicProfile.tag || ''} · ${publicProfile.uid}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <Globe className="w-4 h-4 text-blue-400" />
            <span>{t.languageLabel}</span>
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as LanguageCode)}
            className="px-3 py-1.5 rounded-lg bg-[#151720] border border-white/10 text-xs text-white"
          >
            <option value="pt-BR">Português (BR)</option>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <Avatar name={displayName || 'Z'} src={avatarDataUrl} size="xl" presence={presence} />
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-white cursor-pointer transition-colors">
              <Camera className="w-3.5 h-3.5" />
              {t.uploadPhoto}
              <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">{t.displayNameLabel}</label>
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
            <label className="block text-xs font-medium text-zinc-400 mb-1">{t.usernameLabel}</label>
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
            <label className="block text-xs font-medium text-zinc-400 mb-1">{t.customStatusLabel}</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.CUSTOM_STATUS_MAX}
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">{t.presenceLabel}</label>
            <select
              value={presence}
              onChange={(e) => setPresence(e.target.value as PresenceStatus)}
              className="w-full px-3 py-2 rounded-xl bg-[#151720] border border-white/10 text-sm text-white"
            >
              <option value="online">{t.online}</option>
              <option value="idle">{t.idle}</option>
              <option value="dnd">{t.dnd}</option>
              <option value="invisible">{t.invisible}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">{t.bioLabel}</label>
          <textarea
            rows={2}
            maxLength={FIELD_LIMITS.BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white resize-none"
          />
        </div>

        <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 cursor-pointer">
          <span className="text-xs text-zinc-200">{t.notificationsToggle}</span>
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="accent-blue-500 w-4 h-4"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenPrivacy();
          }}
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-4"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          {t.readPrivacyPolicy}
        </button>

        <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-white/8">
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.exitSessionBtn}
          </button>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
            >
              {t.cancelAction}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold"
            >
              {busy ? t.saving : t.saveChangesBtn}
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
  canInviteToRoom?: boolean;
  onClose: () => void;
  onSendDm: () => void;
  onAddFriend: () => Promise<void>;
  onInviteToRoom?: () => Promise<void>;
  onToggleBlock: () => Promise<void>;
  onToggleAdminRole?: (nextRole: 'admin' | 'member') => Promise<void>;
}> = ({
  user,
  roleInServer,
  currentUserUid,
  viewerRoleInServer,
  isFriend,
  isBlocked,
  canInviteToRoom = false,
  onClose,
  onSendDm,
  onAddFriend,
  onInviteToRoom,
  onToggleBlock,
  onToggleAdminRole,
}) => {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<string | null>(null);
  const isSelf = user.uid === currentUserUid;

  return (
    <ModalFrame
      title={user.displayName}
      subtitle={`@${user.username}${user.tag ? ` · ${user.tag}` : ''}`}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.displayName} src={user.avatarDataUrl} size="xl" presence={user.presence} />
          <div className="min-w-0">
            <div className="text-base font-semibold text-white">
              {user.displayName}{' '}
              {user.tag && <span className="text-xs font-mono text-zinc-400">{user.tag}</span>}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {presenceLabel(user.presence, t)}
              {user.customStatus ? ` · ${user.customStatus}` : ''}
            </div>
            {roleInServer && (
              <div className="text-xs text-blue-300 mt-1">
                {roleInServer === 'owner'
                  ? t.ownerRole
                  : roleInServer === 'admin'
                  ? t.adminRole
                  : t.memberRole}
              </div>
            )}
          </div>
        </div>

        {user.bio && (
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
            <div className="text-[11px] font-medium text-zinc-500 mb-1">{t.bioLabel}</div>
            <p className="text-xs text-zinc-200 leading-relaxed">{user.bio}</p>
          </div>
        )}

        {feedback && (
          <div className="px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-400/30 text-xs text-blue-200">
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
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {t.directMessageBtn}
            </button>

            {!isFriend && !isBlocked && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onAddFriend();
                    setFeedback(t.friendRequestSent);
                  } catch (err) {
                    setFeedback(err instanceof Error ? err.message : t.participantNotFound);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-white flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t.addFriendBtn}
              </button>
            )}

            {canInviteToRoom && onInviteToRoom && !isBlocked && (
              <button
                type="button"
                onClick={async () => {
                  await onInviteToRoom();
                  setFeedback(t.inviteSentNotice);
                }}
                className="px-3.5 py-2 rounded-xl bg-violet-600/25 hover:bg-violet-600/35 border border-violet-400/30 text-xs font-medium text-violet-200 flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                {t.inviteToRoomBtn}
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                await onToggleBlock();
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs text-zinc-300 hover:text-rose-200 flex items-center gap-1.5"
            >
              {isBlocked ? <ShieldOff className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {isBlocked ? t.unblockBtn : t.blockBtn}
            </button>

            {viewerRoleInServer === 'owner' && roleInServer !== 'owner' && onToggleAdminRole && (
              <button
                type="button"
                onClick={async () => {
                  const next = roleInServer === 'admin' ? 'member' : 'admin';
                  await onToggleAdminRole(next);
                  setFeedback(next === 'admin' ? t.adminRole : t.memberRole);
                }}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-200 flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                {roleInServer === 'admin' ? t.removeAdminBtn : t.promoteAdminBtn}
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
  onCreate: (data: {
    name: string;
    description: string;
    iconColor: string;
    visibility: RoomVisibility;
    retention: MessageRetention;
    clearOnClose: boolean;
  }) => Promise<void>;
}> = ({ onClose, onCreate }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconColor, setIconColor] = useState('#3B82F6');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [retention, setRetention] = useState<MessageRetention>('until_close');
  const [clearOnClose, setClearOnClose] = useState(true);
  const [busy, setBusy] = useState(false);

  const colors = ['#3B82F6', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899'];

  return (
    <ModalFrame
      title={t.createRoomTitle}
      subtitle={t.createRoomSubtitle}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          try {
            await onCreate({
              name: name.trim(),
              description: description.trim(),
              iconColor,
              visibility,
              retention,
              clearOnClose,
            });
            onClose();
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t.roomNameLabel}</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.SERVER_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.roomNamePlaceholder}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t.roomDescLabel}</label>
          <input
            type="text"
            maxLength={FIELD_LIMITS.SERVER_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.roomDescPlaceholder}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">{t.visibilityLabel}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`p-3 rounded-xl border text-left transition-colors ${
                visibility === 'public'
                  ? 'bg-blue-500/15 border-blue-400/50 text-white'
                  : 'bg-white/[0.03] border-white/8 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                {t.visibilityPublic}
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">{t.visibilityPublicDesc}</p>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`p-3 rounded-xl border text-left transition-colors ${
                visibility === 'private'
                  ? 'bg-violet-500/15 border-violet-400/50 text-white'
                  : 'bg-white/[0.03] border-white/8 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                <Lock className="w-3.5 h-3.5 text-violet-400" />
                {t.visibilityPrivate}
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">{t.visibilityPrivateDesc}</p>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t.retentionLabel}</label>
          <select
            value={retention}
            onChange={(e) => setRetention(e.target.value as MessageRetention)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#151720] border border-white/10 text-sm text-white"
          >
            <option value="until_close">{t.retentionUntilClose}</option>
            <option value="5m">{t.retention5m}</option>
            <option value="15m">{t.retention15m}</option>
            <option value="60m">{t.retention60m}</option>
          </select>
        </div>

        <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 cursor-pointer">
          <span className="text-xs text-zinc-200">{t.clearOnCloseLabel}</span>
          <input
            type="checkbox"
            checked={clearOnClose}
            onChange={(e) => setClearOnClose(e.target.checked)}
            className="accent-blue-500 w-4 h-4"
          />
        </label>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">{t.emblemColorLabel}</label>
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
            {t.cancelAction}
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold"
          >
            {busy ? t.creating : t.createRoomSubmit}
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
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeCode = (raw: string) => {
    const match = raw.match(/[?&](?:room|invite)=([A-Za-z0-9_-]+)/i);
    if (match && match[1]) return match[1].toUpperCase();
    return raw.trim().toUpperCase();
  };

  return (
    <ModalFrame
      title={t.joinRoomTitle}
      subtitle={t.joinRoomSubtitle}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const clean = normalizeCode(code);
          if (!clean || busy) return;
          setBusy(true);
          setError(null);
          try {
            await onJoin(clean);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : t.tempFileOpenError);
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
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t.inviteCodeLabel}</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ZONEEU"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-mono text-white"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300"
          >
            {t.cancelAction}
          </button>
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold"
          >
            {busy ? t.joining : t.joinRoomSubmit}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
};

export const PublicRoomsModal: React.FC<{
  publicRooms: ServerDoc[];
  joinedServerIds: string[];
  onClose: () => void;
  onJoinPublicRoom: (serverId: string) => void;
  onSelectJoinedRoom: (serverId: string) => void;
}> = ({
  publicRooms,
  joinedServerIds,
  onClose,
  onJoinPublicRoom,
  onSelectJoinedRoom,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = publicRooms.filter((room) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      room.name.toLowerCase().includes(q) ||
      room.inviteCode.toLowerCase().includes(q) ||
      room.description.toLowerCase().includes(q)
    );
  });

  return (
    <ModalFrame
      title={t.publicRoomsTitle}
      subtitle={t.publicRoomsSubtitle}
      onClose={onClose}
    >
      <div className="space-y-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchRoomsPlaceholder}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-500"
        />

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">{t.publicRoomsEmpty}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((room) => {
              const isMember = joinedServerIds.includes(room.id);
              return (
                <div
                  key={room.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-sm text-white shrink-0 border border-white/10"
                      style={{ backgroundColor: room.iconColor }}
                    >
                      {room.iconInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{room.name}</span>
                        <span className="text-[11px] font-mono text-zinc-500 shrink-0">{room.inviteCode}</span>
                      </div>
                      {room.description && (
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{room.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1 tabular-nums">
                        <Users className="w-3 h-3" />
                        <span>{room.memberCount ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isMember) {
                        onSelectJoinedRoom(room.id);
                      } else {
                        onJoinPublicRoom(room.id);
                      }
                      onClose();
                    }}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-colors w-full sm:w-auto text-center ${
                      isMember
                        ? 'bg-white/8 hover:bg-white/15 text-zinc-200'
                        : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white'
                    }`}
                  >
                    {isMember ? t.alreadyMember : t.joinBtn}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalFrame>
  );
};

export const ServerSettingsModal: React.FC<{
  server: ServerDoc;
  friends: UserPublic[];
  isOwner: boolean;
  onClose: () => void;
  onSave: (updates: {
    name: string;
    description: string;
    iconDataUrl: string;
    visibility: RoomVisibility;
    retention: MessageRetention;
    clearOnClose: boolean;
  }) => Promise<void>;
  onInviteFriend: (friendUid: string) => Promise<void>;
  onCloseRoom?: () => Promise<void>;
}> = ({ server, friends, isOwner, onClose, onSave, onInviteFriend, onCloseRoom }) => {
  const { t } = useI18n();
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description);
  const [iconDataUrl, setIconDataUrl] = useState(server.iconDataUrl);
  const [visibility, setVisibility] = useState<RoomVisibility>(server.visibility || 'public');
  const [retention, setRetention] = useState<MessageRetention>(server.retention || 'until_close');
  const [clearOnClose, setClearOnClose] = useState(server.clearOnClose !== false);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitedUids, setInvitedUids] = useState<Record<string, boolean>>({});

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${server.inviteCode}`
      : `?room=${server.inviteCode}`;

  const handleIconPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const processed = await fileToCompressedDataUrl(file, FIELD_LIMITS.AVATAR_DATA_URL_MAX, 512);
    setIconDataUrl(processed.dataUrl);
  };

  return (
    <ModalFrame title={t.roomSettingsTitle} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-400">{t.inviteCodeLabel}</div>
              <div className="font-mono text-base font-semibold text-white mt-0.5">
                {server.inviteCode}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(server.inviteCode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-zinc-200 text-xs font-medium flex items-center gap-1.5"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {t.copyInviteCode}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-medium flex items-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {t.copyInviteLink}
              </button>
            </div>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSave({ name, description, iconDataUrl, visibility, retention, clearOnClose });
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
              {t.uploadPhoto}
              <input type="file" accept="image/*" onChange={handleIconPick} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">{t.roomNameLabel}</label>
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
            <label className="block text-xs font-medium text-zinc-400 mb-1">{t.roomDescLabel}</label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.SERVER_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">{t.visibilityLabel}</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as RoomVisibility)}
                className="w-full px-3 py-2 rounded-xl bg-[#151720] border border-white/10 text-xs text-white"
              >
                <option value="public">{t.visibilityPublic}</option>
                <option value="private">{t.visibilityPrivate}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">{t.retentionLabel}</label>
              <select
                value={retention}
                onChange={(e) => setRetention(e.target.value as MessageRetention)}
                className="w-full px-3 py-2 rounded-xl bg-[#151720] border border-white/10 text-xs text-white"
              >
                <option value="until_close">{t.retentionUntilClose}</option>
                <option value="5m">{t.retention5m}</option>
                <option value="15m">{t.retention15m}</option>
                <option value="60m">{t.retention60m}</option>
              </select>
            </div>
          </div>

          <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 cursor-pointer">
            <span className="text-xs text-zinc-200">{t.clearOnCloseLabel}</span>
            <input
              type="checkbox"
              checked={clearOnClose}
              onChange={(e) => setClearOnClose(e.target.checked)}
              className="accent-blue-500 w-4 h-4"
            />
          </label>

          {friends.length > 0 && (
            <div className="pt-2 border-t border-white/8">
              <div className="text-xs font-medium text-zinc-400 mb-2">{t.inviteFriendsLabel}</div>
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
                      className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/35 text-blue-200 text-xs disabled:opacity-50"
                    >
                      {invitedUids[f.uid] ? t.invitedBtn : t.inviteBtn}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-white/8">
            {isOwner && server.ownerId !== 'system' && onCloseRoom ? (
              <button
                type="button"
                onClick={async () => {
                  await onCloseRoom();
                  onClose();
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.closeRoom}
              </button>
            ) : (
              <span className="hidden sm:inline" />
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300"
              >
                {t.closeBtn}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold"
              >
                {t.saveAction}
              </button>
            </div>
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
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name || '');
  const [busy, setBusy] = useState(false);

  return (
    <ModalFrame title={initial ? t.renameCategory : t.newCategory} onClose={onClose}>
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
          <label className="block text-xs font-medium text-zinc-400 mb-1">{t.categoryNameLabel}</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.CATEGORY_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300">
            {t.cancelAction}
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">
            {t.saveAction}
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
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name || '');
  const [topic, setTopic] = useState(initial?.topic || '');
  const [type, setType] = useState<ChannelType>(initial?.type || 'text');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || defaultCategoryId);
  const [busy, setBusy] = useState(false);

  return (
    <ModalFrame title={initial ? t.editChannel : t.createChannel} onClose={onClose}>
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
          <label className="block text-xs font-medium text-zinc-400 mb-2">{t.channelTypeLabel}</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                { id: 'text', label: t.channelTypeText, icon: Hash },
                { id: 'voice', label: t.channelTypeVoice, icon: Volume2 },
                { id: 'video', label: t.channelTypeVideo, icon: Video },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={`min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                    type === opt.id
                      ? 'bg-blue-500/20 border-blue-400/50 text-white'
                      : 'bg-white/[0.03] border-white/8 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">{t.channelCategoryLabel}</label>
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
          <label className="block text-xs font-medium text-zinc-400 mb-1">{t.channelNameLabel}</label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.CHANNEL_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">{t.channelTopicLabel}</label>
          <input
            type="text"
            maxLength={FIELD_LIMITS.CHANNEL_TOPIC_MAX}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 text-xs text-zinc-300">
            {t.cancelAction}
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">
            {t.saveAction}
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
}> = ({ notifications, onClose, onClickNotification, onMarkAllRead }) => {
  const { t } = useI18n();
  return (
    <ModalFrame
      title={t.notifications}
      onClose={onClose}
    >
      <div className="space-y-4">
        {notifications.some((n) => !n.read) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              ✓
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">
            <Bell className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
            {t.noParticipantsYet}
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
                    : 'bg-blue-500/10 border-blue-400/25 text-zinc-100 hover:bg-blue-500/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{n.title}</span>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
                </div>
                {n.body && <p className="text-xs text-zinc-400 mt-1">{n.body}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalFrame>
  );
};

export const PrivacyPolicyModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useI18n();
  return (
    <ModalFrame
      title={t.privacyPolicyTitle}
      subtitle={t.privacyPolicySubtitle}
      onClose={onClose}
    >
      <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
          <h4 className="font-semibold text-white">{t.privacySection1Title}</h4>
          <p className="text-zinc-400">{t.privacySection1Body}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
          <h4 className="font-semibold text-white">{t.privacySection2Title}</h4>
          <p className="text-zinc-400">{t.privacySection2Body}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
          <h4 className="font-semibold text-white">{t.privacySection3Title}</h4>
          <p className="text-zinc-400">{t.privacySection3Body}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-400/25 space-y-1">
          <h4 className="font-semibold text-blue-200">{t.privacySection4Title}</h4>
          <p className="text-zinc-300">{t.privacySection4Body}</p>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-xs font-semibold"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

export const MediaConsentModal: React.FC<{
  onAccept: () => void;
  onDecline: () => void;
}> = ({ onAccept, onDecline }) => {
  const { t } = useI18n();
  return (
    <ModalFrame title={t.mediaConsentTitle} onClose={onDecline}>
      <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
        <p>{t.mediaConsentBody}</p>
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-400/25 text-zinc-300">
          {t.mediaConsentNotice}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDecline}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium"
          >
            {t.mediaConsentDecline}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold"
          >
            {t.mediaConsentAccept}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};
