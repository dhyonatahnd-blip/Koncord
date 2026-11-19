import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  FolderPlus,
  Hash,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Plus,
  Settings,
  Trash2,
  Video,
  Volume2,
} from 'lucide-react';
import {
  CategoryDoc,
  ChannelDoc,
  PresenceStatus,
  ServerDoc,
  ServerRole,
  UserPublic,
  VoicePeer,
} from '../types';
import { Avatar, presenceDotClass, presenceLabel } from './Avatar';

interface ChannelSidebarProps {
  server: ServerDoc;
  userRole: ServerRole;
  categories: CategoryDoc[];
  channels: ChannelDoc[];
  activeChannelId: string | null;
  voiceRoster: Record<string, VoicePeer[]>;
  activeVoiceChannel: { channelId: string; channelName: string } | null;
  micMuted: boolean;
  screenSharing: boolean;
  currentUser: UserPublic;
  onSelectChannel: (channel: ChannelDoc) => void;
  onCreateCategory: () => void;
  onEditCategory: (cat: CategoryDoc) => void;
  onDeleteCategory: (catId: string) => void;
  onCreateChannel: (categoryId: string) => void;
  onEditChannel: (channel: ChannelDoc) => void;
  onDeleteChannel: (channelId: string) => void;
  onMoveChannel: (channel: ChannelDoc, direction: 'up' | 'down') => void;
  onOpenServerSettings: () => void;
  onLeaveServer: () => void;
  onCopyInvite: () => void;
  onToggleMic: () => void;
  onDisconnectVoice: () => void;
  onChangePresence: (presence: PresenceStatus) => void;
  onOpenUserSettings: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  server,
  userRole,
  categories,
  channels,
  activeChannelId,
  voiceRoster,
  activeVoiceChannel,
  micMuted,
  screenSharing,
  currentUser,
  onSelectChannel,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
  onCreateChannel,
  onEditChannel,
  onDeleteChannel,
  onMoveChannel,
  onOpenServerSettings,
  onLeaveServer,
  onCopyInvite,
  onToggleMic,
  onDisconnectVoice,
  onChangePresence,
  onOpenUserSettings,
}) => {
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);

  const canManage = userRole === 'owner' || userRole === 'admin';

  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);

  return (
    <aside className="w-64 shrink-0 bg-[#101116] border-r border-white/8 flex flex-col select-none">
      {/* Server Header */}
      <div className="h-14 px-4 border-b border-white/8 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-sm text-white truncate">{server.name}</h2>
          <div className="text-[11px] text-zinc-500 font-mono truncate">
            Convite: {server.inviteCode}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onCopyInvite}
            title="Copiar código de convite"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={onOpenServerSettings}
              title="Configurações do servidor"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onLeaveServer}
              title="Sair do servidor"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category & Channel Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {canManage && (
          <div className="flex items-center justify-between px-1.5">
            <span className="text-[11px] font-medium text-zinc-500">Canais & Salas</span>
            <button
              type="button"
              onClick={onCreateCategory}
              title="Nova categoria"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-white/8"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Categoria
            </button>
          </div>
        )}

        {sortedCategories.map((cat) => {
          const isCollapsed = Boolean(collapsedCats[cat.id]);
          const catChannels = channels
            .filter((c) => c.categoryId === cat.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div key={cat.id} className="space-y-1">
              <div className="group flex items-center justify-between px-1.5 py-1 rounded-lg hover:bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedCats((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                  }
                  className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 min-w-0 flex-1 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{cat.name}</span>
                </button>
                {canManage && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => onCreateChannel(cat.id)}
                      title="Criar canal nesta categoria"
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCategory(cat)}
                      title="Renomear categoria"
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {sortedCategories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteCategory(cat.id)}
                        title="Excluir categoria"
                        className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {catChannels.map((ch, idx) => {
                    const isActive = activeChannelId === ch.id;
                    const activePeers = voiceRoster[ch.id] || [];
                    const Icon =
                      ch.type === 'text' ? Hash : ch.type === 'voice' ? Volume2 : Video;

                    return (
                      <div key={ch.id}>
                        <div
                          className={`group flex items-center justify-between gap-1 px-2.5 py-2 rounded-xl transition-colors ${
                            isActive
                              ? 'bg-indigo-500/15 text-white border border-indigo-400/25'
                              : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectChannel(ch)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                isActive
                                  ? 'text-indigo-400'
                                  : ch.type !== 'text' && activePeers.length > 0
                                  ? 'text-emerald-400'
                                  : 'text-zinc-500'
                              }`}
                            />
                            <span className="text-[13px] font-medium truncate">{ch.name}</span>
                          </button>

                          {canManage && (
                            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => onMoveChannel(ch, 'up')}
                                  title="Mover para cima"
                                  className="p-0.5 rounded text-zinc-500 hover:text-white"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                              )}
                              {idx < catChannels.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => onMoveChannel(ch, 'down')}
                                  title="Mover para baixo"
                                  className="p-0.5 rounded text-zinc-500 hover:text-white"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEditChannel(ch)}
                                title="Editar canal"
                                className="p-0.5 rounded text-zinc-500 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteChannel(ch.id)}
                                title="Excluir canal"
                                className="p-0.5 rounded text-zinc-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Live Voice/Video Room Roster */}
                        {ch.type !== 'text' && activePeers.length > 0 && (
                          <div className="ml-6 mt-1 mb-1.5 space-y-1 border-l border-white/10 pl-2.5">
                            {activePeers.map((peer) => (
                              <div
                                key={peer.uid}
                                className="flex items-center justify-between gap-2 py-0.5 text-xs text-zinc-300"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar
                                    name={peer.displayName}
                                    src={peer.avatarDataUrl}
                                    size="xs"
                                    speaking={peer.speaking}
                                  />
                                  <span className="truncate">{peer.displayName}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {peer.screenSharing && (
                                    <MonitorUp className="w-3 h-3 text-sky-400" />
                                  )}
                                  {peer.micMuted && <MicOff className="w-3 h-3 text-rose-400" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Call Dock */}
      {activeVoiceChannel && (
        <div className="mx-2.5 mb-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Conectado na sala
            </div>
            <div className="text-xs text-zinc-200 truncate">{activeVoiceChannel.channelName}</div>
            {screenSharing && (
              <div className="text-[10px] text-sky-300 mt-0.5">Transmitindo tela</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleMic}
              title={micMuted ? 'Ativar microfone' : 'Silenciar microfone'}
              className="p-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-zinc-200"
            >
              {micMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onDisconnectVoice}
              title="Desconectar da sala"
              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* User Footer Card */}
      <div className="relative p-2.5 border-t border-white/8 bg-[#0D0E12] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPresenceMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left p-1 rounded-xl hover:bg-white/[0.05] transition-colors"
        >
          <Avatar
            name={currentUser.displayName}
            src={currentUser.avatarDataUrl}
            size="sm"
            presence={currentUser.presence}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{currentUser.displayName}</div>
            <div className="text-[11px] text-zinc-400 truncate">
              {currentUser.customStatus || presenceLabel(currentUser.presence)}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenUserSettings}
          title="Configurações da conta"
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors shrink-0"
        >
          <Settings className="w-4 h-4" />
        </button>

        {presenceMenuOpen && (
          <div className="absolute bottom-16 left-2.5 right-2.5 z-30 p-1.5 rounded-xl bg-[#161821] border border-white/12 shadow-2xl space-y-0.5">
            {(['online', 'idle', 'dnd', 'invisible'] as PresenceStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  onChangePresence(status);
                  setPresenceMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                  currentUser.presence === status
                    ? 'bg-indigo-500/20 text-white'
                    : 'text-zinc-300 hover:bg-white/8'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${presenceDotClass(status)}`} />
                <span>{presenceLabel(status)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
