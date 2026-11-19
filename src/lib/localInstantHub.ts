import {
  CategoryDoc,
  ChannelDoc,
  ChatMessage,
  DmThread,
  FriendshipDoc,
  MessageReaction,
  MessageRetention,
  NotificationItem,
  PresenceStatus,
  ServerDoc,
  ServerMember,
  UserPublic,
  VoicePeer,
} from '../types';

const STORAGE_KEY = 'zone_static_hub_v1';
const CHANNEL_NAME = 'zone_static_realtime_v1';
const DEFAULT_SERVER_ID = 'srv_zone_eu';
const SECONDARY_PUBLIC_SERVER_ID = 'srv_euro_design';

interface PersistedHubState {
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
  notificationsByUser: Record<string, NotificationItem[]>;
  voiceRooms: Record<string, Record<string, VoicePeer>>;
  presences: Record<string, PresenceStatus>;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeTagFromUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return `#${hash.toString(16).toUpperCase().padStart(4, '0').slice(0, 4)}`;
}

function makeInvite(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ZN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function retentionToMs(retention?: MessageRetention): number | null {
  if (retention === '5m') return 5 * 60 * 1000;
  if (retention === '15m') return 15 * 60 * 1000;
  if (retention === '60m') return 60 * 60 * 1000;
  return null;
}

function createSeedState(): PersistedHubState {
  const now = Date.now();
  return {
    usersByUid: {},
    servers: [
      {
        id: DEFAULT_SERVER_ID,
        name: 'ZONE Europa',
        description: 'Lobby público temporário para conversas, chamadas e compartilhamento de tela.',
        iconColor: '#3B82F6',
        iconInitials: 'ZE',
        iconDataUrl: '',
        ownerId: 'system',
        inviteCode: 'ZONEEU',
        visibility: 'public',
        retention: 'until_close',
        clearOnClose: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: SECONDARY_PUBLIC_SERVER_ID,
        name: 'Euro Studio & Dev',
        description: 'Sala pública para design, tecnologia e apresentações de tela.',
        iconColor: '#7C3AED',
        iconInitials: 'ES',
        iconDataUrl: '',
        ownerId: 'system',
        inviteCode: 'EURODEV',
        visibility: 'public',
        retention: '60m',
        clearOnClose: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    membersByServer: {
      [DEFAULT_SERVER_ID]: [],
      [SECONDARY_PUBLIC_SERVER_ID]: [],
    },
    categoriesByServer: {
      [DEFAULT_SERVER_ID]: [
        { id: 'cat_text_eu', serverId: DEFAULT_SERVER_ID, name: 'Texto', position: 0, createdAt: now, updatedAt: now },
        { id: 'cat_media_eu', serverId: DEFAULT_SERVER_ID, name: 'Voz, Vídeo & Tela', position: 1, createdAt: now, updatedAt: now },
      ],
      [SECONDARY_PUBLIC_SERVER_ID]: [
        { id: 'cat_text_dev', serverId: SECONDARY_PUBLIC_SERVER_ID, name: 'Texto', position: 0, createdAt: now, updatedAt: now },
        { id: 'cat_media_dev', serverId: SECONDARY_PUBLIC_SERVER_ID, name: 'Review & Vídeo', position: 1, createdAt: now, updatedAt: now },
      ],
    },
    channelsByServer: {
      [DEFAULT_SERVER_ID]: [
        {
          id: 'ch_geral_eu',
          serverId: DEFAULT_SERVER_ID,
          categoryId: 'cat_text_eu',
          name: 'geral',
          topic: 'Chat temporário em tempo real. Arquivos enviados expiram em 5 minutos.',
          type: 'text',
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ch_voz_eu',
          serverId: DEFAULT_SERVER_ID,
          categoryId: 'cat_media_eu',
          name: 'Lounge de Voz',
          topic: 'Chamada de voz em tempo real.',
          type: 'voice',
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ch_video_eu',
          serverId: DEFAULT_SERVER_ID,
          categoryId: 'cat_media_eu',
          name: 'Sala Vídeo & Tela',
          topic: 'Vídeo multi-participante e tela cheia sem cortes.',
          type: 'video',
          position: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
      [SECONDARY_PUBLIC_SERVER_ID]: [
        {
          id: 'ch_geral_dev',
          serverId: SECONDARY_PUBLIC_SERVER_ID,
          categoryId: 'cat_text_dev',
          name: 'showcase',
          topic: 'Envie imagens, vídeos ou PDFs (autoexclusão em 5 min).',
          type: 'text',
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ch_video_dev',
          serverId: SECONDARY_PUBLIC_SERVER_ID,
          categoryId: 'cat_media_dev',
          name: 'Screen Review',
          topic: 'Compartilhe janela ou tela inteira em alta definição.',
          type: 'video',
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    messagesByChannel: {},
    reactionsByChannel: {},
    friendships: [],
    dmThreads: [],
    dmMessagesByThread: {},
    dmReactionsByThread: {},
    notificationsByUser: {},
    voiceRooms: {},
    presences: {},
  };
}

function loadState(): PersistedHubState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedHubState;
      if (parsed && Array.isArray(parsed.servers)) {
        return {
          ...createSeedState(),
          ...parsed,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return createSeedState();
}

function saveState(state: PersistedHubState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export class LocalInstantHub {
  private uid: string;
  private displayName: string;
  private avatarDataUrl: string;
  private presence: PresenceStatus;
  private isInstant: boolean;
  private bc: BroadcastChannel | null = null;
  private onMessage: (msg: Record<string, unknown>) => void;
  private voiceChannelId: string | null = null;
  private voiceServerId: string | null = null;
  private cleanupTimer: number | null = null;

  constructor(params: {
    uid: string;
    displayName: string;
    username?: string;
    avatarDataUrl: string;
    presence: PresenceStatus;
    initialInviteCode?: string;
    isInstant: boolean;
    onMessage: (msg: Record<string, unknown>) => void;
  }) {
    this.uid = params.uid;
    this.displayName = params.displayName || 'Visitante';
    this.avatarDataUrl = params.avatarDataUrl || '';
    this.presence = params.presence || 'online';
    this.isInstant = params.isInstant;
    this.onMessage = params.onMessage;

    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(CHANNEL_NAME);
      this.bc.onmessage = (ev) => {
        const data = ev.data as Record<string, unknown>;
        if (!data || data.__senderUid === this.uid) return;
        this.handleBroadcastEvent(data);
      };
    }

    const state = loadState();
    state.presences[this.uid] = this.presence;

    if (this.isInstant) {
      const now = Date.now();
      const existing = state.usersByUid[this.uid];
      const cleanName = this.displayName.slice(0, 32) || 'Visitante';
      const cleanUser =
        String(params.username || existing?.username || cleanName)
          .toLowerCase()
          .replace(/[^a-z0-9_.-]/g, '')
          .slice(0, 32) || `zone_${this.uid.slice(-4)}`;

      state.usersByUid[this.uid] = {
        uid: this.uid,
        tag: existing?.tag || makeTagFromUid(this.uid),
        displayName: cleanName,
        username: cleanUser,
        bio: existing?.bio ?? '',
        customStatus: existing?.customStatus ?? '',
        presence: this.presence,
        avatarDataUrl: this.avatarDataUrl || existing?.avatarDataUrl || '',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const members = state.membersByServer[DEFAULT_SERVER_ID] || [];
      const hasAnyMembership = Object.values(state.membersByServer).some((mList) =>
        mList.some((m) => m.uid === this.uid)
      );
      if (!hasAnyMembership && !members.some((m) => m.uid === this.uid)) {
        members.push({
          uid: this.uid,
          serverId: DEFAULT_SERVER_ID,
          role: members.length === 0 ? 'owner' : 'member',
          joinedAt: now,
        });
        state.membersByServer[DEFAULT_SERVER_ID] = members;
      }

      const initCode = String(params.initialInviteCode || '').trim().toUpperCase();
      if (initCode) {
        const invitedSrv = state.servers.find((s) => s.inviteCode === initCode);
        if (invitedSrv) {
          const srvMembers = state.membersByServer[invitedSrv.id] || [];
          if (!srvMembers.some((m) => m.uid === this.uid)) {
            srvMembers.push({ uid: this.uid, serverId: invitedSrv.id, role: 'member', joinedAt: now });
            state.membersByServer[invitedSrv.id] = srvMembers;
          }
          this.emitLocal({ type: 'instant:server-joined', serverId: invitedSrv.id });
        }
      }
    }

    this.sweepExpired(state, false);
    saveState(state);
    this.emitLocal({ type: 'presence:snapshot', presences: state.presences });
    if (this.isInstant) {
      this.emitLocal(this.buildSnapshotForUser(state, this.uid));
    }
    this.broadcast({ type: 'hub:sync', uid: this.uid });

    // Local cleanup sweep every 30s for static fallback mode
    if (typeof window !== 'undefined') {
      this.cleanupTimer = window.setInterval(() => {
        const cur = loadState();
        if (this.sweepExpired(cur, true)) {
          this.syncAll(cur);
        }
      }, 30000);
    }
  }

  private sweepExpired(state: PersistedHubState, emitAlerts: boolean): boolean {
    const now = Date.now();
    let changed = false;

    const cleanMessages = (map: Record<string, ChatMessage[]>) => {
      for (const [key, list] of Object.entries(map)) {
        const filtered = list.filter((m) => !m.expiresAt || now < m.expiresAt);
        if (filtered.length !== list.length) {
          map[key] = filtered;
          changed = true;
        }
        for (const m of map[key]) {
          if (m.attachmentExpiresAt && now >= m.attachmentExpiresAt && !m.attachmentExpired) {
            m.attachmentExpired = true;
            m.attachmentDataUrl = '';
            m.attachmentUrl = '';
            changed = true;
            if (emitAlerts) {
              this.emitLocal({ type: 'zone:file-expired', fileId: m.attachmentId || m.id });
            }
          }
        }
      }
    };

    cleanMessages(state.messagesByChannel);
    cleanMessages(state.dmMessagesByThread);
    return changed;
  }

  private emitLocal(payload: Record<string, unknown>) {
    this.onMessage(payload);
  }

  private broadcast(payload: Record<string, unknown>) {
    if (this.bc) {
      this.bc.postMessage({ ...payload, __senderUid: this.uid });
    }
  }

  private handleBroadcastEvent(data: Record<string, unknown>) {
    const type = String(data.type || '');
    if (type === 'hub:sync') {
      const state = loadState();
      this.emitLocal({ type: 'presence:snapshot', presences: state.presences });
      if (this.isInstant) {
        this.emitLocal(this.buildSnapshotForUser(state, this.uid));
      }
      if (data.serverId) {
        this.emitLocal({
          type: 'server:voice-roster',
          serverId: data.serverId,
          roster: this.getRoster(state, String(data.serverId)),
        });
      }
      return;
    }

    if (
      (type === 'rtc:offer' || type === 'rtc:answer' || type === 'rtc:ice-candidate') &&
      data.targetUid === this.uid
    ) {
      this.emitLocal(data);
      return;
    }

    if (
      type === 'typing:start' ||
      type === 'typing:stop' ||
      type === 'room:peer-joined' ||
      type === 'room:peer-left' ||
      type === 'room:peer-state' ||
      type === 'screen:started' ||
      type === 'screen:stopped' ||
      type === 'zone:room-closed'
    ) {
      this.emitLocal(data);
    }
  }

  private getRoster(state: PersistedHubState, serverId: string): Record<string, VoicePeer[]> {
    const roster: Record<string, VoicePeer[]> = {};
    for (const [channelId, peersMap] of Object.entries(state.voiceRooms)) {
      const list = Object.values(peersMap).filter((p) => p.serverId === serverId);
      if (list.length > 0) roster[channelId] = list;
    }
    return roster;
  }

  private buildSnapshotForUser(state: PersistedHubState, uid: string): Record<string, unknown> {
    const userServers: ServerDoc[] = [];
    const publicServers: ServerDoc[] = [];
    const membersMap: Record<string, ServerMember[]> = {};
    const categoriesMap: Record<string, CategoryDoc[]> = {};
    const channelsMap: Record<string, ChannelDoc[]> = {};
    const messagesMap: Record<string, ChatMessage[]> = {};
    const reactionsMap: Record<string, MessageReaction[]> = {};

    for (const srv of state.servers) {
      const srvMembers = state.membersByServer[srv.id] || [];
      if ((srv.visibility ?? 'public') === 'public') {
        publicServers.push({ ...srv, memberCount: srvMembers.length });
      }
      if (srvMembers.some((m) => m.uid === uid)) {
        userServers.push({ ...srv, memberCount: srvMembers.length });
        membersMap[srv.id] = srvMembers;
        categoriesMap[srv.id] = state.categoriesByServer[srv.id] || [];
        const chs = state.channelsByServer[srv.id] || [];
        channelsMap[srv.id] = chs;
        for (const ch of chs) {
          messagesMap[ch.id] = state.messagesByChannel[ch.id] || [];
          reactionsMap[ch.id] = state.reactionsByChannel[ch.id] || [];
        }
      }
    }

    const userFriendships = state.friendships.filter((f) => f.users.includes(uid));
    const userDmThreads = state.dmThreads.filter((t) => t.participants.includes(uid));
    const dmMsgs: Record<string, ChatMessage[]> = {};
    const dmReacts: Record<string, MessageReaction[]> = {};
    for (const t of userDmThreads) {
      dmMsgs[t.id] = state.dmMessagesByThread[t.id] || [];
      dmReacts[t.id] = state.dmReactionsByThread[t.id] || [];
    }

    return {
      type: 'instant:snapshot',
      usersByUid: state.usersByUid,
      servers: userServers,
      publicServers,
      membersByServer: membersMap,
      categoriesByServer: categoriesMap,
      channelsByServer: channelsMap,
      messagesByChannel: messagesMap,
      reactionsByChannel: reactionsMap,
      friendships: userFriendships,
      dmThreads: userDmThreads,
      dmMessagesByThread: dmMsgs,
      dmReactionsByThread: dmReacts,
      notifications: state.notificationsByUser[uid] || [],
    };
  }

  private syncAll(state: PersistedHubState, serverId?: string) {
    saveState(state);
    if (this.isInstant) {
      this.emitLocal(this.buildSnapshotForUser(state, this.uid));
    }
    this.broadcast({ type: 'hub:sync', serverId });
  }

  public send(msg: Record<string, unknown>) {
    const type = String(msg.type || '');
    const state = loadState();

    if (type === 'presence:set') {
      this.presence = (msg.presence as PresenceStatus) || 'online';
      state.presences[this.uid] = this.presence;
      saveState(state);
      this.emitLocal({ type: 'presence:update', uid: this.uid, presence: this.presence });
      this.broadcast({ type: 'hub:sync' });
      return;
    }

    if (type === 'server:subscribe') {
      const serverId = String(msg.serverId || '');
      if (serverId) {
        this.emitLocal({
          type: 'server:voice-roster',
          serverId,
          roster: this.getRoster(state, serverId),
        });
      }
      return;
    }

    if (type === 'typing:start' || type === 'typing:stop') {
      this.broadcast({
        type,
        channelKey: msg.channelKey,
        uid: this.uid,
        displayName: this.displayName,
      });
      return;
    }

    if (type === 'room:join') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const channelName = String(msg.channelName || '');
      if (!serverId || !channelId) return;

      if (this.voiceChannelId && this.voiceChannelId !== channelId) {
        this.leaveVoiceInState(state);
      }
      this.voiceChannelId = channelId;
      this.voiceServerId = serverId;

      if (!state.voiceRooms[channelId]) state.voiceRooms[channelId] = {};
      const existingPeers = Object.values(state.voiceRooms[channelId]).filter(
        (p) => p.uid !== this.uid
      );

      const participant: VoicePeer = {
        uid: this.uid,
        displayName: String(msg.displayName || this.displayName),
        avatarDataUrl: String(msg.avatarDataUrl || this.avatarDataUrl),
        serverId,
        channelId,
        micMuted: Boolean(msg.micMuted),
        camEnabled: Boolean(msg.camEnabled),
        screenSharing: Boolean(msg.screenSharing),
        speaking: false,
        joinedAt: Date.now(),
      };
      state.voiceRooms[channelId][this.uid] = participant;
      saveState(state);

      this.emitLocal({
        type: 'room:snapshot',
        channelId,
        serverId,
        peers: existingPeers,
      });
      this.broadcast({
        type: 'room:peer-joined',
        channelId,
        serverId,
        channelName,
        peer: participant,
      });
      const roster = this.getRoster(state, serverId);
      this.emitLocal({ type: 'server:voice-roster', serverId, roster });
      this.broadcast({ type: 'hub:sync', serverId });
      return;
    }

    if (type === 'room:leave') {
      const prevSrv = this.voiceServerId;
      this.leaveVoiceInState(state);
      saveState(state);
      if (prevSrv) {
        this.emitLocal({
          type: 'server:voice-roster',
          serverId: prevSrv,
          roster: this.getRoster(state, prevSrv),
        });
        this.broadcast({ type: 'hub:sync', serverId: prevSrv });
      }
      return;
    }

    if (type === 'room:state') {
      if (!this.voiceChannelId || !state.voiceRooms[this.voiceChannelId]?.[this.uid]) return;
      const cur = state.voiceRooms[this.voiceChannelId][this.uid];
      const wasScreen = cur.screenSharing;
      cur.micMuted = msg.micMuted !== undefined ? Boolean(msg.micMuted) : cur.micMuted;
      cur.camEnabled = msg.camEnabled !== undefined ? Boolean(msg.camEnabled) : cur.camEnabled;
      cur.screenSharing =
        msg.screenSharing !== undefined ? Boolean(msg.screenSharing) : cur.screenSharing;
      cur.speaking = msg.speaking !== undefined ? Boolean(msg.speaking) : cur.speaking;
      saveState(state);

      this.broadcast({
        type: 'room:peer-state',
        channelId: this.voiceChannelId,
        uid: this.uid,
        micMuted: cur.micMuted,
        camEnabled: cur.camEnabled,
        screenSharing: cur.screenSharing,
        speaking: cur.speaking,
      });

      if (!wasScreen && cur.screenSharing) {
        this.broadcast({
          type: 'screen:started',
          serverId: cur.serverId,
          channelId: cur.channelId,
          uid: this.uid,
          displayName: this.displayName,
        });
      } else if (wasScreen && !cur.screenSharing) {
        this.broadcast({
          type: 'screen:stopped',
          serverId: cur.serverId,
          channelId: cur.channelId,
          uid: this.uid,
          displayName: this.displayName,
        });
      }

      this.emitLocal({
        type: 'server:voice-roster',
        serverId: cur.serverId,
        roster: this.getRoster(state, cur.serverId),
      });
      this.broadcast({ type: 'hub:sync', serverId: cur.serverId });
      return;
    }

    if (type === 'rtc:offer' || type === 'rtc:answer' || type === 'rtc:ice-candidate') {
      this.broadcast({
        ...msg,
        fromUid: this.uid,
        fromName: this.displayName,
      });
      return;
    }

    if (type === 'instant:profile-update') {
      const user = state.usersByUid[this.uid];
      if (!user) return;
      const updates = (msg.updates as Partial<UserPublic>) || {};
      if (updates.displayName !== undefined) {
        user.displayName = String(updates.displayName).slice(0, 32) || user.displayName;
        this.displayName = user.displayName;
      }
      if (updates.username !== undefined) {
        user.username =
          String(updates.username)
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '')
            .slice(0, 32) || user.username;
      }
      if (updates.bio !== undefined) user.bio = String(updates.bio).slice(0, 240);
      if (updates.customStatus !== undefined) user.customStatus = String(updates.customStatus).slice(0, 80);
      if (updates.presence !== undefined) {
        user.presence = updates.presence;
        this.presence = updates.presence;
        state.presences[this.uid] = updates.presence;
      }
      if (updates.avatarDataUrl !== undefined) {
        user.avatarDataUrl = String(updates.avatarDataUrl).slice(0, 200000);
        this.avatarDataUrl = user.avatarDataUrl;
      }
      user.updatedAt = Date.now();
      this.syncAll(state);
      return;
    }

    if (type === 'instant:server-create') {
      const now = Date.now();
      const serverId = makeId('srv');
      const name = String(msg.name || 'Nova Sala').slice(0, 64);
      const visibility = msg.visibility === 'private' ? 'private' : 'public';
      const retention: MessageRetention =
        msg.retention === '5m' || msg.retention === '15m' || msg.retention === '60m'
          ? msg.retention
          : 'until_close';
      const clearOnClose = msg.clearOnClose !== false;

      state.servers.push({
        id: serverId,
        name,
        description: String(msg.description || '').slice(0, 240),
        iconColor: String(msg.iconColor || '#3B82F6'),
        iconInitials: initialsFrom(name),
        iconDataUrl: '',
        ownerId: this.uid,
        inviteCode: makeInvite(),
        visibility,
        retention,
        clearOnClose,
        createdAt: now,
        updatedAt: now,
      });
      state.membersByServer[serverId] = [{ uid: this.uid, serverId, role: 'owner', joinedAt: now }];
      const catTextId = makeId('cat');
      const catMediaId = makeId('cat');
      state.categoriesByServer[serverId] = [
        { id: catTextId, serverId, name: 'Texto', position: 0, createdAt: now, updatedAt: now },
        { id: catMediaId, serverId, name: 'Voz, Vídeo & Tela', position: 1, createdAt: now, updatedAt: now },
      ];
      state.channelsByServer[serverId] = [
        { id: makeId('ch'), serverId, categoryId: catTextId, name: 'geral', topic: 'Chat temporário — arquivos expiram em 5 min.', type: 'text', position: 0, createdAt: now, updatedAt: now },
        { id: makeId('ch'), serverId, categoryId: catMediaId, name: 'Voz', topic: 'Áudio em tempo real', type: 'voice', position: 0, createdAt: now, updatedAt: now },
        { id: makeId('ch'), serverId, categoryId: catMediaId, name: 'Vídeo & Tela', topic: 'Câmera e compartilhamento de tela', type: 'video', position: 1, createdAt: now, updatedAt: now },
      ];
      this.syncAll(state);
      this.emitLocal({ type: 'instant:server-created', serverId });
      return;
    }

    if (type === 'instant:server-join') {
      const code = String(msg.inviteCode || '').trim().toUpperCase();
      const serverIdParam = String(msg.serverId || '').trim();
      const targetSrv = serverIdParam
        ? state.servers.find((s) => s.id === serverIdParam && (s.visibility ?? 'public') === 'public')
        : state.servers.find((s) => s.inviteCode === code);
      if (!targetSrv) {
        this.emitLocal({ type: 'instant:error', message: 'Sala não encontrada ou convite inválido.' });
        return;
      }
      const list = state.membersByServer[targetSrv.id] || [];
      if (!list.some((m) => m.uid === this.uid)) {
        list.push({ uid: this.uid, serverId: targetSrv.id, role: 'member', joinedAt: Date.now() });
        state.membersByServer[targetSrv.id] = list;
      }
      this.syncAll(state);
      this.emitLocal({ type: 'instant:server-joined', serverId: targetSrv.id });
      return;
    }

    if (type === 'instant:server-update') {
      const srv = state.servers.find((s) => s.id === msg.serverId);
      if (!srv) return;
      if (msg.name !== undefined) {
        srv.name = String(msg.name).slice(0, 64) || srv.name;
        srv.iconInitials = initialsFrom(srv.name);
      }
      if (msg.description !== undefined) srv.description = String(msg.description).slice(0, 240);
      if (msg.iconDataUrl !== undefined) srv.iconDataUrl = String(msg.iconDataUrl).slice(0, 200000);
      if (msg.visibility === 'public' || msg.visibility === 'private') srv.visibility = msg.visibility;
      if (
        msg.retention === '5m' ||
        msg.retention === '15m' ||
        msg.retention === '60m' ||
        msg.retention === 'until_close'
      ) {
        srv.retention = msg.retention;
      }
      if (msg.clearOnClose !== undefined) srv.clearOnClose = Boolean(msg.clearOnClose);
      srv.updatedAt = Date.now();
      this.syncAll(state);
      return;
    }

    if (type === 'instant:server-leave') {
      const serverId = String(msg.serverId || '');
      state.membersByServer[serverId] = (state.membersByServer[serverId] || []).filter(
        (m) => m.uid !== this.uid || m.role === 'owner'
      );
      this.syncAll(state);
      return;
    }

    if (type === 'instant:server-close') {
      const serverId = String(msg.serverId || '');
      if (serverId === DEFAULT_SERVER_ID || serverId === SECONDARY_PUBLIC_SERVER_ID) {
        this.emitLocal({ type: 'instant:error', message: 'Salas públicas padrão não podem ser encerradas.' });
        return;
      }
      const srv = state.servers.find((s) => s.id === serverId);
      if (!srv) return;
      const chs = state.channelsByServer[serverId] || [];
      if (srv.clearOnClose !== false) {
        for (const ch of chs) {
          delete state.messagesByChannel[ch.id];
          delete state.reactionsByChannel[ch.id];
        }
      }
      state.servers = state.servers.filter((s) => s.id !== serverId);
      delete state.membersByServer[serverId];
      delete state.categoriesByServer[serverId];
      delete state.channelsByServer[serverId];
      this.syncAll(state);
      this.emitLocal({ type: 'zone:room-closed', serverId, serverName: srv.name });
      this.broadcast({ type: 'zone:room-closed', serverId, serverName: srv.name });
      return;
    }

    if (type === 'instant:member-role') {
      const serverId = String(msg.serverId || '');
      const target = (state.membersByServer[serverId] || []).find((m) => m.uid === msg.targetUid);
      if (target && target.role !== 'owner') {
        target.role = msg.role === 'admin' ? 'admin' : 'member';
        this.syncAll(state);
      }
      return;
    }

    if (
      type === 'instant:category-create' ||
      type === 'instant:category-update' ||
      type === 'instant:category-delete'
    ) {
      const serverId = String(msg.serverId || '');
      const cats = state.categoriesByServer[serverId] || [];
      const now = Date.now();
      if (type === 'instant:category-create') {
        cats.push({
          id: makeId('cat'),
          serverId,
          name: String(msg.name || 'Categoria').slice(0, 40),
          position: cats.length,
          createdAt: now,
          updatedAt: now,
        });
        state.categoriesByServer[serverId] = cats;
      } else if (type === 'instant:category-update') {
        const c = cats.find((x) => x.id === msg.categoryId);
        if (c) {
          c.name = String(msg.name || c.name).slice(0, 40);
          c.updatedAt = now;
        }
      } else {
        state.categoriesByServer[serverId] = cats.filter((c) => c.id !== msg.categoryId);
      }
      this.syncAll(state);
      return;
    }

    if (
      type === 'instant:channel-create' ||
      type === 'instant:channel-update' ||
      type === 'instant:channel-delete' ||
      type === 'instant:channel-move'
    ) {
      const serverId = String(msg.serverId || '');
      const chs = state.channelsByServer[serverId] || [];
      const now = Date.now();
      if (type === 'instant:channel-create') {
        const chType = (msg.channelType as ChannelDoc['type']) || 'text';
        const rawName = String(msg.name || 'canal');
        chs.push({
          id: makeId('ch'),
          serverId,
          categoryId: String(msg.categoryId || ''),
          name: (chType === 'text' ? rawName.toLowerCase().replace(/\s+/g, '-') : rawName).slice(0, 48),
          topic: String(msg.topic || '').slice(0, 160),
          type: chType,
          position: chs.filter((c) => c.categoryId === msg.categoryId).length,
          createdAt: now,
          updatedAt: now,
        });
        state.channelsByServer[serverId] = chs;
      } else if (type === 'instant:channel-update') {
        const ch = chs.find((c) => c.id === msg.channelId);
        if (ch) {
          if (msg.name !== undefined) ch.name = String(msg.name).slice(0, 48);
          if (msg.topic !== undefined) ch.topic = String(msg.topic).slice(0, 160);
          if (msg.channelType !== undefined) ch.type = msg.channelType as ChannelDoc['type'];
          if (msg.categoryId !== undefined) ch.categoryId = String(msg.categoryId);
          ch.updatedAt = now;
        }
      } else if (type === 'instant:channel-delete') {
        state.channelsByServer[serverId] = chs.filter((c) => c.id !== msg.channelId);
      } else if (type === 'instant:channel-move') {
        const ch = chs.find((c) => c.id === msg.channelId);
        if (ch) {
          const siblings = chs
            .filter((c) => c.categoryId === ch.categoryId)
            .sort((a, b) => a.position - b.position);
          const idx = siblings.findIndex((c) => c.id === ch.id);
          const swapIdx = msg.direction === 'up' ? idx - 1 : idx + 1;
          if (idx >= 0 && swapIdx >= 0 && swapIdx < siblings.length) {
            const other = siblings[swapIdx];
            const tmp = ch.position;
            ch.position = other.position;
            other.position = tmp;
          }
        }
      }
      this.syncAll(state);
      return;
    }

    if (type === 'instant:message-send') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const user = state.usersByUid[this.uid];
      const srv = state.servers.find((s) => s.id === serverId);
      if (!user || !channelId) return;
      const arr = state.messagesByChannel[channelId] || [];
      const now = Date.now();
      const retMs = retentionToMs(srv?.retention);
      arr.push({
        id: makeId('msg'),
        serverId,
        channelId,
        authorId: user.uid,
        authorName: user.displayName,
        authorTag: user.tag,
        authorAvatar: user.avatarDataUrl,
        content: String(msg.content || '').slice(0, 4000),
        attachmentId: msg.attachmentId ? String(msg.attachmentId) : undefined,
        attachmentName: String(msg.attachmentName || '').slice(0, 140),
        attachmentType: String(msg.attachmentType || '').slice(0, 100),
        attachmentSize: typeof msg.attachmentSize === 'number' ? msg.attachmentSize : undefined,
        attachmentDataUrl: String(msg.attachmentDataUrl || '').slice(0, 450000),
        attachmentUrl: msg.attachmentUrl ? String(msg.attachmentUrl).slice(0, 400) : undefined,
        attachmentExpiresAt:
          typeof msg.attachmentExpiresAt === 'number' ? msg.attachmentExpiresAt : undefined,
        attachmentExpired: false,
        replyToId: String(msg.replyToId || ''),
        replyToAuthor: String(msg.replyToAuthor || ''),
        replyToSnippet: String(msg.replyToSnippet || '').slice(0, 160),
        edited: false,
        expiresAt: retMs ? now + retMs : undefined,
        createdAt: now,
        updatedAt: now,
      });
      state.messagesByChannel[channelId] = arr.slice(-200);
      this.syncAll(state);
      return;
    }

    if (type === 'instant:message-edit') {
      const channelId = String(msg.channelId || '');
      const m = (state.messagesByChannel[channelId] || []).find(
        (x) => x.id === msg.messageId && x.authorId === this.uid
      );
      if (m) {
        m.content = String(msg.content || '').slice(0, 4000);
        m.edited = true;
        m.updatedAt = Date.now();
        this.syncAll(state);
      }
      return;
    }

    if (type === 'instant:message-delete') {
      const channelId = String(msg.channelId || '');
      state.messagesByChannel[channelId] = (state.messagesByChannel[channelId] || []).filter(
        (m) => m.id !== msg.messageId
      );
      this.syncAll(state);
      return;
    }

    if (type === 'instant:reaction-toggle') {
      const channelId = String(msg.channelId || '');
      const messageId = String(msg.messageId || '');
      const emoji = String(msg.emoji || '').slice(0, 16);
      const arr = state.reactionsByChannel[channelId] || [];
      const idx = arr.findIndex(
        (r) => r.messageId === messageId && r.userId === this.uid && r.emoji === emoji
      );
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push({ id: makeId('rx'), messageId, userId: this.uid, emoji, createdAt: Date.now() });
      state.reactionsByChannel[channelId] = arr;
      this.syncAll(state);
      return;
    }

    if (type === 'instant:friend-request') {
      const uname = String(msg.username || '').replace(/^@/, '').toLowerCase();
      const targetUid = String(msg.targetUid || '');
      const target = targetUid
        ? state.usersByUid[targetUid]
        : Object.values(state.usersByUid).find((u) => u.username === uname);
      if (!target || target.uid === this.uid) {
        this.emitLocal({ type: 'instant:error', message: 'Participante não encontrado.' });
        return;
      }
      const fId = this.uid < target.uid ? `${this.uid}_${target.uid}` : `${target.uid}_${this.uid}`;
      const now = Date.now();
      const existing = state.friendships.find((f) => f.id === fId);
      if (!existing || existing.status === 'declined') {
        state.friendships = state.friendships.filter((f) => f.id !== fId);
        state.friendships.push({
          id: fId,
          users: [this.uid, target.uid],
          requesterId: this.uid,
          recipientId: target.uid,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
        const list = state.notificationsByUser[target.uid] || [];
        list.unshift({
          id: makeId('ntf'),
          recipientId: target.uid,
          senderId: this.uid,
          senderName: this.displayName,
          type: 'friend_request',
          title: 'Nova solicitação',
          body: `${this.displayName} quer conectar-se com você.`,
          linkServerId: '',
          linkChannelId: '',
          linkUserId: this.uid,
          read: false,
          createdAt: now,
        });
        state.notificationsByUser[target.uid] = list;
        this.syncAll(state);
      }
      return;
    }

    if (type === 'instant:friend-respond') {
      const f = state.friendships.find((x) => x.id === msg.friendshipId);
      if (f && f.recipientId === this.uid) {
        f.status = msg.accept ? 'accepted' : 'declined';
        f.updatedAt = Date.now();
        this.syncAll(state);
      }
      return;
    }

    if (type === 'instant:friend-remove') {
      state.friendships = state.friendships.filter((x) => x.id !== msg.friendshipId);
      this.syncAll(state);
      return;
    }

    if (type === 'instant:dm-open') {
      const peerUid = String(msg.peerUid || '');
      if (!peerUid) return;
      const threadId = this.uid < peerUid ? `${this.uid}_${peerUid}` : `${peerUid}_${this.uid}`;
      if (!state.dmThreads.some((t) => t.id === threadId)) {
        const now = Date.now();
        state.dmThreads.push({
          id: threadId,
          participants: [this.uid, peerUid],
          lastMessagePreview: '',
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      this.syncAll(state);
      return;
    }

    if (type === 'instant:dm-send') {
      const peerUid = String(msg.peerUid || '');
      const user = state.usersByUid[this.uid];
      if (!peerUid || !user) return;
      const threadId = this.uid < peerUid ? `${this.uid}_${peerUid}` : `${peerUid}_${this.uid}`;
      const now = Date.now();
      let thread = state.dmThreads.find((t) => t.id === threadId);
      if (!thread) {
        thread = {
          id: threadId,
          participants: [this.uid, peerUid],
          lastMessagePreview: '',
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        };
        state.dmThreads.push(thread);
      }
      const content = String(msg.content || '').slice(0, 4000);
      const attachmentName = String(msg.attachmentName || '').slice(0, 140);
      const arr = state.dmMessagesByThread[threadId] || [];
      arr.push({
        id: makeId('dm'),
        threadId,
        authorId: user.uid,
        authorName: user.displayName,
        authorTag: user.tag,
        authorAvatar: user.avatarDataUrl,
        content,
        attachmentId: msg.attachmentId ? String(msg.attachmentId) : undefined,
        attachmentName,
        attachmentType: String(msg.attachmentType || '').slice(0, 100),
        attachmentSize: typeof msg.attachmentSize === 'number' ? msg.attachmentSize : undefined,
        attachmentDataUrl: String(msg.attachmentDataUrl || '').slice(0, 450000),
        attachmentUrl: msg.attachmentUrl ? String(msg.attachmentUrl).slice(0, 400) : undefined,
        attachmentExpiresAt:
          typeof msg.attachmentExpiresAt === 'number' ? msg.attachmentExpiresAt : undefined,
        attachmentExpired: false,
        replyToId: String(msg.replyToId || ''),
        replyToAuthor: String(msg.replyToAuthor || ''),
        replyToSnippet: String(msg.replyToSnippet || '').slice(0, 160),
        edited: false,
        createdAt: now,
        updatedAt: now,
      });
      state.dmMessagesByThread[threadId] = arr;
      thread.lastMessagePreview = content
        ? content.slice(0, 120)
        : `Arquivo: ${attachmentName || 'mídia'}`;
      thread.lastMessageAt = now;
      thread.updatedAt = now;
      this.syncAll(state);
      return;
    }

    if (type === 'instant:dm-edit' || type === 'instant:dm-delete' || type === 'instant:dm-reaction') {
      const peerUid = String(msg.peerUid || '');
      const threadId = this.uid < peerUid ? `${this.uid}_${peerUid}` : `${peerUid}_${this.uid}`;
      if (type === 'instant:dm-edit') {
        const m = (state.dmMessagesByThread[threadId] || []).find(
          (x) => x.id === msg.messageId && x.authorId === this.uid
        );
        if (m) {
          m.content = String(msg.content || '').slice(0, 4000);
          m.edited = true;
          m.updatedAt = Date.now();
        }
      } else if (type === 'instant:dm-delete') {
        state.dmMessagesByThread[threadId] = (state.dmMessagesByThread[threadId] || []).filter(
          (x) => !(x.id === msg.messageId && x.authorId === this.uid)
        );
      } else {
        const arr = state.dmReactionsByThread[threadId] || [];
        const messageId = String(msg.messageId || '');
        const emoji = String(msg.emoji || '').slice(0, 16);
        const idx = arr.findIndex(
          (r) => r.messageId === messageId && r.userId === this.uid && r.emoji === emoji
        );
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push({ id: makeId('rx'), messageId, userId: this.uid, emoji, createdAt: Date.now() });
        state.dmReactionsByThread[threadId] = arr;
      }
      this.syncAll(state);
      return;
    }

    if (type === 'instant:notification-read') {
      const list = state.notificationsByUser[this.uid] || [];
      if (msg.all) {
        list.forEach((n) => (n.read = true));
      } else {
        const n = list.find((x) => x.id === msg.notificationId);
        if (n) n.read = true;
      }
      this.syncAll(state);
      return;
    }

    if (type === 'instant:invite-notify') {
      const recipientId = String(msg.recipientId || '');
      const srv = state.servers.find((s) => s.id === msg.serverId);
      if (recipientId && srv) {
        const list = state.notificationsByUser[recipientId] || [];
        list.unshift({
          id: makeId('ntf'),
          recipientId,
          senderId: this.uid,
          senderName: this.displayName,
          type: 'invite',
          title: `Convite para ${srv.name}`,
          body: `Use o código ${srv.inviteCode} para entrar na sala.`,
          linkServerId: srv.id,
          linkChannelId: '',
          linkUserId: this.uid,
          read: false,
          createdAt: Date.now(),
        });
        state.notificationsByUser[recipientId] = list;
        this.syncAll(state);
      }
    }
  }

  private leaveVoiceInState(state: PersistedHubState) {
    if (!this.voiceChannelId) return;
    const room = state.voiceRooms[this.voiceChannelId];
    if (room) {
      const existing = room[this.uid];
      delete room[this.uid];
      if (existing?.screenSharing) {
        this.broadcast({
          type: 'screen:stopped',
          serverId: this.voiceServerId,
          channelId: this.voiceChannelId,
          uid: this.uid,
          displayName: this.displayName,
        });
      }
      this.broadcast({
        type: 'room:peer-left',
        channelId: this.voiceChannelId,
        uid: this.uid,
      });
    }
    this.voiceChannelId = null;
    this.voiceServerId = null;
  }

  public dispose() {
    if (this.cleanupTimer) {
      window.clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    const state = loadState();
    const prevSrv = this.voiceServerId;
    this.leaveVoiceInState(state);
    state.presences[this.uid] = 'invisible';
    saveState(state);
    this.broadcast({ type: 'hub:sync', serverId: prevSrv });
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
  }
}
