import React from 'react';
import { Crown, Shield } from 'lucide-react';
import { PresenceStatus, ServerMember, UserPublic } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { Avatar } from './Avatar';

interface MembersSidebarProps {
  members: ServerMember[];
  usersByUid: Record<string, UserPublic>;
  livePresences: Record<string, PresenceStatus>;
  onSelectMember: (user: UserPublic, role: ServerMember['role']) => void;
}

export const MembersSidebar: React.FC<MembersSidebarProps> = ({
  members,
  usersByUid,
  livePresences,
  onSelectMember,
}) => {
  const { t } = useI18n();

  const enriched = members
    .map((m) => {
      const profile = usersByUid[m.uid];
      if (!profile) return null;
      const effectivePresence =
        profile.presence === 'invisible'
          ? 'invisible'
          : livePresences[m.uid] || profile.presence || 'invisible';
      return { member: m, profile, effectivePresence };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const onlineList = enriched.filter((i) => i.effectivePresence !== 'invisible');
  const offlineList = enriched.filter((i) => i.effectivePresence === 'invisible');

  const renderGroup = (title: string, items: typeof enriched) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="px-2 py-1 text-[11px] font-medium text-zinc-500 tabular-nums">
          {title} — {items.length}
        </div>
        {items.map(({ member, profile, effectivePresence }) => (
          <button
            key={member.uid}
            type="button"
            onClick={() => onSelectMember(profile, member.role)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.05] text-left transition-colors"
          >
            <Avatar
              name={profile.displayName}
              src={profile.avatarDataUrl}
              size="sm"
              presence={effectivePresence}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-medium truncate ${
                    effectivePresence === 'invisible' ? 'text-zinc-500' : 'text-zinc-200'
                  }`}
                >
                  {profile.displayName}
                </span>
                {profile.tag && (
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {profile.tag}
                  </span>
                )}
                {member.role === 'owner' && (
                  <span title={t.ownerRole}>
                    <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                  </span>
                )}
                {member.role === 'admin' && (
                  <span title={t.adminRole}>
                    <Shield className="w-3 h-3 text-blue-400 shrink-0" />
                  </span>
                )}
              </div>
              {profile.customStatus && (
                <div className="text-[11px] text-zinc-500 truncate">{profile.customStatus}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <aside className="w-60 shrink-0 bg-[#101116] border-l border-white/8 overflow-y-auto px-3 py-4 space-y-5 select-none">
      {renderGroup(t.onlineCount, onlineList)}
      {renderGroup(t.offlineCount, offlineList)}
    </aside>
  );
};
