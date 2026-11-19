import React from 'react';
import { Bell, Compass, Globe, MessageSquareHeart, Plus, ShieldCheck } from 'lucide-react';
import { ServerDoc } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface ServerSidebarProps {
  servers: ServerDoc[];
  activeMode: 'home' | 'server';
  activeServerId: string | null;
  unreadNotifications: number;
  publicRoomsCount?: number;
  onSelectHome: () => void;
  onSelectServer: (serverId: string) => void;
  onOpenPublicRooms: () => void;
  onOpenCreateServer: () => void;
  onOpenJoinServer: () => void;
  onOpenNotifications: () => void;
  onOpenPrivacy: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  servers,
  activeMode,
  activeServerId,
  unreadNotifications,
  publicRoomsCount = 0,
  onSelectHome,
  onSelectServer,
  onOpenPublicRooms,
  onOpenCreateServer,
  onOpenJoinServer,
  onOpenNotifications,
  onOpenPrivacy,
}) => {
  const { t } = useI18n();

  return (
    <aside className="w-[72px] shrink-0 bg-[#090A0D] border-r border-white/8 flex flex-col items-center py-3 gap-2.5 select-none">
      {/* Home: Contacts & Direct Messages */}
      <div className="relative flex items-center justify-center w-full">
        {activeMode === 'home' && (
          <span className="absolute left-0 w-1 h-7 rounded-r-full bg-blue-400" />
        )}
        <button
          type="button"
          onClick={onSelectHome}
          title={t.directMessages}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150 ${
            activeMode === 'home'
              ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-xl shadow-lg shadow-blue-500/25'
              : 'bg-white/[0.05] text-zinc-300 hover:bg-blue-500/20 hover:text-white hover:rounded-xl'
          }`}
        >
          <MessageSquareHeart className="w-5 h-5" />
        </button>
      </div>

      <div className="w-8 h-px bg-white/10 my-0.5" />

      {/* Rooms List */}
      <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-2.5 px-2">
        {servers.map((srv) => {
          const isActive = activeMode === 'server' && activeServerId === srv.id;
          return (
            <div key={srv.id} className="relative flex items-center justify-center w-full">
              {isActive && (
                <span className="absolute -left-2 w-1 h-7 rounded-r-full bg-white" />
              )}
              <button
                type="button"
                onClick={() => onSelectServer(srv.id)}
                title={srv.name}
                style={!srv.iconDataUrl ? { backgroundColor: isActive ? srv.iconColor : undefined } : undefined}
                className={`w-12 h-12 overflow-hidden flex items-center justify-center font-display font-semibold text-sm transition-all duration-150 border ${
                  isActive
                    ? 'rounded-xl text-white border-white/25 shadow-lg'
                    : 'rounded-2xl bg-white/[0.06] text-zinc-200 border-white/8 hover:rounded-xl hover:border-white/20'
                }`}
              >
                {srv.iconDataUrl ? (
                  <img
                    src={srv.iconDataUrl}
                    alt={srv.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background: isActive
                        ? srv.iconColor
                        : `linear-gradient(135deg, ${srv.iconColor}33, ${srv.iconColor}11)`,
                    }}
                  >
                    {srv.iconInitials}
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Create Room */}
        <button
          type="button"
          onClick={onOpenCreateServer}
          title={t.createRoom}
          className="w-12 h-12 rounded-2xl bg-white/[0.04] hover:bg-emerald-500/20 border border-white/8 hover:border-emerald-400/35 text-emerald-400 flex items-center justify-center transition-all duration-150 hover:rounded-xl shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Public Rooms Directory */}
        <button
          type="button"
          onClick={onOpenPublicRooms}
          title={t.publicRooms}
          className="relative w-12 h-12 rounded-2xl bg-white/[0.04] hover:bg-blue-500/20 border border-white/8 hover:border-blue-400/35 text-blue-400 flex items-center justify-center transition-all duration-150 hover:rounded-xl shrink-0"
        >
          <Globe className="w-5 h-5" />
          {publicRoomsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
              {publicRoomsCount > 99 ? '99+' : publicRoomsCount}
            </span>
          )}
        </button>

        {/* Join via Code */}
        <button
          type="button"
          onClick={onOpenJoinServer}
          title={t.joinByCode}
          className="w-12 h-12 rounded-2xl bg-white/[0.04] hover:bg-violet-500/20 border border-white/8 hover:border-violet-400/35 text-violet-400 flex items-center justify-center transition-all duration-150 hover:rounded-xl shrink-0"
        >
          <Compass className="w-5 h-5" />
        </button>
      </div>

      <div className="w-8 h-px bg-white/10" />

      {/* Notifications Trigger */}
      <button
        type="button"
        onClick={onOpenNotifications}
        title={t.notifications}
        className="relative w-12 h-12 rounded-2xl bg-white/[0.04] hover:bg-white/10 border border-white/8 text-zinc-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
      >
        <Bell className="w-5 h-5" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        )}
      </button>

      {/* GDPR Privacy Policy */}
      <button
        type="button"
        onClick={onOpenPrivacy}
        title={t.readPrivacyPolicy}
        className="w-12 h-10 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/8 text-zinc-400 hover:text-blue-300 flex items-center justify-center transition-colors shrink-0"
      >
        <ShieldCheck className="w-4 h-4" />
      </button>
    </aside>
  );
};
