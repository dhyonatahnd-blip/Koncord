import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  Bell,
  ExternalLink,
  Hash,
  Menu,
  MonitorOff,
  MonitorUp,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  createCategory,
  createChannel,
  createNotification,
  createServer,
  deleteCategory,
  deleteChannel,
  deleteChannelMessage,
  deleteDmMessage,
  editChannelMessage,
  editDmMessage,
  ensureUserProfiles,
  findUserByUsername,
  getOrCreateDmThread,
  joinServerByInviteCode,
  leaveServer,
  markAllNotificationsRead,
  markNotificationRead,
  removeFriendship,
  respondFriendRequest,
  sendChannelMessage,
  sendDmMessage,
  sendFriendRequest,
  toggleChannelReaction,
  toggleDmReaction,
  updateCategory,
  updateChannel,
  updateMemberRole,
  updateServerInfo,
  updateUserPrivatePreferences,
  updateUserPublicProfile,
} from './lib/firestoreService';
import { pairId } from './lib/validation';
import { useWebSocketSignaling } from './hooks/useWebSocketSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import {
  CategoryDoc,
  ChannelDoc,
  ChannelType,
  ChatMessage,
  DmThread,
  FriendshipDoc,
  MessageReaction,
  NotificationItem,
  PresenceStatus,
  ServerDoc,
  ServerMember,
  ServerMembership,
  ToastAlert,
  UserPrivate,
  UserPublic,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthView } from './components/AuthView';
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
  NotificationsModal,
  ParticipantProfileModal,
  ServerSettingsModal,
  UserSettingsModal,
} from './components/Modals';

interface GuestSession {
  uid: string;
  displayName: string;
  username: string;
}

const INSTANT_SESSION_KEY = 'vesper_instant_session';

function VesperPlatform() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [publicProfile, setPublicProfile] = useState<UserPublic | null>(null);
  const [privateProfile, setPrivateProfile] = useState<UserPrivate | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Instant (No-Account / No-Database) Session State
  const [guestSession, setGuestSession] = useState<GuestSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(INSTANT_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GuestSession;
        if (parsed && parsed.uid && parsed.displayName) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return null;
  });
  const [guestBlockedUids, setGuestBlockedUids] = useState<string[]>([]);
  const [guestNotificationsEnabled, setGuestNotificationsEnabled] = useState(true);

  // Navigation & Workspace State
  const [activeMode, setActiveMode] = useState<'server' | 'home'>('server');
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeDmPeerUid, setActiveDmPeerUid] = useState<string | null>(null);
  const [showMembersDrawer, setShowMembersDrawer] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Firestore Collections State
  const [memberships, setMemberships] = useState<ServerMembership[]>([]);
  const [serversById, setServersById] = useState<Record<string, ServerDoc>>({});
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [channels, setChannels] = useState<ChannelDoc[]>([]);
  const [channelMessages, setChannelMessages] = useState<ChatMessage[]>([]);
  const [channelReactions, setChannelReactions] = useState<MessageReaction[]>([]);
  const [friendships, setFriendships] = useState<FriendshipDoc[]>([]);
  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [dmMessages, setDmMessages] = useState<ChatMessage[]>([]);
  const [dmReactions, setDmReactions] = useState<MessageReaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [usersByUid, setUsersByUid] = useState<Record<string, UserPublic>>({});

  // Toasts & Modals
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
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

  const pushToast = useCallback((alert: Omit<ToastAlert, 'id' | 'createdAt'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [{ ...alert, id, createdAt: Date.now() }, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4800);
  }, []);

  const handleEnterInstantMode = useCallback((rawName: string) => {
    const cleanName = rawName.trim().slice(0, 48) || 'Visitante';
    const uid = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const baseUser = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 20);
    const username = `${baseUser || 'visitante'}_${uid.slice(-4)}`;
    const session: GuestSession = { uid, displayName: cleanName, username };
    try {
      sessionStorage.setItem(INSTANT_SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore storage errors
    }
    setGuestBlockedUids([]);
    setGuestNotificationsEnabled(true);
    setActiveMode('server');
    setActiveServerId(null);
    setActiveChannelId(null);
    setActiveDmPeerUid(null);
    setGuestSession(session);
  }, []);

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user && user.emailVerified) {
        setBootstrapping(true);
        try {
          const pendingUsername = sessionStorage.getItem('vesper_pending_username') || undefined;
          if (pendingUsername) sessionStorage.removeItem('vesper_pending_username');
          const { publicProfile: pub, privateProfile: priv } = await ensureUserProfiles(
            user,
            user.displayName || undefined,
            pendingUsername
          );
          setPublicProfile(pub);
          setPrivateProfile(priv);
        } finally {
          setBootstrapping(false);
        }
      } else {
        setPublicProfile(null);
        setPrivateProfile(null);
      }
    });
  }, []);

  const isInstant = Boolean(guestSession);
  const verifiedUid =
    !isInstant && firebaseUser && firebaseUser.emailVerified && publicProfile
      ? firebaseUser.uid
      : null;
  const activeUid = isInstant ? guestSession!.uid : verifiedUid;

  const fallbackInstantPublicProfile = useMemo<UserPublic | null>(() => {
    if (!guestSession) return null;
    const now = Date.now();
    return {
      uid: guestSession.uid,
      displayName: guestSession.displayName,
      username: guestSession.username,
      bio: 'Conectado via Modo Instantâneo Vesper.',
      customStatus: '',
      presence: 'online',
      avatarDataUrl: '',
      createdAt: now,
      updatedAt: now,
    };
  }, [guestSession]);

  const fallbackInstantPrivateProfile = useMemo<UserPrivate | null>(() => {
    if (!guestSession) return null;
    const now = Date.now();
    return {
      uid: guestSession.uid,
      email: 'Modo Instantâneo (sem conta)',
      blockedUids: guestBlockedUids,
      notificationsEnabled: guestNotificationsEnabled,
      createdAt: now,
      updatedAt: now,
    };
  }, [guestSession, guestBlockedUids, guestNotificationsEnabled]);

  // Real-time WebSocket signaling & presence
  const {
    livePresences,
    voiceRoster,
    typingByChannel,
    instantSnapshot,
    sendSignal,
    subscribeSignal,
  } = useWebSocketSignaling({
    uid: activeUid,
    displayName:
      (isInstant
        ? fallbackInstantPublicProfile?.displayName
        : publicProfile?.displayName) || '',
    username: isInstant ? guestSession?.username : publicProfile?.username,
    avatarDataUrl:
      (isInstant
        ? fallbackInstantPublicProfile?.avatarDataUrl
        : publicProfile?.avatarDataUrl) || '',
    presence:
      (isInstant
        ? fallbackInstantPublicProfile?.presence
        : publicProfile?.presence) || 'online',
    activeServerId,
    isInstant,
    onAlert: (alert) => {
      const enabled = isInstant
        ? guestNotificationsEnabled
        : privateProfile?.notificationsEnabled !== false;
      if (enabled) {
        pushToast(alert);
      }
    },
  });

  const effectivePublicProfile: UserPublic | null = isInstant
    ? instantSnapshot?.usersByUid[guestSession!.uid] || fallbackInstantPublicProfile
    : publicProfile;

  const effectivePrivateProfile: UserPrivate | null = isInstant
    ? fallbackInstantPrivateProfile
    : privateProfile;

  // Real WebRTC Voice, Video & Screen Sharing Engine
  const rtc = useWebRTC({
    uid: activeUid,
    displayName: effectivePublicProfile?.displayName || '',
    avatarDataUrl: effectivePublicProfile?.avatarDataUrl || '',
    sendSignal,
    subscribeSignal,
    onAlert: pushToast,
  });

  // Subscribe to Instant Mode server create/join confirmations
  useEffect(() => {
    if (!isInstant) return;
    return subscribeSignal((msg) => {
      if (msg.type === 'instant:server-created' || msg.type === 'instant:server-joined') {
        const srvId = String(msg.serverId || '');
        if (srvId) {
          setActiveServerId(srvId);
          setActiveMode('server');
        }
      }
    });
  }, [isInstant, subscribeSignal]);

  // Toast new unread notifications in Instant Mode
  const seenInstantNotifsRef = useRef<Set<string>>(new Set());
  const instantNotifsBootedRef = useRef(false);
  useEffect(() => {
    if (!isInstant) {
      seenInstantNotifsRef.current.clear();
      instantNotifsBootedRef.current = false;
      return;
    }
    const list = instantSnapshot?.notifications || [];
    if (instantNotifsBootedRef.current && guestNotificationsEnabled) {
      for (const item of list) {
        if (!item.read && !seenInstantNotifsRef.current.has(item.id)) {
          pushToast({
            type: item.type,
            title: item.title,
            body: item.body,
          });
        }
      }
    }
    if (instantSnapshot) {
      instantNotifsBootedRef.current = true;
      seenInstantNotifsRef.current = new Set(list.filter((i) => !i.read).map((i) => i.id));
    }
  }, [isInstant, instantSnapshot, guestNotificationsEnabled, pushToast]);

  // Subscribe to own public & private profile + memberships + friendships + DMs + notifications
  useEffect(() => {
    if (!verifiedUid) return;

    const unsubPub = onSnapshot(
      doc(db, 'usersPublic', verifiedUid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserPublic;
          setPublicProfile(data);
          setUsersByUid((prev) => ({ ...prev, [verifiedUid]: data }));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `usersPublic/${verifiedUid}`)
    );

    const unsubPriv = onSnapshot(
      doc(db, 'usersPrivate', verifiedUid),
      (snap) => {
        if (snap.exists()) {
          setPrivateProfile(snap.data() as UserPrivate);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `usersPrivate/${verifiedUid}`)
    );

    const unsubMemberships = onSnapshot(
      query(collection(db, 'serverMemberships'), where('userId', '==', verifiedUid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ServerMembership);
        setMemberships(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'serverMemberships')
    );

    const unsubFriendships = onSnapshot(
      query(collection(db, 'friendships'), where('users', 'array-contains', verifiedUid)),
      (snap) => {
        setFriendships(snap.docs.map((d) => d.data() as FriendshipDoc));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );

    const unsubDms = onSnapshot(
      query(collection(db, 'dmThreads'), where('participants', 'array-contains', verifiedUid)),
      (snap) => {
        setDmThreads(snap.docs.map((d) => d.data() as DmThread));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'dmThreads')
    );

    const prevUnreadIds = new Set<string>();
    let initialNotifsLoaded = false;

    const unsubNotifs = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('recipientId', '==', verifiedUid),
        limit(50)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as NotificationItem)
          .sort((a, b) => {
            const ta =
              a.createdAt && typeof (a.createdAt as { toMillis?: () => number }).toMillis === 'function'
                ? (a.createdAt as { toMillis: () => number }).toMillis()
                : 0;
            const tb =
              b.createdAt && typeof (b.createdAt as { toMillis?: () => number }).toMillis === 'function'
                ? (b.createdAt as { toMillis: () => number }).toMillis()
                : 0;
            return tb - ta;
          });
        if (initialNotifsLoaded) {
          for (const item of list) {
            if (!item.read && !prevUnreadIds.has(item.id)) {
              pushToast({
                type: item.type,
                title: item.title,
                body: item.body,
              });
            }
          }
        }
        initialNotifsLoaded = true;
        prevUnreadIds.clear();
        list.forEach((i) => {
          if (!i.read) prevUnreadIds.add(i.id);
        });
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubPub();
      unsubPriv();
      unsubMemberships();
      unsubFriendships();
      unsubDms();
      unsubNotifs();
    };
  }, [verifiedUid, pushToast]);

  // Subscribe to each joined Server document
  useEffect(() => {
    if (!verifiedUid) return;
    const unsubs: (() => void)[] = [];
    const serverIds = memberships.map((m) => m.serverId);

    for (const srvId of serverIds) {
      const unsub = onSnapshot(
        doc(db, 'servers', srvId),
        (snap) => {
          if (snap.exists()) {
            setServersById((prev) => ({ ...prev, [srvId]: snap.data() as ServerDoc }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `servers/${srvId}`)
      );
      unsubs.push(unsub);
    }

    if (serverIds.length > 0 && (!activeServerId || !serverIds.includes(activeServerId))) {
      setActiveServerId(serverIds[0]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [verifiedUid, memberships, activeServerId]);

  // Subscribe to active server's members, categories, and channels
  useEffect(() => {
    if (!verifiedUid || !activeServerId) {
      setMembers([]);
      setCategories([]);
      setChannels([]);
      return;
    }

    const unsubMembers = onSnapshot(
      collection(db, 'servers', activeServerId, 'members'),
      (snap) => {
        setMembers(snap.docs.map((d) => d.data() as ServerMember));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `servers/${activeServerId}/members`)
    );

    const unsubCategories = onSnapshot(
      collection(db, 'servers', activeServerId, 'categories'),
      (snap) => {
        setCategories(snap.docs.map((d) => d.data() as CategoryDoc));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `servers/${activeServerId}/categories`)
    );

    const unsubChannels = onSnapshot(
      collection(db, 'servers', activeServerId, 'channels'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ChannelDoc);
        setChannels(list);
        if (list.length > 0) {
          setActiveChannelId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev;
            const firstText = list.find((c) => c.type === 'text');
            return (firstText || list[0]).id;
          });
        } else {
          setActiveChannelId(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `servers/${activeServerId}/channels`)
    );

    return () => {
      unsubMembers();
      unsubCategories();
      unsubChannels();
    };
  }, [verifiedUid, activeServerId]);

  // Subscribe to public profiles of all relevant users (members, friends, DM peers, blocked)
  const watchedUidsKey = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => set.add(m.uid));
    friendships.forEach((f) => f.users.forEach((u) => set.add(u)));
    dmThreads.forEach((t) => t.participants.forEach((u) => set.add(u)));
    privateProfile?.blockedUids?.forEach((u) => set.add(u));
    if (verifiedUid) set.delete(verifiedUid);
    return Array.from(set).sort().join(',');
  }, [members, friendships, dmThreads, privateProfile?.blockedUids, verifiedUid]);

  useEffect(() => {
    if (!verifiedUid || !watchedUidsKey) return;
    const uids = watchedUidsKey.split(',').filter(Boolean);
    const unsubs = uids.map((targetUid) =>
      onSnapshot(
        doc(db, 'usersPublic', targetUid),
        (snap) => {
          if (snap.exists()) {
            setUsersByUid((prev) => ({ ...prev, [targetUid]: snap.data() as UserPublic }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `usersPublic/${targetUid}`)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [verifiedUid, watchedUidsKey]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  // Subscribe to active text channel messages & reactions
  useEffect(() => {
    if (
      !verifiedUid ||
      activeMode !== 'server' ||
      !activeServerId ||
      !activeChannel ||
      activeChannel.type !== 'text'
    ) {
      setChannelMessages([]);
      setChannelReactions([]);
      return;
    }

    const msgQuery = query(
      collection(db, 'servers', activeServerId, 'channels', activeChannel.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(150)
    );
    const unsubMsgs = onSnapshot(
      msgQuery,
      (snap) => {
        setChannelMessages(snap.docs.map((d) => d.data() as ChatMessage));
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `servers/${activeServerId}/channels/${activeChannel.id}/messages`
        )
    );

    const unsubReacts = onSnapshot(
      collection(db, 'servers', activeServerId, 'channels', activeChannel.id, 'reactions'),
      (snap) => {
        setChannelReactions(snap.docs.map((d) => d.data() as MessageReaction));
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `servers/${activeServerId}/channels/${activeChannel.id}/reactions`
        )
    );

    return () => {
      unsubMsgs();
      unsubReacts();
    };
  }, [verifiedUid, activeMode, activeServerId, activeChannel]);

  // Subscribe to active DM thread messages & reactions
  const activeDmThreadId = useMemo(() => {
    if (!activeUid || !activeDmPeerUid) return null;
    return pairId(activeUid, activeDmPeerUid);
  }, [activeUid, activeDmPeerUid]);

  useEffect(() => {
    if (!verifiedUid || activeMode !== 'home' || !activeDmThreadId) {
      setDmMessages([]);
      setDmReactions([]);
      return;
    }

    const unsubMsgs = onSnapshot(
      query(
        collection(db, 'dmThreads', activeDmThreadId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(150)
      ),
      (snap) => {
        setDmMessages(snap.docs.map((d) => d.data() as ChatMessage));
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `dmThreads/${activeDmThreadId}/messages`)
    );

    const unsubReacts = onSnapshot(
      collection(db, 'dmThreads', activeDmThreadId, 'reactions'),
      (snap) => {
        setDmReactions(snap.docs.map((d) => d.data() as MessageReaction));
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `dmThreads/${activeDmThreadId}/reactions`)
    );

    return () => {
      unsubMsgs();
      unsubReacts();
    };
  }, [verifiedUid, activeMode, activeDmThreadId]);

  // Derived collections (seamlessly unified across Firebase & Instant Mode)
  const effectiveServers = useMemo(() => {
    if (isInstant) return instantSnapshot?.servers || [];
    return memberships.map((m) => serversById[m.serverId]).filter((s): s is ServerDoc => Boolean(s));
  }, [isInstant, instantSnapshot?.servers, memberships, serversById]);

  const effectiveServersById = useMemo(() => {
    if (isInstant) {
      const map: Record<string, ServerDoc> = {};
      (instantSnapshot?.servers || []).forEach((s) => {
        map[s.id] = s;
      });
      return map;
    }
    return serversById;
  }, [isInstant, instantSnapshot?.servers, serversById]);

  const effectiveMembers = useMemo(
    () => (isInstant ? (activeServerId ? instantSnapshot?.membersByServer[activeServerId] || [] : []) : members),
    [isInstant, instantSnapshot?.membersByServer, activeServerId, members]
  );

  const effectiveCategories = useMemo(
    () => (isInstant ? (activeServerId ? instantSnapshot?.categoriesByServer[activeServerId] || [] : []) : categories),
    [isInstant, instantSnapshot?.categoriesByServer, activeServerId, categories]
  );

  const effectiveChannels = useMemo(
    () => (isInstant ? (activeServerId ? instantSnapshot?.channelsByServer[activeServerId] || [] : []) : channels),
    [isInstant, instantSnapshot?.channelsByServer, activeServerId, channels]
  );

  const effectiveUsersByUid = useMemo(
    () => (isInstant ? instantSnapshot?.usersByUid || {} : usersByUid),
    [isInstant, instantSnapshot?.usersByUid, usersByUid]
  );

  const effectiveFriendships = useMemo(
    () => (isInstant ? instantSnapshot?.friendships || [] : friendships),
    [isInstant, instantSnapshot?.friendships, friendships]
  );

  const effectiveDmThreads = useMemo(
    () => (isInstant ? instantSnapshot?.dmThreads || [] : dmThreads),
    [isInstant, instantSnapshot?.dmThreads, dmThreads]
  );

  const effectiveNotifications = useMemo(
    () => (isInstant ? instantSnapshot?.notifications || [] : notifications),
    [isInstant, instantSnapshot?.notifications, notifications]
  );

  // Auto-select server & channel in Instant Mode
  useEffect(() => {
    if (!isInstant || effectiveServers.length === 0) return;
    if (!activeServerId || !effectiveServers.some((s) => s.id === activeServerId)) {
      setActiveServerId(effectiveServers[0].id);
    }
  }, [isInstant, effectiveServers, activeServerId]);

  useEffect(() => {
    if (!isInstant) return;
    if (effectiveChannels.length === 0) {
      setActiveChannelId(null);
      return;
    }
    setActiveChannelId((prev) => {
      if (prev && effectiveChannels.some((c) => c.id === prev)) return prev;
      const firstText = effectiveChannels.find((c) => c.type === 'text');
      return (firstText || effectiveChannels[0]).id;
    });
  }, [isInstant, effectiveChannels]);

  const effectiveActiveChannel = useMemo(
    () => effectiveChannels.find((c) => c.id === activeChannelId) || null,
    [effectiveChannels, activeChannelId]
  );

  const effectiveChannelMessages = useMemo(
    () =>
      isInstant
        ? effectiveActiveChannel
          ? instantSnapshot?.messagesByChannel[effectiveActiveChannel.id] || []
          : []
        : channelMessages,
    [isInstant, effectiveActiveChannel, instantSnapshot?.messagesByChannel, channelMessages]
  );

  const effectiveChannelReactions = useMemo(
    () =>
      isInstant
        ? effectiveActiveChannel
          ? instantSnapshot?.reactionsByChannel[effectiveActiveChannel.id] || []
          : []
        : channelReactions,
    [isInstant, effectiveActiveChannel, instantSnapshot?.reactionsByChannel, channelReactions]
  );

  const effectiveDmMessages = useMemo(
    () =>
      isInstant
        ? activeDmThreadId
          ? instantSnapshot?.dmMessagesByThread[activeDmThreadId] || []
          : []
        : dmMessages,
    [isInstant, activeDmThreadId, instantSnapshot?.dmMessagesByThread, dmMessages]
  );

  const effectiveDmReactions = useMemo(
    () =>
      isInstant
        ? activeDmThreadId
          ? instantSnapshot?.dmReactionsByThread[activeDmThreadId] || []
          : []
        : dmReactions,
    [isInstant, activeDmThreadId, instantSnapshot?.dmReactionsByThread, dmReactions]
  );

  const activeServer = activeServerId ? effectiveServersById[activeServerId] || null : null;
  const activeMembership = memberships.find((m) => m.serverId === activeServerId) || null;
  const userRoleInServer = isInstant
    ? effectiveMembers.find((m) => m.uid === activeUid)?.role || 'member'
    : activeMembership?.role || 'member';
  const blockedUids = effectivePrivateProfile?.blockedUids || [];

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

  // Handlers
  const handleSelectChannel = async (ch: ChannelDoc) => {
    setActiveMode('server');
    setActiveChannelId(ch.id);
    setMobileNavOpen(false);
    if (ch.type === 'voice' || ch.type === 'video') {
      await rtc.joinRoom({
        serverId: ch.serverId,
        channelId: ch.id,
        channelName: ch.name,
        channelType: ch.type,
      });
    }
  };

  const handleOpenDmWith = async (peerUid: string) => {
    if (!activeUid) return;
    if (isInstant) {
      sendSignal({ type: 'instant:dm-open', peerUid });
    } else {
      await getOrCreateDmThread(activeUid, peerUid);
    }
    setActiveMode('home');
    setActiveDmPeerUid(peerUid);
    setMobileNavOpen(false);
  };

  const handleToggleBlock = async (targetUid: string) => {
    if (!activeUid || !effectivePrivateProfile) return;
    const isCurrentlyBlocked = blockedUids.includes(targetUid);
    const next = isCurrentlyBlocked
      ? blockedUids.filter((u) => u !== targetUid)
      : [...blockedUids, targetUid];
    if (isInstant) {
      setGuestBlockedUids(next);
    } else {
      await updateUserPrivatePreferences(activeUid, { blockedUids: next });
    }
  };

  const handleMoveChannel = async (ch: ChannelDoc, direction: 'up' | 'down') => {
    if (!activeServerId) return;
    if (isInstant) {
      sendSignal({
        type: 'instant:channel-move',
        serverId: activeServerId,
        channelId: ch.id,
        direction,
      });
      return;
    }
    const siblings = channels
      .filter((c) => c.categoryId === ch.categoryId)
      .sort((a, b) => a.position - b.position);
    const idx = siblings.findIndex((c) => c.id === ch.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const target = siblings[swapIdx];
    await Promise.all([
      updateChannel(activeServerId, ch.id, { position: target.position }),
      updateChannel(activeServerId, target.id, { position: ch.position }),
    ]);
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

  if (!isInstant && (!authReady || bootstrapping)) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center animate-pulse">
            <span className="font-display font-bold text-white">V</span>
          </div>
          <span className="text-xs text-zinc-400">Inicializando Vesper...</span>
        </div>
      </div>
    );
  }

  if (
    !effectivePublicProfile ||
    !effectivePrivateProfile ||
    (!isInstant && (!firebaseUser || !firebaseUser.emailVerified))
  ) {
    return (
      <AuthView
        unverifiedUser={firebaseUser && !firebaseUser.emailVerified ? firebaseUser : null}
        onVerifiedRefresh={async () => {
          if (auth.currentUser) {
            await auth.currentUser.reload();
            const refreshed = auth.currentUser;
            setFirebaseUser(refreshed);
            if (refreshed.emailVerified) {
              const { publicProfile: pub, privateProfile: priv } = await ensureUserProfiles(refreshed);
              setPublicProfile(pub);
              setPrivateProfile(priv);
            }
          }
        }}
        onEnterInstantMode={handleEnterInstantMode}
      />
    );
  }

  const activeTextKey =
    activeMode === 'server' && effectiveActiveChannel ? `ch_${effectiveActiveChannel.id}` : '';
  const activeDmKey =
    activeMode === 'home' && activeDmThreadId ? `dm_${activeDmThreadId}` : '';

  const textTypingUsers = activeTextKey ? Object.values(typingByChannel[activeTextKey] || {}) : [];
  const dmTypingUsers = activeDmKey ? Object.values(typingByChannel[activeDmKey] || {}) : [];

  const handleDeleteCategoryAction = async (catId: string) => {
    if (!activeServerId) return;
    if (isInstant) {
      sendSignal({ type: 'instant:category-delete', serverId: activeServerId, categoryId: catId });
    } else {
      await deleteCategory(activeServerId, catId);
    }
  };

  const handleDeleteChannelAction = async (chId: string) => {
    if (!activeServerId) return;
    if (isInstant) {
      sendSignal({ type: 'instant:channel-delete', serverId: activeServerId, channelId: chId });
    } else {
      await deleteChannel(activeServerId, chId);
    }
  };

  const handleLeaveServerAction = async () => {
    if (!activeServerId || !activeUid) return;
    if (isInstant) {
      sendSignal({ type: 'instant:server-leave', serverId: activeServerId });
    } else {
      await leaveServer(activeServerId, activeUid);
    }
    setActiveServerId(null);
  };

  const handleChangePresenceAction = (presence: PresenceStatus) => {
    if (isInstant) {
      sendSignal({ type: 'instant:profile-update', updates: { presence } });
    } else {
      updateUserPublicProfile(effectivePublicProfile.uid, { presence });
    }
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
          onSelectHome={() => {
            setActiveMode('home');
            setMobileNavOpen(false);
          }}
          onSelectServer={(srvId) => {
            setActiveServerId(srvId);
            setActiveMode('server');
            setMobileNavOpen(false);
          }}
          onOpenCreateServer={() => setCreateServerOpen(true)}
          onOpenJoinServer={() => setJoinServerOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
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
            onCopyInvite={() => {
              navigator.clipboard.writeText(activeServer.inviteCode);
              pushToast({
                type: 'invite',
                title: 'Convite copiado',
                body: `Código ${activeServer.inviteCode} copiado para a área de transferência.`,
              });
            }}
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
              onSelectHome={() => {
                setActiveMode('home');
                setMobileNavOpen(false);
              }}
              onSelectServer={(srvId) => {
                setActiveServerId(srvId);
                setActiveMode('server');
                setMobileNavOpen(false);
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
                onLeaveServer={async () => {
                  await handleLeaveServerAction();
                  setMobileNavOpen(false);
                }}
                onCopyInvite={() => {
                  navigator.clipboard.writeText(activeServer.inviteCode);
                  pushToast({
                    type: 'invite',
                    title: 'Convite copiado',
                    body: `Código ${activeServer.inviteCode} copiado.`,
                  });
                }}
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
          {/* Mobile Bar for Home */}
          <div className="lg:hidden h-12 px-3 border-b border-white/8 bg-[#0E0F14] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-2 rounded-lg text-zinc-300 hover:bg-white/10"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-sm font-semibold">Amigos & Mensagens</span>
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="p-2 rounded-lg text-zinc-300 hover:bg-white/10 relative"
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>
          <FriendsAndDmView
            currentUser={effectivePublicProfile}
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
              if (isInstant) {
                const clean = uname.replace(/^@/, '').toLowerCase();
                const target = Object.values(effectiveUsersByUid).find(
                  (u) => u.username === clean
                );
                if (!target) throw new Error('Nenhum participante online encontrado com esse @.');
                sendSignal({ type: 'instant:friend-request', username: clean, targetUid: target.uid });
                return;
              }
              const target = await findUserByUsername(uname);
              if (!target) throw new Error('Nenhum usuário encontrado com esse @.');
              await sendFriendRequest(effectivePublicProfile, target);
            }}
            onRespondFriendRequest={async (fId, accept) => {
              if (isInstant) {
                sendSignal({ type: 'instant:friend-respond', friendshipId: fId, accept });
              } else {
                await respondFriendRequest(fId, accept ? 'accepted' : 'declined');
              }
            }}
            onRemoveFriendship={async (fId) => {
              if (isInstant) {
                sendSignal({ type: 'instant:friend-remove', friendshipId: fId });
              } else {
                await removeFriendship(fId);
              }
            }}
            onToggleBlockUser={handleToggleBlock}
            onSendDmMessage={async (payload) => {
              if (!activeDmThreadId || !activeDmPeerUid) return;
              if (isInstant) {
                sendSignal({
                  type: 'instant:dm-send',
                  peerUid: activeDmPeerUid,
                  content: payload.content,
                  attachmentName: payload.attachment?.name || '',
                  attachmentType: payload.attachment?.type || '',
                  attachmentDataUrl: payload.attachment?.dataUrl || '',
                  replyToId: payload.replyTo?.id || '',
                  replyToAuthor: payload.replyTo?.authorName || '',
                  replyToSnippet: payload.replyTo?.snippet || '',
                });
                return;
              }
              await sendDmMessage({
                threadId: activeDmThreadId,
                recipientUid: activeDmPeerUid,
                author: effectivePublicProfile,
                ...payload,
              });
            }}
            onEditDmMessage={async (msgId, content) => {
              if (isInstant && activeDmPeerUid) {
                sendSignal({
                  type: 'instant:dm-edit',
                  peerUid: activeDmPeerUid,
                  messageId: msgId,
                  content,
                });
                return;
              }
              if (activeDmThreadId) {
                await editDmMessage(activeDmThreadId, msgId, content);
              }
            }}
            onDeleteDmMessage={async (msgId) => {
              if (isInstant && activeDmPeerUid) {
                sendSignal({
                  type: 'instant:dm-delete',
                  peerUid: activeDmPeerUid,
                  messageId: msgId,
                });
                return;
              }
              if (activeDmThreadId) {
                await deleteDmMessage(activeDmThreadId, msgId);
              }
            }}
            onToggleDmReaction={async (msgId, emoji, reacted) => {
              if (isInstant && activeDmPeerUid) {
                sendSignal({
                  type: 'instant:dm-reaction',
                  peerUid: activeDmPeerUid,
                  messageId: msgId,
                  emoji,
                });
                return;
              }
              if (activeDmThreadId) {
                await toggleDmReaction({
                  threadId: activeDmThreadId,
                  messageId: msgId,
                  userId: effectivePublicProfile.uid,
                  emoji,
                  currentlyReacted: reacted,
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
                      <Video className="w-5 h-5 text-indigo-400 shrink-0" />
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
                {activeServer && effectiveChannels.some((c) => c.type === 'video' || c.type === 'voice') && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (rtc.screenSharing) {
                        await rtc.stopScreenShare();
                        return;
                      }
                      const targetRoomChannel =
                        (effectiveActiveChannel && effectiveActiveChannel.type !== 'text'
                          ? effectiveActiveChannel
                          : null) ||
                        effectiveChannels.find((c) => c.type === 'video') ||
                        effectiveChannels.find((c) => c.type === 'voice');
                      if (!targetRoomChannel) return;

                      const started = await rtc.startScreenShare({
                        serverId: targetRoomChannel.serverId,
                        channelId: targetRoomChannel.id,
                        channelName: targetRoomChannel.name,
                        channelType: targetRoomChannel.type as 'voice' | 'video',
                      });
                      if (started) {
                        setActiveChannelId(targetRoomChannel.id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      rtc.screenSharing
                        ? 'bg-sky-500 text-zinc-950 hover:bg-sky-400'
                        : 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/35 text-indigo-200'
                    }`}
                  >
                    {rtc.screenSharing ? (
                      <>
                        <MonitorOff className="w-3.5 h-3.5" />
                        Parar Tela
                      </>
                    ) : (
                      <>
                        <MonitorUp className="w-3.5 h-3.5" />
                        Compartilhar Tela
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(true)}
                  title="Notificações"
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
                  title="Lista de membros"
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
                      Abrir em nova aba
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={rtc.clearMediaError}
                    className="text-amber-300 hover:text-white font-medium px-2 py-0.5"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* Channel Viewport */}
            {!activeServer || !effectiveActiveChannel ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="text-sm text-zinc-300 font-medium mb-2">
                  Selecione ou crie uma comunidade para começar
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setCreateServerOpen(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold"
                  >
                    Criar Servidor
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinServerOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/14 text-white text-xs font-medium"
                  >
                    Entrar com Convite
                  </button>
                </div>
              </div>
            ) : effectiveActiveChannel.type === 'text' ? (
              <ChatArea
                channelKey={activeTextKey}
                placeholder={`Conversar em #${effectiveActiveChannel.name}`}
                messages={effectiveChannelMessages}
                reactions={effectiveChannelReactions}
                currentUser={effectivePublicProfile}
                blockedUids={blockedUids}
                canModerate={userRoleInServer === 'owner' || userRoleInServer === 'admin'}
                typingUsers={textTypingUsers}
                onTypingChange={(isTyping) => activeTextKey && emitTyping(activeTextKey, isTyping)}
                onSendMessage={async (payload) => {
                  if (!activeServerId) return;
                  if (isInstant) {
                    sendSignal({
                      type: 'instant:message-send',
                      serverId: activeServerId,
                      channelId: effectiveActiveChannel.id,
                      content: payload.content,
                      attachmentName: payload.attachment?.name || '',
                      attachmentType: payload.attachment?.type || '',
                      attachmentDataUrl: payload.attachment?.dataUrl || '',
                      replyToId: payload.replyTo?.id || '',
                      replyToAuthor: payload.replyTo?.authorName || '',
                      replyToSnippet: payload.replyTo?.snippet || '',
                    });
                    return;
                  }
                  await sendChannelMessage({
                    serverId: activeServerId,
                    channelId: effectiveActiveChannel.id,
                    author: effectivePublicProfile,
                    ...payload,
                  });
                }}
                onEditMessage={async (msgId, content) => {
                  if (!activeServerId) return;
                  if (isInstant) {
                    sendSignal({
                      type: 'instant:message-edit',
                      serverId: activeServerId,
                      channelId: effectiveActiveChannel.id,
                      messageId: msgId,
                      content,
                    });
                  } else {
                    await editChannelMessage(activeServerId, effectiveActiveChannel.id, msgId, content);
                  }
                }}
                onDeleteMessage={async (msgId) => {
                  if (!activeServerId) return;
                  if (isInstant) {
                    sendSignal({
                      type: 'instant:message-delete',
                      serverId: activeServerId,
                      channelId: effectiveActiveChannel.id,
                      messageId: msgId,
                    });
                  } else {
                    await deleteChannelMessage(activeServerId, effectiveActiveChannel.id, msgId);
                  }
                }}
                onToggleReaction={async (msgId, emoji, reacted) => {
                  if (!activeServerId) return;
                  if (isInstant) {
                    sendSignal({
                      type: 'instant:reaction-toggle',
                      serverId: activeServerId,
                      channelId: effectiveActiveChannel.id,
                      messageId: msgId,
                      emoji,
                    });
                  } else {
                    await toggleChannelReaction({
                      serverId: activeServerId,
                      channelId: effectiveActiveChannel.id,
                      messageId: msgId,
                      userId: effectivePublicProfile.uid,
                      emoji,
                      currentlyReacted: reacted,
                    });
                  }
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
                  rtc.joinRoom({
                    serverId: effectiveActiveChannel.serverId,
                    channelId: effectiveActiveChannel.id,
                    channelName: effectiveActiveChannel.name,
                    channelType: effectiveActiveChannel.type as 'voice' | 'video',
                  })
                }
                onLeave={rtc.leaveRoom}
                onToggleMic={rtc.toggleMic}
                onToggleCam={rtc.toggleCamera}
                onStartScreenShare={() => rtc.startScreenShare()}
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
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto rounded-xl border border-white/12 glass-elevated p-3.5 shadow-2xl flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{t.title}</div>
                <div className="text-xs text-zinc-400 mt-0.5 leading-snug">{t.body}</div>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-zinc-400 hover:text-white shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {userSettingsOpen && (
        <UserSettingsModal
          publicProfile={effectivePublicProfile}
          privateProfile={effectivePrivateProfile}
          onClose={() => setUserSettingsOpen(false)}
          onSave={async (updates) => {
            if (isInstant) {
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
              setGuestNotificationsEnabled(updates.notificationsEnabled);
              if (guestSession) {
                const updatedSession: GuestSession = {
                  uid: guestSession.uid,
                  displayName: updates.displayName,
                  username: updates.username,
                };
                setGuestSession(updatedSession);
                try {
                  sessionStorage.setItem(INSTANT_SESSION_KEY, JSON.stringify(updatedSession));
                } catch {
                  // ignore storage errors
                }
              }
              return;
            }
            await updateUserPublicProfile(effectivePublicProfile.uid, {
              displayName: updates.displayName,
              username: updates.username,
              bio: updates.bio,
              customStatus: updates.customStatus,
              presence: updates.presence,
              avatarDataUrl: updates.avatarDataUrl,
            });
            await updateUserPrivatePreferences(effectivePublicProfile.uid, {
              notificationsEnabled: updates.notificationsEnabled,
            });
          }}
          onLogout={async () => {
            rtc.leaveRoom();
            if (isInstant) {
              try {
                sessionStorage.removeItem(INSTANT_SESSION_KEY);
              } catch {
                // ignore storage errors
              }
              setGuestSession(null);
              setActiveServerId(null);
              setActiveChannelId(null);
              setActiveDmPeerUid(null);
              setUserSettingsOpen(false);
              return;
            }
            await signOut(auth);
            setUserSettingsOpen(false);
          }}
        />
      )}

      {createServerOpen && (
        <CreateServerModal
          onClose={() => setCreateServerOpen(false)}
          onCreate={async (data) => {
            if (isInstant) {
              sendSignal({ type: 'instant:server-create', ...data });
              return;
            }
            const newId = await createServer({
              ownerId: effectivePublicProfile.uid,
              ...data,
            });
            setActiveServerId(newId);
            setActiveMode('server');
          }}
        />
      )}

      {joinServerOpen && (
        <JoinServerModal
          onClose={() => setJoinServerOpen(false)}
          onJoin={async (code) => {
            if (isInstant) {
              sendSignal({ type: 'instant:server-join', inviteCode: code });
              return;
            }
            const joinedId = await joinServerByInviteCode(code, effectivePublicProfile.uid);
            setActiveServerId(joinedId);
            setActiveMode('server');
          }}
        />
      )}

      {serverSettingsOpen && activeServer && (
        <ServerSettingsModal
          server={activeServer}
          friends={acceptedFriendProfiles}
          onClose={() => setServerSettingsOpen(false)}
          onSave={async (updates) => {
            if (isInstant) {
              sendSignal({ type: 'instant:server-update', serverId: activeServer.id, ...updates });
            } else {
              await updateServerInfo(activeServer.id, updates);
            }
          }}
          onInviteFriend={async (friendUid) => {
            if (isInstant) {
              sendSignal({
                type: 'instant:invite-notify',
                recipientId: friendUid,
                serverId: activeServer.id,
              });
              return;
            }
            await createNotification({
              recipientId: friendUid,
              senderId: effectivePublicProfile.uid,
              senderName: effectivePublicProfile.displayName,
              type: 'invite',
              title: `Convite para ${activeServer.name}`,
              body: `Use o código ${activeServer.inviteCode} para entrar na comunidade.`,
              linkServerId: activeServer.id,
            });
          }}
        />
      )}

      {categoryModalState.open && activeServerId && (
        <CategoryModal
          initial={categoryModalState.editing}
          onClose={() => setCategoryModalState({ open: false, editing: null })}
          onSubmit={async (name) => {
            if (isInstant) {
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
              return;
            }
            if (categoryModalState.editing) {
              await updateCategory(activeServerId, categoryModalState.editing.id, name);
            } else {
              await createCategory(activeServerId, name, effectiveCategories.length);
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
            if (isInstant) {
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
              return;
            }
            if (channelModalState.editing) {
              await updateChannel(activeServerId, channelModalState.editing.id, data);
            } else {
              await createChannel({
                serverId: activeServerId,
                categoryId: data.categoryId,
                name: data.name,
                topic: data.topic,
                type: data.type,
                position: effectiveChannels.filter((c) => c.categoryId === data.categoryId).length,
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
          onClose={() => setSelectedProfile(null)}
          onSendDm={() => handleOpenDmWith(selectedProfile.user.uid)}
          onAddFriend={async () => {
            if (isInstant) {
              sendSignal({
                type: 'instant:friend-request',
                targetUid: selectedProfile.user.uid,
              });
            } else {
              await sendFriendRequest(effectivePublicProfile, selectedProfile.user);
            }
          }}
          onToggleBlock={() => handleToggleBlock(selectedProfile.user.uid)}
          onToggleAdminRole={
            activeServerId
              ? async (nextRole) => {
                  if (isInstant) {
                    sendSignal({
                      type: 'instant:member-role',
                      serverId: activeServerId,
                      targetUid: selectedProfile.user.uid,
                      role: nextRole,
                    });
                  } else {
                    await updateMemberRole(activeServerId, selectedProfile.user.uid, nextRole);
                  }
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
            if (isInstant) {
              sendSignal({ type: 'instant:notification-read', all: true });
            } else {
              await markAllNotificationsRead(
                effectiveNotifications.filter((n) => !n.read).map((n) => n.id)
              );
            }
          }}
          onClickNotification={async (n) => {
            if (!n.read) {
              if (isInstant) {
                sendSignal({ type: 'instant:notification-read', notificationId: n.id });
              } else {
                await markNotificationRead(n.id);
              }
            }
            setNotificationsOpen(false);
            if (n.type === 'dm' && n.linkUserId) {
              await handleOpenDmWith(n.linkUserId);
            } else if (n.type === 'friend_request') {
              setActiveMode('home');
              setActiveDmPeerUid(null);
            } else if (n.linkServerId && effectiveServersById[n.linkServerId]) {
              setActiveServerId(n.linkServerId);
              setActiveMode('server');
              if (n.linkChannelId) setActiveChannelId(n.linkChannelId);
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
      <VesperPlatform />
    </ErrorBoundary>
  );
}
