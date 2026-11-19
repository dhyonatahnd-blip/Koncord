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

import { LocalInstantHub } from '../lib/localInstantHub';

export type SignalListener = (msg: Record<string, unknown>) => void;

export interface InstantSnapshot {
  usersByUid: Record<string, UserPublic>;
  servers: ServerDoc[];
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
  isInstant?: boolean;
  onAlert?: (alert: Omit<ToastAlert, 'id' | 'createdAt'>) => void;
}) {
  const {
    uid,
    displayName,
    username,
    avatarDataUrl,
    presence,
    activeServerId,
    isInstant = false,
    onAlert,
  } = params;
  const wsRef = useRef<WebSocket | null>(null);
  const localHubRef = useRef<LocalInstantHub | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const listenersRef = useRef<Set<SignalListener>>(new Set());
  const retryCountRef = useRef(0);
  const hasOpenedRef = useRef(false);

  const [connected, setConnected] = useState(false);
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

  const handleIncomingMessage = useCallback(
    (msg: Record<string, unknown>) => {
      const type = msg.type as string;

      if (type === 'instant:snapshot') {
        setInstantSnapshot(msg as unknown as InstantSnapshot);
      } else if (type === 'instant:error') {
        onAlertRef.current?.({
          type: 'error',
          title: 'Aviso',
          body: String(msg.message || 'Operação não pôde ser concluída.'),
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
        const sharerName = String(msg.displayName || 'Participante');
        if (sharerUid !== uid) {
          onAlertRef.current?.({
            type: 'screen_share',
            title: 'Compartilhamento de tela iniciado',
            body: `${sharerName} começou a transmitir a tela ao vivo.`,
          });
        }
      } else if (type === 'screen:stopped') {
        const sharerUid = String(msg.uid || '');
        const sharerName = String(msg.displayName || 'Participante');
        if (sharerUid !== uid) {
          onAlertRef.current?.({
            type: 'screen_share',
            title: 'Compartilhamento encerrado',
            body: `${sharerName} encerrou a transmissão da tela.`,
          });
        }
      } else if (type === 'room:peer-joined') {
        const peer = msg.peer as VoicePeer | undefined;
        const channelName = String(msg.channelName || 'sala');
        if (peer && peer.uid !== uid) {
          onAlertRef.current?.({
            type: 'voice_join',
            title: 'Entrada na sala',
            body: `${peer.displayName} entrou em ${channelName}.`,
          });
        }
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

    const activateStaticFallback = () => {
      if (disposed || localHubRef.current) return;
      const hub = new LocalInstantHub({
        uid,
        displayName,
        username,
        avatarDataUrl,
        presence,
        isInstant,
        onMessage: handleIncomingMessage,
      });
      localHubRef.current = hub;
      setConnected(true);
      if (activeServerId) {
        hub.send({ type: 'server:subscribe', serverId: activeServerId });
      }
    };

    const customWsUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
    const forceStatic = (import.meta.env.VITE_STATIC_MODE as string | undefined) === 'true';

    if (forceStatic) {
      activateStaticFallback();
      return () => {
        disposed = true;
        localHubRef.current?.dispose();
        localHubRef.current = null;
      };
    }

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = customWsUrl || `${protocol}//${window.location.host}/ws`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        activateStaticFallback();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        hasOpenedRef.current = true;
        retryCountRef.current = 0;
        if (localHubRef.current) {
          localHubRef.current.dispose();
          localHubRef.current = null;
        }
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'auth:hello',
            uid,
            displayName,
            username,
            avatarDataUrl,
            presence,
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

      ws.onclose = () => {
        setConnected(false);
        if (pingTimerRef.current) {
          window.clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        if (!disposed) {
          if (!hasOpenedRef.current && !customWsUrl) {
            // Static hosts like Netlify have no /ws endpoint; switch cleanly to local browser sync
            activateStaticFallback();
            return;
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
      if (localHubRef.current) {
        localHubRef.current.dispose();
        localHubRef.current = null;
      }
    };
  }, [uid, isInstant, handleIncomingMessage]);

  // Sync presence updates over open socket or static hub
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
    livePresences,
    voiceRoster,
    typingByChannel,
    instantSnapshot,
    sendSignal,
    subscribeSignal,
  };
}
