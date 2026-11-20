import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CategoryDoc,
  ChannelDoc,
  ChatMessage,
  DmThread,
  FriendshipDoc,
  MessageReaction,
  NotificationItem,
  PresenceStatus,
  ServerDoc,
  ServerMember,
  ToastAlert,
  UserPublic,
  VoicePeer,
} from '../types';

import { FirestoreInstantHub } from '../lib/firestoreInstantHub';
import { LocalInstantHub } from '../lib/localInstantHub';
import { getApiBaseUrl } from '../lib/validation';

export type SignalListener = (msg: Record<string, unknown>) => void;

export interface InstantSnapshot {
  usersByUid: Record<string, UserPublic>;
  servers: ServerDoc[];
  publicServers?: ServerDoc[];
  membersByServer: Record<string, ServerMember[]>;
  categoriesByServer: Record<string, CategoryDoc[]>;
  channelsByServer: Record<string, ChannelDoc[]>;
  messagesByChannel: Record<string, ChatMessage[]>;
  reactionsByChannel: Record<string, MessageReaction[]>;
  friendships: FriendshipDoc[];
  dmThreads: DmThread[];
  dmMessagesByThread: Record<string, ChatMessage[]>;
  dmReactionsByThread: Record<string, MessageReaction[]>;
  notifications: NotificationItem[];
}

export function useWebSocketSignaling(params: {
  uid: string | null;
  displayName: string;
  username?: string;
  avatarDataUrl: string;
  presence: PresenceStatus;
  activeServerId: string | null;
  initialInviteCode?: string;
  isInstant?: boolean;
  onAlert?: (alert: Omit<ToastAlert, 'id' | 'createdAt'>) => void;
  alertText?: {
    screenStartedTitle: string;
    screenStartedBody: string;
    screenStoppedTitle: string;
    screenStoppedBody: string;
    peerJoinedTitle: string;
    peerJoinedBody: string;
    fileExpiredTitle: string;
    fileExpiredBody: string;
    roomClosedTitle: string;
    roomClosedBody: string;
  };
}) {
  const {
    uid,
    displayName,
    username,
    avatarDataUrl,
    presence,
    activeServerId,
    initialInviteCode,
    isInstant = false,
    onAlert,
    alertText,
  } = params;
  const wsRef = useRef<WebSocket | null>(null);
  const cloudHubRef = useRef<FirestoreInstantHub | null>(null);
  const localHubRef = useRef<LocalInstantHub | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const listenersRef = useRef<Set<SignalListener>>(new Set());
  const retryCountRef = useRef(0);
  const hasOpenedRef = useRef(false);
  const backendConfirmedRef = useRef<boolean | null>(null);

  const latestInviteRef = useRef(initialInviteCode || '');
  latestInviteRef.current = initialInviteCode || '';
  const latestProfileRef = useRef({ displayName, username, avatarDataUrl, presence });
  latestProfileRef.current = { displayName, username, avatarDataUrl, presence };

  const [connected, setConnected] = useState(false);
  const [usingCloudRealtime, setUsingCloudRealtime] = useState(false);
  const [usingStaticFallback, setUsingStaticFallback] = useState(false);
  const [livePresences, setLivePresences] = useState<Record<string, PresenceStatus>>({});
  const [voiceRoster, setVoiceRoster] = useState<Record<string, VoicePeer[]>>({});
  const [typingByChannel, setTypingByChannel] = useState<Record<string, Record<string, string>>>({});
  const [instantSnapshot, setInstantSnapshot] = useState<InstantSnapshot | null>(null);

  const sendSignal = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    if (cloudHubRef.current) {
      cloudHubRef.current.send(payload);
      return true;
    }
    if (localHubRef.current) {
      localHubRef.current.send(payload);
      return true;
    }
    return false;
  }, []);

  const subscribeSignal = useCallback((listener: SignalListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;
  const alertTextRef = useRef(alertText);
  alertTextRef.current = alertText;

  const handleIncomingMessage = useCallback(
    (msg: Record<string, unknown>) => {
      const type = msg.type as string;
      const labels = alertTextRef.current;

      if (type === 'instant:snapshot') {
        setInstantSnapshot(msg as unknown as InstantSnapshot);
      } else if (type === 'instant:error') {
        onAlertRef.current?.({
          type: 'error',
          title: 'ZONE',
          body: String(msg.message || 'Action could not be completed.'),
        });
      } else if (type === 'presence:snapshot') {
        setLivePresences((msg.presences as Record<string, PresenceStatus>) || {});
      } else if (type === 'presence:update') {
        const targetUid = String(msg.uid || '');
        const nextPresence = (msg.presence as PresenceStatus) || 'online';
        if (targetUid) {
          setLivePresences((prev) => ({ ...prev, [targetUid]: nextPresence }));
        }
      } else if (type === 'server:voice-roster') {
        const roster = (msg.roster as Record<string, VoicePeer[]>) || {};
        setVoiceRoster(roster);
      } else if (type === 'typing:start') {
        const channelKey = String(msg.channelKey || '');
        const tyUid = String(msg.uid || '');
        const tyName = String(msg.displayName || '');
        if (channelKey && tyUid && tyUid !== uid) {
          setTypingByChannel((prev) => ({
            ...prev,
            [channelKey]: { ...(prev[channelKey] || {}), [tyUid]: tyName },
          }));
        }
      } else if (type === 'typing:stop') {
        const channelKey = String(msg.channelKey || '');
        const tyUid = String(msg.uid || '');
        if (channelKey && tyUid) {
          setTypingByChannel((prev) => {
            const current = { ...(prev[channelKey] || {}) };
            delete current[tyUid];
            return { ...prev, [channelKey]: current };
          });
        }
      } else if (type === 'screen:started') {
        const sharerUid = String(msg.uid || '');
        const sharerName = String(msg.displayName || 'Participant');
        if (sharerUid !== uid) {
          onAlertRef.current?.({
            type: 'screen_share',
            title: labels?.screenStartedTitle || 'Screen share started',
            body: `${sharerName} ${labels?.screenStartedBody || 'started sharing screen.'}`,
          });
        }
      } else if (type === 'screen:stopped') {
        const sharerUid = String(msg.uid || '');
        const sharerName = String(msg.displayName || 'Participant');
        if (sharerUid !== uid) {
          onAlertRef.current?.({
            type: 'screen_share',
            title: labels?.screenStoppedTitle || 'Screen share ended',
            body: `${sharerName} ${labels?.screenStoppedBody || 'stopped sharing screen.'}`,
          });
        }
      } else if (type === 'room:peer-joined') {
        const peer = msg.peer as VoicePeer | undefined;
        const channelName = String(msg.channelName || 'room');
        if (peer && peer.uid !== uid) {
          onAlertRef.current?.({
            type: 'voice_join',
            title: labels?.peerJoinedTitle || 'Joined call',
            body: `${peer.displayName} ${labels?.peerJoinedBody || 'joined'} ${channelName}.`,
          });
        }
      } else if (type === 'zone:file-expired') {
        onAlertRef.current?.({
          type: 'info',
          title: labels?.fileExpiredTitle || 'File expired',
          body: labels?.fileExpiredBody || 'A temporary file expired after 5 minutes.',
        });
      } else if (type === 'zone:room-closed') {
        onAlertRef.current?.({
          type: 'info',
          title: labels?.roomClosedTitle || 'Room closed',
          body: `${String(msg.serverName || '')} — ${labels?.roomClosedBody || 'Closed.'}`,
        });
      }

      for (const listener of listenersRef.current) {
        listener(msg);
      }
    },
    [uid]
  );

  useEffect(() => {
    if (!uid) {
      setInstantSnapshot(null);
      return;
    }
    let disposed = false;
    hasOpenedRef.current = false;
    retryCountRef.current = 0;

    const activateLocalFallback = () => {
      if (disposed || localHubRef.current) return;
      if (cloudHubRef.current) {
        cloudHubRef.current.dispose();
        cloudHubRef.current = null;
      }
      const prof = latestProfileRef.current;
      const hub = new LocalInstantHub({
        uid,
        displayName: prof.displayName,
        username: prof.username,
        avatarDataUrl: prof.avatarDataUrl,
        presence: prof.presence,
        initialInviteCode: latestInviteRef.current,
        isInstant,
        onMessage: handleIncomingMessage,
      });
      localHubRef.current = hub;
      setUsingCloudRealtime(false);
      setUsingStaticFallback(true);
      setConnected(true);
      if (activeServerId) {
        hub.send({ type: 'server:subscribe', serverId: activeServerId });
      }
    };

    const activateCloudOrStaticFallback = () => {
      if (disposed || cloudHubRef.current || localHubRef.current) return;
      const prof = latestProfileRef.current;
      const hub = new FirestoreInstantHub({
        uid,
        displayName: prof.displayName,
        username: prof.username,
        avatarDataUrl: prof.avatarDataUrl,
        presence: prof.presence,
        initialInviteCode: latestInviteRef.current,
        onMessage: handleIncomingMessage,
        onError: () => {
          activateLocalFallback();
        },
      });
      cloudHubRef.current = hub;
      setUsingCloudRealtime(true);
      setUsingStaticFallback(false);
      setConnected(true);
      if (activeServerId) {
        hub.send({ type: 'server:subscribe', serverId: activeServerId });
      }
    };

    const customWsUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
    const forceStatic = (import.meta.env.VITE_STATIC_MODE as string | undefined) === 'true';

    if (forceStatic) {
      activateLocalFallback();
      return () => {
        disposed = true;
        localHubRef.current?.dispose();
        localHubRef.current = null;
      };
    }

    const checkBackendExists = async (): Promise<boolean> => {
      if (customWsUrl) return true;
      if (backendConfirmedRef.current !== null) return backendConfirmedRef.current;
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 2500);
        const resp = await fetch(`${getApiBaseUrl()}/api/health`, { signal: controller.signal });
        window.clearTimeout(timer);
        if (!resp.ok) {
          backendConfirmedRef.current = false;
          return false;
        }
        const json = (await resp.json().catch(() => null)) as { ok?: boolean; service?: string } | null;
        const ok = Boolean(json?.ok && json?.service === 'zone-backend');
        backendConfirmedRef.current = ok;
        return ok;
      } catch {
        backendConfirmedRef.current = false;
        return false;
      }
    };

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = customWsUrl || `${protocol}//${window.location.host}/ws`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        checkBackendExists().then((hasBackend) => {
          if (disposed) return;
          if (!hasBackend) activateCloudOrStaticFallback();
          else reconnectTimerRef.current = window.setTimeout(connect, 1500);
        });
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        hasOpenedRef.current = true;
        backendConfirmedRef.current = true;
        retryCountRef.current = 0;
        setUsingCloudRealtime(false);
        setUsingStaticFallback(false);
        if (cloudHubRef.current) {
          cloudHubRef.current.dispose();
          cloudHubRef.current = null;
        }
        if (localHubRef.current) {
          localHubRef.current.dispose();
          localHubRef.current = null;
        }
        setConnected(true);
        const prof = latestProfileRef.current;
        ws.send(
          JSON.stringify({
            type: 'auth:hello',
            uid,
            displayName: prof.displayName,
            username: prof.username,
            avatarDataUrl: prof.avatarDataUrl,
            presence: prof.presence,
            inviteCode: latestInviteRef.current,
            isInstant,
          })
        );
        if (activeServerId) {
          ws.send(JSON.stringify({ type: 'server:subscribe', serverId: activeServerId }));
        }
        if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        handleIncomingMessage(msg);
      };

      ws.onclose = async () => {
        setConnected(false);
        if (pingTimerRef.current) {
          window.clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        if (!disposed) {
          if (!hasOpenedRef.current && !customWsUrl) {
            const hasBackend = await checkBackendExists();
            if (disposed) return;
            if (!hasBackend) {
              // Static hosts like Netlify without VITE_WS_URL use Firebase Firestore cloud hub
              activateCloudOrStaticFallback();
              return;
            }
          }
          const delay = Math.min(8000, 1000 * Math.pow(1.5, retryCountRef.current));
          retryCountRef.current += 1;
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
      if (cloudHubRef.current) {
        cloudHubRef.current.dispose();
        cloudHubRef.current = null;
      }
      if (localHubRef.current) {
        localHubRef.current.dispose();
        localHubRef.current = null;
      }
    };
  }, [uid, isInstant, handleIncomingMessage]);

  // Sync presence updates over open socket, cloud hub, or static hub
  useEffect(() => {
    if (connected && uid) {
      sendSignal({ type: 'presence:set', presence });
    }
  }, [connected, uid, presence, sendSignal]);

  // Subscribe to active server voice roster
  useEffect(() => {
    if (connected && activeServerId) {
      sendSignal({ type: 'server:subscribe', serverId: activeServerId });
    }
  }, [connected, activeServerId, sendSignal]);

  return {
    connected,
    usingCloudRealtime,
    usingStaticFallback,
    livePresences,
    voiceRoster,
    typingByChannel,
    instantSnapshot,
    sendSignal,
    subscribeSignal,
  };
}
