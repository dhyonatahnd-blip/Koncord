import React, { useState } from 'react';
import {
  Ban,
  Check,
  MessageSquare,
  Search,
  Settings,
  ShieldOff,
  UserCheck,
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
import { Avatar, presenceLabel } from './Avatar';
import { ChatArea } from './ChatArea';

type FriendsTab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

interface FriendsAndDmViewProps {
  currentUser: UserPublic;
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
    attachment?: { name: string; type: string; dataUrl: string };
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
      item.profile?.username.toLowerCase().includes(q)
    );
  });

  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim() || addBusy) return;
    setAddBusy(true);
    setAddFeedback(null);
    try {
      await onSendFriendRequestByUsername(addUsername.trim());
      setAddFeedback({ type: 'ok', text: `Solicitação enviada para @${addUsername.replace(/^@/, '')}.` });
      setAddUsername('');
    } catch (err) {
      setAddFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Usuário não encontrado.',
      });
    } finally {
      setAddBusy(false);
    }
  };

  const activeDmPeer = activeDmPeerUid ? usersByUid[activeDmPeerUid] : null;

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      {/* Left DM & Friends Drawer */}
      <aside className="w-64 shrink-0 bg-[#101116] border-r border-white/8 flex flex-col select-none">
        <div className="h-14 px-3 border-b border-white/8 flex items-center">
          <button
            type="button"
            onClick={onSelectFriendsHome}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              !activeDmPeerUid
                ? 'bg-indigo-500/15 text-white border border-indigo-400/25'
                : 'text-zinc-300 hover:bg-white/[0.05]'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Amigos</span>
            {pendingRequests.filter((r) => r.recipientId === currentUser.uid).length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-mono tabular-nums">
                {pendingRequests.filter((r) => r.recipientId === currentUser.uid).length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          <div className="px-2 pb-1 text-[11px] font-medium text-zinc-500">Mensagens Diretas</div>
          {dmThreads.length === 0 ? (
            <div className="px-2 py-4 text-xs text-zinc-500">
              Inicie uma conversa privada com um amigo ou membro.
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
                    name={peer?.displayName || 'Usuário'}
                    src={peer?.avatarDataUrl}
                    size="sm"
                    presence={presence}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-zinc-200 truncate">
                      {peer?.displayName || 'Usuário'}
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
              <div className="text-xs font-semibold text-white truncate">{currentUser.displayName}</div>
              <div className="text-[11px] text-zinc-400 truncate">@{currentUser.username}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenUserSettings}
            title="Configurações"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content: Either DM Conversation or Friends Dashboard */}
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
                  {activeDmPeer.displayName}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {activeDmPeer.customStatus ||
                    presenceLabel(getEffectivePresence(activeDmPeer.uid, activeDmPeer))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleBlockUser(activeDmPeer.uid)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs text-zinc-300 hover:text-rose-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Ban className="w-3.5 h-3.5" />
              Bloquear
            </button>
          </header>

          <ChatArea
            channelKey={`dm_${activeDmPeerUid}`}
            placeholder={`Conversar com ${activeDmPeer.displayName}`}
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
          {/* Friends Top Bar */}
          <header className="h-14 px-5 border-b border-white/8 flex items-center gap-4 overflow-x-auto shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white shrink-0">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Amigos</span>
            </div>
            <div className="h-4 w-px bg-white/10 shrink-0" />
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'online', label: 'Disponíveis' },
                  { id: 'all', label: 'Todos' },
                  { id: 'pending', label: `Pendentes (${pendingRequests.length})` },
                  { id: 'blocked', label: `Bloqueados (${blockedUids.length})` },
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
                Adicionar Amigo
              </button>
            </div>
          </header>

          {/* Friends Body */}
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto">
            {tab === 'add' && (
              <div className="rounded-2xl border border-white/10 bg-[#111319] p-6">
                <h3 className="font-display text-lg font-semibold text-white mb-1">
                  Adicionar por nome de usuário
                </h3>
                <p className="text-xs text-zinc-400 mb-5">
                  Digite o identificador (@usuario) do participante para enviar uma solicitação de amizade.
                </p>

                <form onSubmit={handleAddFriendSubmit} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    placeholder="ex: marina.silva"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={addBusy || !addUsername.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Enviar solicitação
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

                <div className="mt-5 pt-4 border-t border-white/8 text-xs text-zinc-400">
                  Seu usuário atual é{' '}
                  <span className="font-mono text-zinc-200">@{currentUser.username}</span>.
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
                    placeholder="Buscar amigos..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-zinc-500"
                  />
                </div>

                {filteredFriends.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-[#111319] p-10 text-center">
                    <p className="text-sm text-zinc-300 font-medium">
                      {tab === 'online'
                        ? 'Nenhum amigo disponível no momento.'
                        : 'Sua lista de amigos está vazia.'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 mb-4">
                      Adicione amigos usando o @usuário deles ou clique em membros dentro de um servidor.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('add')}
                      className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium"
                    >
                      Adicionar Amigo
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
                              name={profile?.displayName || 'Amigo'}
                              src={profile?.avatarDataUrl}
                              size="md"
                              presence={presence}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {profile?.displayName || 'Usuário'}
                              </div>
                              <div className="text-xs text-zinc-400 truncate">
                                @{profile?.username || 'usuario'} ·{' '}
                                {profile?.customStatus || presenceLabel(presence)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => onOpenDmWith(peerUid)}
                              title="Enviar mensagem privada"
                              className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 text-zinc-200 hover:text-indigo-200 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleBlockUser(peerUid)}
                              title="Bloquear usuário"
                              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveFriendship(friendship.id)}
                              title="Remover amigo"
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
                    Nenhuma solicitação de amizade pendente.
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
                              name={other?.displayName || 'Usuário'}
                              src={other?.avatarDataUrl}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {other?.displayName || 'Usuário'}
                              </div>
                              <div className="text-xs text-zinc-400">
                                {incoming ? 'Solicitação recebida' : 'Solicitação enviada'}
                              </div>
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
                                  <Check className="w-3.5 h-3.5" /> Aceitar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRespondFriendRequest(req.id, false)}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-200 text-xs font-medium flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> Recusar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onRemoveFriendship(req.id)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs"
                              >
                                Cancelar
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
                    Nenhum usuário bloqueado.
                  </div>
                ) : (
                  <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-[#111319]">
                    {blockedUids.map((bUid) => {
                      const profile = usersByUid[bUid];
                      return (
                        <div key={bUid} className="flex items-center justify-between gap-4 px-4 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={profile?.displayName || 'Usuário'}
                              src={profile?.avatarDataUrl}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {profile?.displayName || bUid}
                              </div>
                              <div className="text-xs text-zinc-500">Bloqueado</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleBlockUser(bUid)}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-200 flex items-center gap-1.5"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                            Desbloquear
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
