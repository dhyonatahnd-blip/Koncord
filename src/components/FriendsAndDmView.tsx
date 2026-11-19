import React, { useState } from 'react';
import {
  Ban,
  Check,
  MessageSquare,
  Search,
  Settings,
  ShieldOff,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {
  ChatMessage,
  DmThread,
  FriendshipDoc,
  MessageReaction,
  PresenceStatus,
  UserPublic,
} from '../types';
import { useI18n } from '../i18n/I18nContext';
import { Avatar, presenceLabel } from './Avatar';
import { ChatArea, PendingAttachment } from './ChatArea';

type FriendsTab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

interface FriendsAndDmViewProps {
  currentUser: UserPublic;
  usingStaticFallback?: boolean;
  blockedUids: string[];
  friendships: FriendshipDoc[];
  dmThreads: DmThread[];
  usersByUid: Record<string, UserPublic>;
  livePresences: Record<string, PresenceStatus>;
  activeDmPeerUid: string | null;
  dmMessages: ChatMessage[];
  dmReactions: MessageReaction[];
  typingUsers: string[];
  onSelectFriendsHome: () => void;
  onOpenDmWith: (peerUid: string) => void;
  onSendFriendRequestByUsername: (username: string) => Promise<void>;
  onRespondFriendRequest: (friendshipId: string, accept: boolean) => Promise<void>;
  onRemoveFriendship: (friendshipId: string) => Promise<void>;
  onToggleBlockUser: (targetUid: string) => Promise<void>;
  onSendDmMessage: (payload: {
    content: string;
    attachment?: PendingAttachment;
    replyTo?: { id: string; authorName: string; snippet: string };
  }) => Promise<void>;
  onEditDmMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteDmMessage: (messageId: string) => Promise<void>;
  onToggleDmReaction: (messageId: string, emoji: string, currentlyReacted: boolean) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
  onOpenUserSettings: () => void;
}

export const FriendsAndDmView: React.FC<FriendsAndDmViewProps> = ({
  currentUser,
  usingStaticFallback = false,
  blockedUids,
  friendships,
  dmThreads,
  usersByUid,
  livePresences,
  activeDmPeerUid,
  dmMessages,
  dmReactions,
  typingUsers,
  onSelectFriendsHome,
  onOpenDmWith,
  onSendFriendRequestByUsername,
  onRespondFriendRequest,
  onRemoveFriendship,
  onToggleBlockUser,
  onSendDmMessage,
  onEditDmMessage,
  onDeleteDmMessage,
  onToggleDmReaction,
  onTypingChange,
  onOpenUserSettings,
}) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<FriendsTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addFeedback, setAddFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const acceptedFriends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => {
      const peerUid = f.users.find((u) => u !== currentUser.uid) || '';
      return { friendship: f, peerUid, profile: usersByUid[peerUid] };
    })
    .filter((item) => item.peerUid && !blockedUids.includes(item.peerUid));

  const pendingRequests = friendships.filter((f) => f.status === 'pending');

  const getEffectivePresence = (uid: string, profile?: UserPublic): PresenceStatus => {
    if (!profile) return 'invisible';
    if (profile.presence === 'invisible') return 'invisible';
    return livePresences[uid] || profile.presence || 'invisible';
  };

  const onlineFriends = acceptedFriends.filter(
    (item) => getEffectivePresence(item.peerUid, item.profile) !== 'invisible'
  );

  const filteredFriends = (tab === 'online' ? onlineFriends : acceptedFriends).filter((item) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.profile?.displayName.toLowerCase().includes(q) ||
      item.profile?.username.toLowerCase().includes(q) ||
      item.profile?.tag?.toLowerCase().includes(q)
    );
  });

  const onlineUsersInZone = Object.values(usersByUid).filter((u) => {
    if (u.uid === currentUser.uid) return false;
    if (blockedUids.includes(u.uid)) return false;
    return getEffectivePresence(u.uid, u) !== 'invisible';
  });

  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim() || addBusy) return;
    setAddBusy(true);
    setAddFeedback(null);
    try {
      await onSendFriendRequestByUsername(addUsername.trim());
      setAddFeedback({ type: 'ok', text: t.friendRequestSent });
      setAddUsername('');
    } catch (err) {
      setAddFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : t.participantNotFound,
      });
    } finally {
      setAddBusy(false);
    }
  };

  const activeDmPeer = activeDmPeerUid ? usersByUid[activeDmPeerUid] : null;
  const activeThreadId = activeDmPeerUid
    ? currentUser.uid < activeDmPeerUid
      ? `${currentUser.uid}_${activeDmPeerUid}`
      : `${activeDmPeerUid}_${currentUser.uid}`
    : '';

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      {/* Left DM & Contacts Drawer */}
      <aside className="w-64 shrink-0 bg-[#101116] border-r border-white/8 flex flex-col select-none">
        <div className="h-14 px-3 border-b border-white/8 flex items-center">
          <button
            type="button"
            onClick={onSelectFriendsHome}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              !activeDmPeerUid
                ? 'bg-blue-500/15 text-white border border-blue-400/25'
                : 'text-zinc-300 hover:bg-white/[0.05]'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>{t.friendsAndDmsTitle}</span>
            {pendingRequests.filter((r) => r.recipientId === currentUser.uid).length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-mono tabular-nums">
                {pendingRequests.filter((r) => r.recipientId === currentUser.uid).length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          <div className="px-2 pb-1 text-[11px] font-medium text-zinc-500">{t.directMessages}</div>
          {dmThreads.length === 0 ? (
            <div className="px-2 py-4 text-xs text-zinc-500">
              {t.emptyChatSubtitle}
            </div>
          ) : (
            dmThreads.map((thread) => {
              const peerUid = thread.participants.find((u) => u !== currentUser.uid) || '';
              if (!peerUid || blockedUids.includes(peerUid)) return null;
              const peer = usersByUid[peerUid];
              const isActive = activeDmPeerUid === peerUid;
              const presence = getEffectivePresence(peerUid, peer);

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onOpenDmWith(peerUid)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                >
                  <Avatar
                    name={peer?.displayName || 'ZONE'}
                    src={peer?.avatarDataUrl}
                    size="sm"
                    presence={presence}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-zinc-200 truncate">
                      {peer?.displayName || 'User'}{' '}
                      {peer?.tag && (
                        <span className="text-[10px] font-mono text-zinc-500">{peer.tag}</span>
                      )}
                    </div>
                    {thread.lastMessagePreview && (
                      <div className="text-[11px] text-zinc-500 truncate">
                        {thread.lastMessagePreview}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* User Card Footer */}
        <div className="p-2.5 border-t border-white/8 bg-[#0D0E12] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              name={currentUser.displayName}
              src={currentUser.avatarDataUrl}
              size="sm"
              presence={currentUser.presence}
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser.displayName}{' '}
                {currentUser.tag && (
                  <span className="text-[10px] font-mono text-zinc-500">{currentUser.tag}</span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 truncate">@{currentUser.username}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenUserSettings}
            title={t.userSettings}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      {activeDmPeerUid && activeDmPeer ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <header className="h-14 px-5 border-b border-white/8 bg-[#0E0F14]/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                name={activeDmPeer.displayName}
                src={activeDmPeer.avatarDataUrl}
                size="sm"
                presence={getEffectivePresence(activeDmPeer.uid, activeDmPeer)}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {activeDmPeer.displayName}{' '}
                  {activeDmPeer.tag && (
                    <span className="text-xs font-mono text-zinc-500">{activeDmPeer.tag}</span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {activeDmPeer.customStatus ||
                    presenceLabel(getEffectivePresence(activeDmPeer.uid, activeDmPeer), t)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleBlockUser(activeDmPeer.uid)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs text-zinc-300 hover:text-rose-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Ban className="w-3.5 h-3.5" />
              {t.blockBtn}
            </button>
          </header>

          <ChatArea
            channelKey={`dm_${activeDmPeerUid}`}
            threadId={activeThreadId}
            usingStaticFallback={usingStaticFallback}
            placeholder={`${t.chatPlaceholder} ${activeDmPeer.displayName}`}
            messages={dmMessages}
            reactions={dmReactions}
            currentUser={currentUser}
            blockedUids={blockedUids}
            typingUsers={typingUsers}
            onTypingChange={onTypingChange}
            onSendMessage={onSendDmMessage}
            onEditMessage={onEditDmMessage}
            onDeleteMessage={onDeleteDmMessage}
            onToggleReaction={onToggleDmReaction}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0B0C10]">
          {/* Contacts Top Bar */}
          <header className="h-14 px-5 border-b border-white/8 flex items-center gap-4 overflow-x-auto shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white shrink-0">
              <Users className="w-4 h-4 text-blue-400" />
              <span>{t.friendsAndDmsTitle}</span>
            </div>
            <div className="h-4 w-px bg-white/10 shrink-0" />
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'online', label: t.friendsOnlineTab },
                  { id: 'all', label: t.friendsAllTab },
                  { id: 'pending', label: `${t.friendsPendingTab} (${pendingRequests.length})` },
                  { id: 'blocked', label: `${t.friendsBlockedTab} (${blockedUids.length})` },
                ] as { id: FriendsTab; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    tab === item.id
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTab('add')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  tab === 'add'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t.friendsAddTab}
              </button>
            </div>
          </header>

          {/* Contacts Body */}
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto">
            {tab === 'add' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#111319] p-6">
                  <h3 className="font-display text-lg font-semibold text-white mb-1">
                    {t.addFriendBtn}
                  </h3>
                  <p className="text-xs text-zinc-400 mb-5">
                    {currentUser.displayName} {currentUser.tag} · @{currentUser.username}
                  </p>

                  <form onSubmit={handleAddFriendSubmit} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={addUsername}
                      onChange={(e) => setAddUsername(e.target.value)}
                      placeholder={t.searchParticipantsPlaceholder}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={addBusy || !addUsername.trim()}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {t.addFriendBtn}
                    </button>
                  </form>

                  {addFeedback && (
                    <div
                      className={`mt-4 px-4 py-3 rounded-xl border text-xs ${
                        addFeedback.type === 'ok'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      }`}
                    >
                      {addFeedback.text}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#111319] p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {t.discoverParticipantsTitle} ({onlineUsersInZone.length})
                    </h4>
                  </div>

                  {(() => {
                    const q = addUsername.trim().toLowerCase().replace(/^@/, '');
                    const matching = onlineUsersInZone.filter((u) => {
                      if (!q) return true;
                      return (
                        u.displayName.toLowerCase().includes(q) ||
                        u.username.toLowerCase().includes(q) ||
                        (u.tag || '').toLowerCase().includes(q) ||
                        `${u.displayName}${u.tag || ''}`.toLowerCase().includes(q)
                      );
                    });
                    if (matching.length === 0) {
                      return (
                        <div className="py-6 text-center text-xs text-zinc-500">
                          {t.participantNotFound}
                        </div>
                      );
                    }
                    return (
                      <div className="divide-y divide-white/8">
                        {matching.map((u) => {
                          const presence = getEffectivePresence(u.uid, u);
                          const alreadyConnected = friendships.some(
                            (f) => f.users.includes(u.uid) && f.status !== 'declined'
                          );
                          return (
                            <div
                              key={u.uid}
                              className="flex items-center justify-between gap-3 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar
                                  name={u.displayName}
                                  src={u.avatarDataUrl}
                                  size="md"
                                  presence={presence}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-white truncate">
                                    {u.displayName}{' '}
                                    {u.tag && (
                                      <span className="text-xs font-mono text-zinc-500">{u.tag}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-zinc-400 truncate">
                                    @{u.username} · {u.customStatus || presenceLabel(presence, t)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onOpenDmWith(u.uid)}
                                  title={t.directMessageBtn}
                                  className="px-3 py-1.5 rounded-xl bg-white/8 hover:bg-blue-500/20 text-zinc-200 hover:text-blue-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  {t.directMessageBtn}
                                </button>
                                {!alreadyConnected && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setAddFeedback(null);
                                      try {
                                        await onSendFriendRequestByUsername(
                                          u.tag ? `${u.displayName}${u.tag}` : u.username
                                        );
                                        setAddFeedback({ type: 'ok', text: t.friendRequestSent });
                                      } catch (err) {
                                        setAddFeedback({
                                          type: 'err',
                                          text:
                                            err instanceof Error
                                              ? err.message
                                              : t.participantNotFound,
                                        });
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    {t.addFriendBtn}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {(tab === 'online' || tab === 'all') && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-500"
                  />
                </div>

                {filteredFriends.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-[#111319] p-10 text-center">
                    <p className="text-sm text-zinc-300 font-medium">{t.noParticipantsYet}</p>
                    <button
                      type="button"
                      onClick={() => setTab('add')}
                      className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                    >
                      {t.addFriendBtn}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-[#111319]">
                    {filteredFriends.map(({ friendship, peerUid, profile }) => {
                      const presence = getEffectivePresence(peerUid, profile);
                      return (
                        <div
                          key={friendship.id}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={profile?.displayName || 'ZONE'}
                              src={profile?.avatarDataUrl}
                              size="md"
                              presence={presence}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {profile?.displayName || 'User'}{' '}
                                {profile?.tag && (
                                  <span className="text-xs font-mono text-zinc-500">
                                    {profile.tag}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-400 truncate">
                                @{profile?.username || 'user'} ·{' '}
                                {profile?.customStatus || presenceLabel(presence, t)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => onOpenDmWith(peerUid)}
                              title={t.directMessageBtn}
                              className="p-2 rounded-xl bg-white/5 hover:bg-blue-500/20 text-zinc-200 hover:text-blue-200 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleBlockUser(peerUid)}
                              title={t.blockBtn}
                              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveFriendship(friendship.id)}
                              title={t.deleteAction}
                              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 transition-colors"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'pending' && (
              <div className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-[#111319] p-10 text-center text-sm text-zinc-400">
                    {t.noParticipantsYet}
                  </div>
                ) : (
                  <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-[#111319]">
                    {pendingRequests.map((req) => {
                      const incoming = req.recipientId === currentUser.uid;
                      const otherUid = incoming ? req.requesterId : req.recipientId;
                      const other = usersByUid[otherUid];

                      return (
                        <div
                          key={req.id}
                          className="flex items-center justify-between gap-4 px-4 py-3.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={other?.displayName || 'ZONE'}
                              src={other?.avatarDataUrl}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {other?.displayName || otherUid}
                              </div>
                              <div className="text-xs text-zinc-400">@{other?.username}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {incoming ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onRespondFriendRequest(req.id, true)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> {t.saveAction}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRespondFriendRequest(req.id, false)}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-200 text-xs font-medium flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> {t.cancelAction}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onRemoveFriendship(req.id)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs"
                              >
                                {t.cancelAction}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'blocked' && (
              <div className="space-y-3">
                {blockedUids.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-[#111319] p-10 text-center text-sm text-zinc-400">
                    {t.noParticipantsYet}
                  </div>
                ) : (
                  <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-[#111319]">
                    {blockedUids.map((bUid) => {
                      const profile = usersByUid[bUid];
                      return (
                        <div key={bUid} className="flex items-center justify-between gap-4 px-4 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={profile?.displayName || 'ZONE'}
                              src={profile?.avatarDataUrl}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {profile?.displayName || bUid}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleBlockUser(bUid)}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-200 flex items-center gap-1.5"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                            {t.unblockBtn}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
