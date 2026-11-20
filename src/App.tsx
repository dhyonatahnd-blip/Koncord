import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ExternalLink,
  Globe,
  Hash,
  Menu,
  MonitorOff,
  MonitorUp,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { ensureSupabaseAnonymousSession } from './lib/supabaseClient';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { pairId } from './lib/validation';
import { useWebSocketSignaling } from './hooks/useWebSocketSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import {
  CategoryDoc,
  ChannelDoc,
  ChannelType,
  MessageRetention,
  PresenceStatus,
  RoomVisibility,
  ServerMember,
  ToastAlert,
  UserPrivate,
  UserPublic,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EntryView } from './components/EntryView';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { MembersSidebar } from './components/MembersSidebar';
import { ChatArea } from './components/ChatArea';
import { VoiceVideoRoom } from './components/VoiceVideoRoom';
import { FriendsAndDmView } from './components/FriendsAndDmView';
import {
  CategoryModal,
  ChannelModal,
  CreateServerModal,
  JoinServerModal,
  MediaConsentModal,
  NotificationsModal,
  ParticipantProfileModal,
  PrivacyPolicyModal,
  PublicRoomsModal,
  ServerSettingsModal,
  UserSettingsModal,
} from './components/Modals';

interface ZoneSession {
  uid: string;
  tag: string;
  displayName: string;
  username: string;
  avatarDataUrl: string;
  initialInviteCode?: string;
}

const ZONE_SESSION_KEY = 'zone_session_v1';
const ZONE_MEDIA_CONSENT_KEY = 'zone_media_consent_v1';

function computeShortTag(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return `#${hash.toString(16).toUpperCase().padStart(4, '0').slice(0, 4)}`;
}

function readUrlInviteCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room') || params.get('invite') || '';
    return room.trim().toUpperCase().slice(0, 16);
  } catch {
    return '';
  }
}

function ZonePlatform() {
  const { t } = useI18n();
  const [urlInviteCode] = useState<string>(readUrlInviteCode);

  const [zoneSession, setZoneSession] = useState<ZoneSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(ZONE_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ZoneSession;
        if (parsed && parsed.uid && parsed.displayName) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return null;
  });

  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [mediaConsentGranted, setMediaConsentGranted] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ZONE_MEDIA_CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [pendingMediaAction, setPendingMediaAction] = useState<(() => void) | null>(null);

  // Navigation & Workspace State
  const [activeMode, setActiveMode] = useState<'server' | 'home'>('server');
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeDmPeerUid, setActiveDmPeerUid] = useState<string | null>(null);
  const [showMembersDrawer, setShowMembersDrawer] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [staticBannerDismissed, setStaticBannerDismissed] = useState(false);

  // Toasts & Modals
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [publicRoomsOpen, setPublicRoomsOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [createServerOpen, setCreateServerOpen] = useState(false);
  const [joinServerOpen, setJoinServerOpen] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [categoryModalState, setCategoryModalState] = useState<{
    open: boolean;
    editing: CategoryDoc | null;
  }>({ open: false, editing: null });
  const [channelModalState, setChannelModalState] = useState<{
    open: boolean;
    editing: ChannelDoc | null;
    defaultCategoryId: string;
  }>({ open: false, editing: null, defaultCategoryId: '' });
  const [selectedProfile, setSelectedProfile] = useState<{
    user: UserPublic;
    role?: ServerMember['role'];
  } | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${t.brandName} — ${t.brandSubtitle}`;
    }
  }, [t.brandName, t.brandSubtitle]);

  const pushToast = useCallback((alert: Omit<ToastAlert, 'id' | 'createdAt'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [{ ...alert, id, createdAt: Date.now() }, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((tItem) => tItem.id !== id));
    }, 4800);
  }, []);

  const handleEnterZone = useCallback(
    async (payload: { nickname: string; avatarDataUrl: string; inviteCode: string }) => {
      const cleanName = payload.nickname.trim().slice(0, 32) || 'Guest';
      const supaUid = await ensureSupabaseAnonymousSession();
      const uid =
        supaUid ||
        `zone_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const tag = computeShortTag(uid);
      const baseUser = cleanName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_.-]/g, '')
        .slice(0, 20);
      const username = `${baseUser || 'guest'}_${uid.slice(-4)}`;
      const session: ZoneSession = {
        uid,
        tag,
        displayName: cleanName,
        username,
        avatarDataUrl: payload.avatarDataUrl,
        initialInviteCode: payload.inviteCode || urlInviteCode || '',
      };

      try {
        sessionStorage.setItem(ZONE_SESSION_KEY, JSON.stringify(session));
      } catch {
        // ignore storage errors
      }
      setBlockedUids([]);
      setNotificationsEnabled(true);
      setActiveMode('server');
      setActiveServerId(null);
      setActiveChannelId(null);
      setActiveDmPeerUid(null);
      setZoneSession(session);
    },
    [urlInviteCode]
  );

  const activeUid = zoneSession?.uid || null;

  const fallbackPublicProfile = useMemo<UserPublic | null>(() => {
    if (!zoneSession) return null;
    const now = Date.now();
    return {
      uid: zoneSession.uid,
      tag: zoneSession.tag,
      displayName: zoneSession.displayName,
      username: zoneSession.username,
      bio: '',
      customStatus: '',
      presence: 'online',
      avatarDataUrl: zoneSession.avatarDataUrl,
      createdAt: now,
      updatedAt: now,
    };
  }, [zoneSession]);

  const fallbackPrivateProfile = useMemo<UserPrivate | null>(() => {
    if (!zoneSession) return null;
    const now = Date.now();
    return {
      uid: zoneSession.uid,
      email: zoneSession.tag,
      blockedUids,
      notificationsEnabled,
      createdAt: now,
      updatedAt: now,
    };
  }, [zoneSession, blockedUids, notificationsEnabled]);

  const alertText = useMemo(
    () => ({
      screenStartedTitle: t.alertScreenStartedTitle,
      screenStartedBody: t.alertScreenStartedBody,
      screenStoppedTitle: t.alertScreenStoppedTitle,
      screenStoppedBody: t.alertScreenStoppedBody,
      peerJoinedTitle: t.alertPeerJoinedTitle,
      peerJoinedBody: t.alertPeerJoinedBody,
      fileExpiredTitle: t.alertFileExpiredTitle,
      fileExpiredBody: t.alertFileExpiredBody,
      roomClosedTitle: t.alertRoomClosedTitle,
      roomClosedBody: t.alertRoomClosedBody,
    }),
    [t]
  );

  const {
    connected,
    usingCloudRealtime,
    usingStaticFallback,
    livePresences,
    voiceRoster,
    typingByChannel,
    instantSnapshot,
    sendSignal,
    subscribeSignal,
  } = useWebSocketSignaling({
    uid: activeUid,
    displayName: fallbackPublicProfile?.displayName || '',
    username: zoneSession?.username,
    avatarDataUrl: fallbackPublicProfile?.avatarDataUrl || '',
    presence: fallbackPublicProfile?.presence || 'online',
    activeServerId,
    initialInviteCode: urlInviteCode || zoneSession?.initialInviteCode || '',
    isInstant: true,
    alertText,
    onAlert: (alert) => {
      if (notificationsEnabled) {
        pushToast(alert);
      }
    },
  });

  useEffect(() => {
    if (!usingStaticFallback) {
      setStaticBannerDismissed(false);
    }
  }, [usingStaticFallback]);

  const effectivePublicProfile: UserPublic | null = zoneSession
    ? instantSnapshot?.usersByUid[zoneSession.uid] || fallbackPublicProfile
    : null;

  const rtc = useWebRTC({
    uid: activeUid,
    displayName: effectivePublicProfile?.displayName || '',
    avatarDataUrl: effectivePublicProfile?.avatarDataUrl || '',
    sendSignal,
    subscribeSignal,
    onAlert: pushToast,
  });

  const rtcRef = useRef(rtc);
  rtcRef.current = rtc;
  const activeServerIdRef = useRef(activeServerId);
  activeServerIdRef.current = activeServerId;
  const pendingJoinedServerRef = useRef<string | null>(null);

  // Subscribe to server create/join/close events
  useEffect(() => {
    if (!zoneSession) return;
    return subscribeSignal((msg) => {
      if (msg.type === 'instant:server-created' || msg.type === 'instant:server-joined') {
        const srvId = String(msg.serverId || '');
        if (srvId) {
          pendingJoinedServerRef.current = srvId;
          setActiveServerId(srvId);
          setActiveMode('server');
        }
      } else if (msg.type === 'zone:room-closed') {
        const closedId = String(msg.serverId || '');
        if (closedId && activeServerIdRef.current === closedId) {
          rtcRef.current.leaveRoom();
          setActiveServerId(null);
          setActiveChannelId(null);
        }
      }
    });
  }, [zoneSession, subscribeSignal]);

  // Toast unread instant notifications
  const seenNotifsRef = useRef<Set<string>>(new Set());
  const notifsBootedRef = useRef(false);
  useEffect(() => {
    if (!zoneSession) {
      seenNotifsRef.current.clear();
      notifsBootedRef.current = false;
      return;
    }
    const list = instantSnapshot?.notifications || [];
    if (notifsBootedRef.current && notificationsEnabled) {
      for (const item of list) {
        if (!item.read && !seenNotifsRef.current.has(item.id)) {
          pushToast({
            type: item.type,
            title: item.title,
            body: item.body,
          });
        }
      }
    }
    if (instantSnapshot) {
      notifsBootedRef.current = true;
      seenNotifsRef.current = new Set(list.filter((i) => !i.read).map((i) => i.id));
    }
  }, [zoneSession, instantSnapshot, notificationsEnabled, pushToast]);

  const effectiveServers = instantSnapshot?.servers || [];
  const publicRooms = instantSnapshot?.publicServers || [];
  const availablePublicRoomsCount = useMemo(
    () => publicRooms.filter((r) => !effectiveServers.some((s) => s.id === r.id)).length,
    [publicRooms, effectiveServers]
  );

  const effectiveServersById = useMemo(() => {
    const map: Record<string, (typeof effectiveServers)[number]> = {};
    effectiveServers.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [effectiveServers]);

  const effectiveMembers = activeServerId
    ? instantSnapshot?.membersByServer[activeServerId] || []
    : [];
  const effectiveCategories = activeServerId
    ? instantSnapshot?.categoriesByServer[activeServerId] || []
    : [];
  const effectiveChannels = activeServerId
    ? instantSnapshot?.channelsByServer[activeServerId] || []
    : [];
  const effectiveUsersByUid = instantSnapshot?.usersByUid || {};
  const effectiveFriendships = instantSnapshot?.friendships || [];
  const effectiveDmThreads = instantSnapshot?.dmThreads || [];
  const effectiveNotifications = instantSnapshot?.notifications || [];

  useEffect(() => {
    if (!zoneSession || effectiveServers.length === 0) return;
    const pendingId = pendingJoinedServerRef.current;
    if (pendingId && effectiveServers.some((s) => s.id === pendingId)) {
      pendingJoinedServerRef.current = null;
      if (activeServerId !== pendingId) {
        setActiveServerId(pendingId);
      }
      return;
    }
    if (!pendingId && (!activeServerId || !effectiveServers.some((s) => s.id === activeServerId))) {
      setActiveServerId(effectiveServers[0].id);
    }
  }, [zoneSession, effectiveServers, activeServerId]);

  useEffect(() => {
    if (!zoneSession) return;
    if (effectiveChannels.length === 0) {
      setActiveChannelId(null);
      return;
    }
    setActiveChannelId((prev) => {
      if (prev && effectiveChannels.some((c) => c.id === prev)) return prev;
      const firstText = effectiveChannels.find((c) => c.type === 'text');
      return (firstText || effectiveChannels[0]).id;
    });
  }, [zoneSession, effectiveChannels]);

  const effectiveActiveChannel = useMemo(
    () => effectiveChannels.find((c) => c.id === activeChannelId) || null,
    [effectiveChannels, activeChannelId]
  );

  const effectiveChannelMessages = effectiveActiveChannel
    ? instantSnapshot?.messagesByChannel[effectiveActiveChannel.id] || []
    : [];
  const effectiveChannelReactions = effectiveActiveChannel
    ? instantSnapshot?.reactionsByChannel[effectiveActiveChannel.id] || []
    : [];

  const activeDmThreadId = useMemo(() => {
    if (!activeUid || !activeDmPeerUid) return null;
    return pairId(activeUid, activeDmPeerUid);
  }, [activeUid, activeDmPeerUid]);

  const effectiveDmMessages = activeDmThreadId
    ? instantSnapshot?.dmMessagesByThread[activeDmThreadId] || []
    : [];
  const effectiveDmReactions = activeDmThreadId
    ? instantSnapshot?.dmReactionsByThread[activeDmThreadId] || []
    : [];

  const activeServer = activeServerId ? effectiveServersById[activeServerId] || null : null;
  const userRoleInServer = effectiveMembers.find((m) => m.uid === activeUid)?.role || 'member';

  const acceptedFriendProfiles = useMemo(() => {
    if (!activeUid) return [];
    return effectiveFriendships
      .filter((f) => f.status === 'accepted')
      .map((f) => {
        const peerUid = f.users.find((u) => u !== activeUid) || '';
        return effectiveUsersByUid[peerUid];
      })
      .filter((u): u is UserPublic => Boolean(u));
  }, [effectiveFriendships, activeUid, effectiveUsersByUid]);

  const unreadNotifications = effectiveNotifications.filter((n) => !n.read).length;

  const withMediaConsent = useCallback(
    (action: () => void) => {
      if (mediaConsentGranted) {
        action();
        return;
      }
      setPendingMediaAction(() => action);
    },
    [mediaConsentGranted]
  );

  const handleSelectChannel = (ch: ChannelDoc) => {
    setActiveMode('server');
    setActiveChannelId(ch.id);
    setMobileNavOpen(false);
    if (ch.type === 'voice' || ch.type === 'video') {
      withMediaConsent(() => {
        rtc.joinRoom({
          serverId: ch.serverId,
          channelId: ch.id,
          channelName: ch.name,
          channelType: ch.type as 'voice' | 'video',
        });
      });
    }
  };

  const handleOpenDmWith = (peerUid: string) => {
    if (!activeUid) return;
    sendSignal({ type: 'instant:dm-open', peerUid });
    setActiveMode('home');
    setActiveDmPeerUid(peerUid);
    setMobileNavOpen(false);
  };

  const handleToggleBlock = async (targetUid: string) => {
    setBlockedUids((prev) =>
      prev.includes(targetUid) ? prev.filter((u) => u !== targetUid) : [...prev, targetUid]
    );
  };

  const handleMoveChannel = async (ch: ChannelDoc, direction: 'up' | 'down') => {
    if (!activeServerId) return;
    sendSignal({
      type: 'instant:channel-move',
      serverId: activeServerId,
      channelId: ch.id,
      direction,
    });
  };

  const lastTypingSentRef = useRef<Record<string, boolean>>({});
  const emitTyping = (channelKey: string, isTyping: boolean) => {
    if (lastTypingSentRef.current[channelKey] === isTyping) return;
    lastTypingSentRef.current[channelKey] = isTyping;
    sendSignal({
      type: isTyping ? 'typing:start' : 'typing:stop',
      channelKey,
    });
  };

  if (!zoneSession || !effectivePublicProfile || !fallbackPrivateProfile) {
    return (
      <>
        <EntryView
          initialInviteCode={urlInviteCode}
          onEnter={handleEnterZone}
          onOpenPrivacy={() => setPrivacyOpen(true)}
        />
        {privacyOpen && <PrivacyPolicyModal onClose={() => setPrivacyOpen(false)} />}
      </>
    );
  }

  const activeTextKey =
    activeMode === 'server' && effectiveActiveChannel ? `ch_${effectiveActiveChannel.id}` : '';
  const activeDmKey =
    activeMode === 'home' && activeDmThreadId ? `dm_${activeDmThreadId}` : '';

  const textTypingUsers = activeTextKey ? Object.values(typingByChannel[activeTextKey] || {}) : [];
  const dmTypingUsers = activeDmKey ? Object.values(typingByChannel[activeDmKey] || {}) : [];

  const handleDeleteCategoryAction = (catId: string) => {
    if (!activeServerId) return;
    sendSignal({ type: 'instant:category-delete', serverId: activeServerId, categoryId: catId });
  };

  const handleDeleteChannelAction = (chId: string) => {
    if (!activeServerId) return;
    sendSignal({ type: 'instant:channel-delete', serverId: activeServerId, channelId: chId });
  };

  const handleLeaveServerAction = () => {
    if (!activeServerId) return;
    sendSignal({ type: 'instant:server-leave', serverId: activeServerId });
    setActiveServerId(null);
  };

  const handleChangePresenceAction = (presence: PresenceStatus) => {
    sendSignal({ type: 'instant:profile-update', updates: { presence } });
  };

  const handleCopyInviteCode = () => {
    if (!activeServer) return;
    navigator.clipboard.writeText(activeServer.inviteCode);
    pushToast({
      type: 'invite',
      title: t.inviteCopied,
      body: `${activeServer.inviteCode}`,
    });
  };

  const handleCopyInviteLink = () => {
    if (!activeServer || typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?room=${activeServer.inviteCode}`;
    navigator.clipboard.writeText(url);
    pushToast({
      type: 'invite',
      title: t.inviteCopied,
      body: t.inviteLinkCopied,
    });
  };

  const handleStartHeaderScreenShare = () => {
    if (rtc.screenSharing) {
      rtc.stopScreenShare();
      return;
    }
    const targetRoomChannel =
      (effectiveActiveChannel && effectiveActiveChannel.type !== 'text'
        ? effectiveActiveChannel
        : null) ||
      effectiveChannels.find((c) => c.type === 'video') ||
      effectiveChannels.find((c) => c.type === 'voice');
    if (!targetRoomChannel) return;

    withMediaConsent(async () => {
      const started = await rtc.startScreenShare({
        serverId: targetRoomChannel.serverId,
        channelId: targetRoomChannel.id,
        channelName: targetRoomChannel.name,
        channelType: targetRoomChannel.type as 'voice' | 'video',
      });
      if (started) {
        setActiveChannelId(targetRoomChannel.id);
      }
    });
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#09090B] text-zinc-100 flex">
      {/* Desktop Navigation Sidebars */}
      <div className="hidden lg:flex h-full shrink-0">
        <ServerSidebar
          servers={effectiveServers}
          activeMode={activeMode}
          activeServerId={activeServerId}
          unreadNotifications={unreadNotifications}
          publicRoomsCount={availablePublicRoomsCount}
          onSelectHome={() => {
            setActiveMode('home');
            setMobileNavOpen(false);
          }}
          onSelectServer={(srvId) => {
            setActiveServerId(srvId);
            setActiveMode('server');
            setMobileNavOpen(false);
          }}
          onOpenPublicRooms={() => setPublicRoomsOpen(true)}
          onOpenCreateServer={() => setCreateServerOpen(true)}
          onOpenJoinServer={() => setJoinServerOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenPrivacy={() => setPrivacyOpen(true)}
        />

        {activeMode === 'server' && activeServer && (
          <ChannelSidebar
            server={activeServer}
            userRole={userRoleInServer}
            categories={effectiveCategories}
            channels={effectiveChannels}
            activeChannelId={activeChannelId}
            voiceRoster={voiceRoster}
            activeVoiceChannel={
              rtc.activeRoom
                ? { channelId: rtc.activeRoom.channelId, channelName: rtc.activeRoom.channelName }
                : null
            }
            micMuted={rtc.micMuted}
            screenSharing={rtc.screenSharing}
            currentUser={effectivePublicProfile}
            onSelectChannel={handleSelectChannel}
            onCreateCategory={() => setCategoryModalState({ open: true, editing: null })}
            onEditCategory={(cat) => setCategoryModalState({ open: true, editing: cat })}
            onDeleteCategory={handleDeleteCategoryAction}
            onCreateChannel={(categoryId) =>
              setChannelModalState({ open: true, editing: null, defaultCategoryId: categoryId })
            }
            onEditChannel={(ch) =>
              setChannelModalState({
                open: true,
                editing: ch,
                defaultCategoryId: ch.categoryId,
              })
            }
            onDeleteChannel={handleDeleteChannelAction}
            onMoveChannel={handleMoveChannel}
            onOpenServerSettings={() => setServerSettingsOpen(true)}
            onLeaveServer={handleLeaveServerAction}
            onCopyInvite={handleCopyInviteCode}
            onCopyInviteLink={handleCopyInviteLink}
            onToggleMic={rtc.toggleMic}
            onDisconnectVoice={rtc.leaveRoom}
            onChangePresence={handleChangePresenceAction}
            onOpenUserSettings={() => setUserSettingsOpen(true)}
          />
        )}
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden flex"
        >
          <div onClick={(e) => e.stopPropagation()} className="flex h-full">
            <ServerSidebar
              servers={effectiveServers}
              activeMode={activeMode}
              activeServerId={activeServerId}
              unreadNotifications={unreadNotifications}
              publicRoomsCount={availablePublicRoomsCount}
              onSelectHome={() => {
                setActiveMode('home');
                setMobileNavOpen(false);
              }}
              onSelectServer={(srvId) => {
                setActiveServerId(srvId);
                setActiveMode('server');
                setMobileNavOpen(false);
              }}
              onOpenPublicRooms={() => {
                setMobileNavOpen(false);
                setPublicRoomsOpen(true);
              }}
              onOpenCreateServer={() => {
                setMobileNavOpen(false);
                setCreateServerOpen(true);
              }}
              onOpenJoinServer={() => {
                setMobileNavOpen(false);
                setJoinServerOpen(true);
              }}
              onOpenNotifications={() => {
                setMobileNavOpen(false);
                setNotificationsOpen(true);
              }}
              onOpenPrivacy={() => {
                setMobileNavOpen(false);
                setPrivacyOpen(true);
              }}
            />
            {activeMode === 'server' && activeServer && (
              <ChannelSidebar
                server={activeServer}
                userRole={userRoleInServer}
                categories={effectiveCategories}
                channels={effectiveChannels}
                activeChannelId={activeChannelId}
                voiceRoster={voiceRoster}
                activeVoiceChannel={
                  rtc.activeRoom
                    ? { channelId: rtc.activeRoom.channelId, channelName: rtc.activeRoom.channelName }
                    : null
                }
                micMuted={rtc.micMuted}
                screenSharing={rtc.screenSharing}
                currentUser={effectivePublicProfile}
                onSelectChannel={handleSelectChannel}
                onCreateCategory={() => setCategoryModalState({ open: true, editing: null })}
                onEditCategory={(cat) => setCategoryModalState({ open: true, editing: cat })}
                onDeleteCategory={handleDeleteCategoryAction}
                onCreateChannel={(categoryId) =>
                  setChannelModalState({ open: true, editing: null, defaultCategoryId: categoryId })
                }
                onEditChannel={(ch) =>
                  setChannelModalState({
                    open: true,
                    editing: ch,
                    defaultCategoryId: ch.categoryId,
                  })
                }
                onDeleteChannel={handleDeleteChannelAction}
                onMoveChannel={handleMoveChannel}
                onOpenServerSettings={() => setServerSettingsOpen(true)}
                onLeaveServer={() => {
                  handleLeaveServerAction();
                  setMobileNavOpen(false);
                }}
                onCopyInvite={handleCopyInviteCode}
                onCopyInviteLink={handleCopyInviteLink}
                onToggleMic={rtc.toggleMic}
                onDisconnectVoice={rtc.leaveRoom}
                onChangePresence={handleChangePresenceAction}
                onOpenUserSettings={() => setUserSettingsOpen(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeMode === 'home' ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="lg:hidden h-12 px-3 border-b border-white/8 bg-[#0E0F14] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-2 rounded-lg text-zinc-300 hover:bg-white/10"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-sm font-semibold">{t.friendsAndDmsTitle}</span>
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="p-2 rounded-lg text-zinc-300 hover:bg-white/10 relative"
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>
          {usingStaticFallback && !staticBannerDismissed && (
            <div className="px-4 py-2 bg-amber-500/12 border-b border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{t.localModeBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setStaticBannerDismissed(true)}
                className="text-amber-300 hover:text-white shrink-0"
                aria-label={t.closeBtn}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <FriendsAndDmView
            currentUser={effectivePublicProfile}
            usingStaticFallback={usingStaticFallback}
            hasFileBackend={!usingStaticFallback && !usingCloudRealtime}
            blockedUids={blockedUids}
            friendships={effectiveFriendships}
            dmThreads={effectiveDmThreads}
            usersByUid={effectiveUsersByUid}
            livePresences={livePresences}
            activeDmPeerUid={activeDmPeerUid}
            dmMessages={effectiveDmMessages}
            dmReactions={effectiveDmReactions}
            typingUsers={dmTypingUsers}
            onSelectFriendsHome={() => setActiveDmPeerUid(null)}
            onOpenDmWith={handleOpenDmWith}
            onSendFriendRequestByUsername={async (uname) => {
              const clean = uname.trim().replace(/^@/, '').toLowerCase();
              const target = Object.values(effectiveUsersByUid).find((u) => {
                if (u.uid === activeUid) return false;
                const dname = u.displayName.toLowerCase();
                const userHandle = u.username.toLowerCase();
                const tag = (u.tag || '').toLowerCase();
                const full = `${dname}${tag}`;
                return (
                  userHandle === clean ||
                  dname === clean ||
                  tag === clean ||
                  tag === `#${clean}` ||
                  full === clean
                );
              });
              if (!target) throw new Error(t.participantNotFound);
              sendSignal({ type: 'instant:friend-request', username: clean, targetUid: target.uid });
            }}
            onRespondFriendRequest={async (fId, accept) => {
              sendSignal({ type: 'instant:friend-respond', friendshipId: fId, accept });
            }}
            onRemoveFriendship={async (fId) => {
              sendSignal({ type: 'instant:friend-remove', friendshipId: fId });
            }}
            onToggleBlockUser={handleToggleBlock}
            onSendDmMessage={async (payload) => {
              if (!activeDmThreadId || !activeDmPeerUid) return;
              sendSignal({
                type: 'instant:dm-send',
                peerUid: activeDmPeerUid,
                content: payload.content,
                attachmentId: payload.attachment?.id,
                attachmentName: payload.attachment?.name || '',
                attachmentType: payload.attachment?.type || '',
                attachmentSize: payload.attachment?.size,
                attachmentDataUrl: payload.attachment?.dataUrl || '',
                attachmentUrl: payload.attachment?.url,
                attachmentExpiresAt: payload.attachment?.expiresAt,
                replyToId: payload.replyTo?.id || '',
                replyToAuthor: payload.replyTo?.authorName || '',
                replyToSnippet: payload.replyTo?.snippet || '',
              });
            }}
            onEditDmMessage={async (msgId, content) => {
              if (activeDmPeerUid) {
                sendSignal({
                  type: 'instant:dm-edit',
                  peerUid: activeDmPeerUid,
                  messageId: msgId,
                  content,
                });
              }
            }}
            onDeleteDmMessage={async (msgId) => {
              if (activeDmPeerUid) {
                sendSignal({
                  type: 'instant:dm-delete',
                  peerUid: activeDmPeerUid,
                  messageId: msgId,
                });
              }
            }}
            onToggleDmReaction={async (msgId, emoji) => {
              if (activeDmPeerUid) {
                sendSignal({
                  type: 'instant:dm-reaction',
                  peerUid: activeDmPeerUid,
                  messageId: msgId,
                  emoji,
                });
              }
            }}
            onTypingChange={(isTyping) => activeDmKey && emitTyping(activeDmKey, isTyping)}
            onOpenUserSettings={() => setUserSettingsOpen(true)}
          />
        </div>
      ) : (
        <div className="flex-1 flex min-w-0 min-h-0">
          <main className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Top Channel Header */}
            <header className="h-14 px-4 sm:px-5 border-b border-white/8 bg-[#0E0F14]/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="lg:hidden p-1.5 rounded-lg text-zinc-300 hover:bg-white/10 shrink-0"
                >
                  <Menu className="w-5 h-5" />
                </button>
                {effectiveActiveChannel && (
                  <>
                    {effectiveActiveChannel.type === 'text' ? (
                      <Hash className="w-5 h-5 text-zinc-400 shrink-0" />
                    ) : effectiveActiveChannel.type === 'voice' ? (
                      <Volume2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Video className="w-5 h-5 text-blue-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h1 className="font-display text-sm font-semibold text-white truncate">
                          {effectiveActiveChannel.name}
                        </h1>
                        {effectiveActiveChannel.topic && (
                          <span className="hidden md:inline text-xs text-zinc-500 truncate max-w-md">
                            · {effectiveActiveChannel.topic}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPublicRoomsOpen(true)}
                  title={t.publicRooms}
                  className="hidden sm:flex px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/8 text-xs text-zinc-200 items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  {t.publicRooms}
                </button>

                {activeServer && effectiveChannels.some((c) => c.type === 'video' || c.type === 'voice') && (
                  <button
                    type="button"
                    onClick={handleStartHeaderScreenShare}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      rtc.screenSharing
                        ? 'bg-sky-500 text-zinc-950 hover:bg-sky-400'
                        : 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/35 text-blue-200'
                    }`}
                  >
                    {rtc.screenSharing ? (
                      <>
                        <MonitorOff className="w-3.5 h-3.5" />
                        {t.stopScreenBtn}
                      </>
                    ) : (
                      <>
                        <MonitorUp className="w-3.5 h-3.5" />
                        {t.shareScreenBtn}
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setNotificationsOpen(true)}
                  title={t.notifications}
                  className="relative p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMembersDrawer((v) => !v)}
                  title={t.membersTitle}
                  className={`p-2 rounded-xl transition-colors ${
                    showMembersDrawer
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/8'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </button>
              </div>
            </header>

            {usingStaticFallback && !staticBannerDismissed && (
              <div className="px-4 py-2 bg-amber-500/12 border-b border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{t.localModeBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStaticBannerDismissed(true)}
                  className="text-amber-300 hover:text-white shrink-0"
                  aria-label={t.closeBtn}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!connected && !usingStaticFallback && (
              <div className="px-4 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-200 shrink-0">
                {t.connectingRealtimeNotice}
              </div>
            )}

            {effectiveActiveChannel?.type === 'text' && rtc.mediaError && (
              <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
                <span>{rtc.mediaError}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {rtc.screenShareBlockedByIframe && (
                    <a
                      href={typeof window !== 'undefined' ? window.location.href : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg bg-amber-400 text-zinc-950 font-semibold flex items-center gap-1.5 hover:bg-amber-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t.openInNewTab}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={rtc.clearMediaError}
                    className="text-amber-300 hover:text-white font-medium px-2 py-0.5"
                  >
                    {t.closeBtn}
                  </button>
                </div>
              </div>
            )}

            {/* Channel Viewport */}
            {!activeServer || !effectiveActiveChannel ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="text-sm text-zinc-300 font-medium mb-3">
                  {t.selectOrCreatePrompt}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setPublicRoomsOpen(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold"
                  >
                    {t.explorePublicRoomsBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateServerOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/14 text-white text-xs font-medium"
                  >
                    {t.createRoom}
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinServerOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/14 text-white text-xs font-medium"
                  >
                    {t.joinByCode}
                  </button>
                </div>
              </div>
            ) : effectiveActiveChannel.type === 'text' ? (
              <ChatArea
                channelKey={activeTextKey}
                serverId={activeServer.id}
                channelId={effectiveActiveChannel.id}
                usingStaticFallback={usingStaticFallback}
                hasFileBackend={!usingStaticFallback && !usingCloudRealtime}
                placeholder={`${t.chatPlaceholder} #${effectiveActiveChannel.name}`}
                messages={effectiveChannelMessages}
                reactions={effectiveChannelReactions}
                currentUser={effectivePublicProfile}
                blockedUids={blockedUids}
                canModerate={userRoleInServer === 'owner' || userRoleInServer === 'admin'}
                typingUsers={textTypingUsers}
                onTypingChange={(isTyping) => activeTextKey && emitTyping(activeTextKey, isTyping)}
                onSendMessage={async (payload) => {
                  if (!activeServerId) return;
                  sendSignal({
                    type: 'instant:message-send',
                    serverId: activeServerId,
                    channelId: effectiveActiveChannel.id,
                    content: payload.content,
                    attachmentId: payload.attachment?.id,
                    attachmentName: payload.attachment?.name || '',
                    attachmentType: payload.attachment?.type || '',
                    attachmentSize: payload.attachment?.size,
                    attachmentDataUrl: payload.attachment?.dataUrl || '',
                    attachmentUrl: payload.attachment?.url,
                    attachmentExpiresAt: payload.attachment?.expiresAt,
                    replyToId: payload.replyTo?.id || '',
                    replyToAuthor: payload.replyTo?.authorName || '',
                    replyToSnippet: payload.replyTo?.snippet || '',
                  });
                }}
                onEditMessage={async (msgId, content) => {
                  if (!activeServerId) return;
                  sendSignal({
                    type: 'instant:message-edit',
                    serverId: activeServerId,
                    channelId: effectiveActiveChannel.id,
                    messageId: msgId,
                    content,
                  });
                }}
                onDeleteMessage={async (msgId) => {
                  if (!activeServerId) return;
                  sendSignal({
                    type: 'instant:message-delete',
                    serverId: activeServerId,
                    channelId: effectiveActiveChannel.id,
                    messageId: msgId,
                  });
                }}
                onToggleReaction={async (msgId, emoji) => {
                  if (!activeServerId) return;
                  sendSignal({
                    type: 'instant:reaction-toggle',
                    serverId: activeServerId,
                    channelId: effectiveActiveChannel.id,
                    messageId: msgId,
                    emoji,
                  });
                }}
                onClickAuthor={(authorUid) => {
                  const user = effectiveUsersByUid[authorUid];
                  const member = effectiveMembers.find((m) => m.uid === authorUid);
                  if (user) {
                    setSelectedProfile({ user, role: member?.role });
                  }
                }}
              />
            ) : (
              <VoiceVideoRoom
                channel={effectiveActiveChannel}
                currentUser={effectivePublicProfile}
                isJoined={rtc.activeRoom?.channelId === effectiveActiveChannel.id}
                livekitActive={rtc.livekitActive}
                peers={rtc.peers}
                rosterPeers={voiceRoster[effectiveActiveChannel.id] || []}
                remoteMedia={rtc.remoteMedia}
                peerVolumes={rtc.peerVolumes}
                speakingUids={rtc.speakingUids}
                micMuted={rtc.micMuted}
                camEnabled={rtc.camEnabled}
                screenSharing={rtc.screenSharing}
                screenHasSystemAudio={rtc.screenHasSystemAudio}
                mediaError={rtc.mediaError}
                screenShareBlockedByIframe={rtc.screenShareBlockedByIframe}
                localCamStream={rtc.localCamStream}
                localScreenStream={rtc.localScreenStream}
                onJoin={() =>
                  withMediaConsent(() => {
                    rtc.joinRoom({
                      serverId: effectiveActiveChannel.serverId,
                      channelId: effectiveActiveChannel.id,
                      channelName: effectiveActiveChannel.name,
                      channelType: effectiveActiveChannel.type as 'voice' | 'video',
                    });
                  })
                }
                onLeave={rtc.leaveRoom}
                onToggleMic={rtc.toggleMic}
                onToggleCam={rtc.toggleCamera}
                onStartScreenShare={() => withMediaConsent(() => rtc.startScreenShare())}
                onStopScreenShare={rtc.stopScreenShare}
                onSetPeerVolume={rtc.setVolumeForPeer}
                onClearError={rtc.clearMediaError}
              />
            )}
          </main>

          {/* Right Members Sidebar */}
          {showMembersDrawer && activeServer && (
            <div className="hidden md:flex h-full shrink-0">
              <MembersSidebar
                currentUserUid={activeUid || undefined}
                members={effectiveMembers}
                usersByUid={effectiveUsersByUid}
                livePresences={livePresences}
                onSelectMember={(user, role) => setSelectedProfile({ user, role })}
              />
            </div>
          )}
        </div>
      )}

      {/* Real-Time Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-xl border border-white/12 glass-elevated p-3.5 shadow-2xl flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{toast.title}</div>
                <div className="text-xs text-zinc-400 mt-0.5 leading-snug">{toast.body}</div>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                className="text-zinc-400 hover:text-white shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {privacyOpen && <PrivacyPolicyModal onClose={() => setPrivacyOpen(false)} />}

      {pendingMediaAction && (
        <MediaConsentModal
          onAccept={() => {
            setMediaConsentGranted(true);
            try {
              sessionStorage.setItem(ZONE_MEDIA_CONSENT_KEY, 'true');
            } catch {
              // ignore storage errors
            }
            const action = pendingMediaAction;
            setPendingMediaAction(null);
            action();
          }}
          onDecline={() => setPendingMediaAction(null)}
        />
      )}

      {publicRoomsOpen && (
        <PublicRoomsModal
          publicRooms={publicRooms}
          joinedServerIds={effectiveServers.map((s) => s.id)}
          onClose={() => setPublicRoomsOpen(false)}
          onJoinPublicRoom={(srvId) => {
            sendSignal({ type: 'instant:server-join', serverId: srvId });
          }}
          onSelectJoinedRoom={(srvId) => {
            setActiveServerId(srvId);
            setActiveMode('server');
          }}
        />
      )}

      {userSettingsOpen && (
        <UserSettingsModal
          publicProfile={effectivePublicProfile}
          privateProfile={fallbackPrivateProfile}
          onClose={() => setUserSettingsOpen(false)}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onSave={async (updates) => {
            sendSignal({
              type: 'instant:profile-update',
              updates: {
                displayName: updates.displayName,
                username: updates.username,
                bio: updates.bio,
                customStatus: updates.customStatus,
                presence: updates.presence,
                avatarDataUrl: updates.avatarDataUrl,
              },
            });
            setNotificationsEnabled(updates.notificationsEnabled);
            const updatedSession: ZoneSession = {
              ...zoneSession,
              displayName: updates.displayName,
              username: updates.username,
              avatarDataUrl: updates.avatarDataUrl,
            };
            setZoneSession(updatedSession);
            try {
              sessionStorage.setItem(ZONE_SESSION_KEY, JSON.stringify(updatedSession));
            } catch {
              // ignore storage errors
            }
          }}
          onLogout={async () => {
            rtc.leaveRoom();
            try {
              sessionStorage.removeItem(ZONE_SESSION_KEY);
            } catch {
              // ignore storage errors
            }
            setZoneSession(null);
            setActiveServerId(null);
            setActiveChannelId(null);
            setActiveDmPeerUid(null);
            setUserSettingsOpen(false);
          }}
        />
      )}

      {createServerOpen && (
        <CreateServerModal
          onClose={() => setCreateServerOpen(false)}
          onCreate={async (data: {
            name: string;
            description: string;
            iconColor: string;
            visibility: RoomVisibility;
            retention: MessageRetention;
            clearOnClose: boolean;
          }) => {
            sendSignal({ type: 'instant:server-create', ...data });
          }}
        />
      )}

      {joinServerOpen && (
        <JoinServerModal
          onClose={() => setJoinServerOpen(false)}
          onJoin={async (code) => {
            sendSignal({ type: 'instant:server-join', inviteCode: code });
          }}
        />
      )}

      {serverSettingsOpen && activeServer && (
        <ServerSettingsModal
          server={activeServer}
          friends={acceptedFriendProfiles}
          isOwner={userRoleInServer === 'owner'}
          onClose={() => setServerSettingsOpen(false)}
          onSave={async (updates) => {
            sendSignal({ type: 'instant:server-update', serverId: activeServer.id, ...updates });
          }}
          onInviteFriend={async (friendUid) => {
            sendSignal({
              type: 'instant:invite-notify',
              recipientId: friendUid,
              serverId: activeServer.id,
            });
          }}
          onCloseRoom={async () => {
            rtc.leaveRoom();
            sendSignal({ type: 'instant:server-close', serverId: activeServer.id });
          }}
        />
      )}

      {categoryModalState.open && activeServerId && (
        <CategoryModal
          initial={categoryModalState.editing}
          onClose={() => setCategoryModalState({ open: false, editing: null })}
          onSubmit={async (name) => {
            if (categoryModalState.editing) {
              sendSignal({
                type: 'instant:category-update',
                serverId: activeServerId,
                categoryId: categoryModalState.editing.id,
                name,
              });
            } else {
              sendSignal({ type: 'instant:category-create', serverId: activeServerId, name });
            }
          }}
        />
      )}

      {channelModalState.open && activeServerId && (
        <ChannelModal
          initial={channelModalState.editing}
          categories={effectiveCategories}
          defaultCategoryId={
            channelModalState.defaultCategoryId || effectiveCategories[0]?.id || ''
          }
          onClose={() =>
            setChannelModalState({ open: false, editing: null, defaultCategoryId: '' })
          }
          onSubmit={async (data: {
            name: string;
            topic: string;
            type: ChannelType;
            categoryId: string;
          }) => {
            if (channelModalState.editing) {
              sendSignal({
                type: 'instant:channel-update',
                serverId: activeServerId,
                channelId: channelModalState.editing.id,
                name: data.name,
                topic: data.topic,
                channelType: data.type,
                categoryId: data.categoryId,
              });
            } else {
              sendSignal({
                type: 'instant:channel-create',
                serverId: activeServerId,
                categoryId: data.categoryId,
                name: data.name,
                topic: data.topic,
                channelType: data.type,
              });
            }
          }}
        />
      )}

      {selectedProfile && (
        <ParticipantProfileModal
          user={selectedProfile.user}
          roleInServer={selectedProfile.role}
          currentUserUid={effectivePublicProfile.uid}
          viewerRoleInServer={userRoleInServer}
          isFriend={effectiveFriendships.some(
            (f) => f.status === 'accepted' && f.users.includes(selectedProfile.user.uid)
          )}
          isBlocked={blockedUids.includes(selectedProfile.user.uid)}
          canInviteToRoom={Boolean(
            activeServer && !effectiveMembers.some((m) => m.uid === selectedProfile.user.uid)
          )}
          onClose={() => setSelectedProfile(null)}
          onSendDm={() => handleOpenDmWith(selectedProfile.user.uid)}
          onAddFriend={async () => {
            sendSignal({
              type: 'instant:friend-request',
              targetUid: selectedProfile.user.uid,
            });
          }}
          onInviteToRoom={
            activeServer
              ? async () => {
                  sendSignal({
                    type: 'instant:invite-notify',
                    recipientId: selectedProfile.user.uid,
                    serverId: activeServer.id,
                  });
                }
              : undefined
          }
          onToggleBlock={() => handleToggleBlock(selectedProfile.user.uid)}
          onToggleAdminRole={
            activeServerId
              ? async (nextRole) => {
                  sendSignal({
                    type: 'instant:member-role',
                    serverId: activeServerId,
                    targetUid: selectedProfile.user.uid,
                    role: nextRole,
                  });
                }
              : undefined
          }
        />
      )}

      {notificationsOpen && (
        <NotificationsModal
          notifications={effectiveNotifications}
          onClose={() => setNotificationsOpen(false)}
          onMarkAllRead={async () => {
            sendSignal({ type: 'instant:notification-read', all: true });
          }}
          onClickNotification={async (n) => {
            if (!n.read) {
              sendSignal({ type: 'instant:notification-read', notificationId: n.id });
            }
            setNotificationsOpen(false);
            if (n.type === 'dm' && n.linkUserId) {
              handleOpenDmWith(n.linkUserId);
            } else if (n.type === 'friend_request') {
              setActiveMode('home');
              setActiveDmPeerUid(null);
            } else if (n.linkServerId && effectiveServersById[n.linkServerId]) {
              setActiveServerId(n.linkServerId);
              setActiveMode('server');
              if (n.linkChannelId) setActiveChannelId(n.linkChannelId);
            } else if (n.type === 'invite' && (n.inviteCode || n.linkServerId)) {
              sendSignal({
                type: 'instant:server-join',
                inviteCode: n.inviteCode || undefined,
                serverId: n.inviteCode ? undefined : n.linkServerId,
              });
              setActiveMode('server');
            }
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ZonePlatform />
      </I18nProvider>
    </ErrorBoundary>
  );
}
