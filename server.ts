import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientMeta {
  ws: WebSocket;
  uid: string;
  displayName: string;
  avatarDataUrl: string;
  presence: 'online' | 'idle' | 'dnd' | 'invisible';
  isInstant: boolean;
  activeServerId: string | null;
  activeChannelId: string | null;
  voiceChannelId: string | null;
  voiceServerId: string | null;
}

interface RoomParticipantState {
  uid: string;
  displayName: string;
  avatarDataUrl: string;
  serverId: string;
  channelId: string;
  micMuted: boolean;
  camEnabled: boolean;
  screenSharing: boolean;
  speaking: boolean;
  joinedAt: number;
}

const clients = new Map<WebSocket, ClientMeta>();
const userSockets = new Map<string, Set<WebSocket>>();
const voiceRooms = new Map<string, Map<string, RoomParticipantState>>();

// --- Authoritative In-Memory Store for Account-Free / Instant Mode ---
interface InstantUser {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  customStatus: string;
  presence: 'online' | 'idle' | 'dnd' | 'invisible';
  avatarDataUrl: string;
  createdAt: number;
  updatedAt: number;
}

interface InstantServer {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  iconInitials: string;
  iconDataUrl: string;
  ownerId: string;
  inviteCode: string;
  createdAt: number;
  updatedAt: number;
}

interface InstantMember {
  uid: string;
  serverId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: number;
}

interface InstantCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

interface InstantChannel {
  id: string;
  serverId: string;
  categoryId: string;
  name: string;
  topic: string;
  type: 'text' | 'voice' | 'video';
  position: number;
  createdAt: number;
  updatedAt: number;
}

interface InstantMessage {
  id: string;
  serverId?: string;
  channelId?: string;
  threadId?: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  attachmentName: string;
  attachmentType: string;
  attachmentDataUrl: string;
  replyToId: string;
  replyToAuthor: string;
  replyToSnippet: string;
  edited: boolean;
  createdAt: number;
  updatedAt: number;
}

interface InstantReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: number;
}

interface InstantFriendship {
  id: string;
  users: string[];
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  updatedAt: number;
}

interface InstantDmThread {
  id: string;
  participants: string[];
  lastMessagePreview: string;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
}

interface InstantNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  type: 'message' | 'dm' | 'invite' | 'friend_request' | 'voice_join' | 'screen_share';
  title: string;
  body: string;
  linkServerId: string;
  linkChannelId: string;
  linkUserId: string;
  read: boolean;
  createdAt: number;
}

const DEFAULT_SERVER_ID = 'srv_open_eu';

const instantUsers = new Map<string, InstantUser>();
const instantServers = new Map<string, InstantServer>();
const instantMembers = new Map<string, InstantMember[]>();
const instantCategories = new Map<string, InstantCategory[]>();
const instantChannels = new Map<string, InstantChannel[]>();
const instantMessages = new Map<string, InstantMessage[]>();
const instantReactions = new Map<string, InstantReaction[]>();
const instantFriendships = new Map<string, InstantFriendship>();
const instantDmThreads = new Map<string, InstantDmThread>();
const instantDmMessages = new Map<string, InstantMessage[]>();
const instantDmReactions = new Map<string, InstantReaction[]>();
const instantNotifications = new Map<string, InstantNotification[]>();

function seedDefaultInstantServer() {
  if (instantServers.has(DEFAULT_SERVER_ID)) return;
  const now = Date.now();
  instantServers.set(DEFAULT_SERVER_ID, {
    id: DEFAULT_SERVER_ID,
    name: 'Vesper Europa',
    description: 'Sala aberta em tempo real sem necessidade de cadastro ou banco de dados.',
    iconColor: '#5B6AF0',
    iconInitials: 'VE',
    iconDataUrl: '',
    ownerId: 'system',
    inviteCode: 'VESPEREU',
    createdAt: now,
    updatedAt: now,
  });
  instantMembers.set(DEFAULT_SERVER_ID, []);
  instantCategories.set(DEFAULT_SERVER_ID, [
    {
      id: 'cat_text_eu',
      serverId: DEFAULT_SERVER_ID,
      name: 'Canais de Texto',
      position: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cat_media_eu',
      serverId: DEFAULT_SERVER_ID,
      name: 'Voz, Vídeo & Tela',
      position: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  instantChannels.set(DEFAULT_SERVER_ID, [
    {
      id: 'ch_geral_eu',
      serverId: DEFAULT_SERVER_ID,
      categoryId: 'cat_text_eu',
      name: 'geral',
      topic: 'Conversa aberta em tempo real — envie mensagens, imagens, arquivos ou compartilhe sua tela.',
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
      topic: 'Áudio em tempo real com controle individual de volume.',
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
      topic: 'Vídeo e compartilhamento de tela em alta definição com modo TELA CHEIA.',
      type: 'video',
      position: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}
seedDefaultInstantServer();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeInvite(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'VS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function buildInstantSnapshotForUser(uid: string) {
  const userServers: InstantServer[] = [];
  const membersMap: Record<string, InstantMember[]> = {};
  const categoriesMap: Record<string, InstantCategory[]> = {};
  const channelsMap: Record<string, InstantChannel[]> = {};
  const messagesMap: Record<string, InstantMessage[]> = {};
  const reactionsMap: Record<string, InstantReaction[]> = {};

  for (const [srvId, srv] of instantServers) {
    const srvMembers = instantMembers.get(srvId) || [];
    if (srvMembers.some((m) => m.uid === uid)) {
      userServers.push(srv);
      membersMap[srvId] = srvMembers;
      categoriesMap[srvId] = instantCategories.get(srvId) || [];
      const chs = instantChannels.get(srvId) || [];
      channelsMap[srvId] = chs;
      for (const ch of chs) {
        messagesMap[ch.id] = instantMessages.get(ch.id) || [];
        reactionsMap[ch.id] = instantReactions.get(ch.id) || [];
      }
    }
  }

  const usersObj: Record<string, InstantUser> = {};
  for (const [uId, u] of instantUsers) {
    usersObj[uId] = u;
  }

  const userFriendships = Array.from(instantFriendships.values()).filter((f) =>
    f.users.includes(uid)
  );
  const userDmThreads = Array.from(instantDmThreads.values()).filter((t) =>
    t.participants.includes(uid)
  );
  const dmMsgs: Record<string, InstantMessage[]> = {};
  const dmReacts: Record<string, InstantReaction[]> = {};
  for (const t of userDmThreads) {
    dmMsgs[t.id] = instantDmMessages.get(t.id) || [];
    dmReacts[t.id] = instantDmReactions.get(t.id) || [];
  }

  return {
    type: 'instant:snapshot',
    usersByUid: usersObj,
    servers: userServers,
    membersByServer: membersMap,
    categoriesByServer: categoriesMap,
    channelsByServer: channelsMap,
    messagesByChannel: messagesMap,
    reactionsByChannel: reactionsMap,
    friendships: userFriendships,
    dmThreads: userDmThreads,
    dmMessagesByThread: dmMsgs,
    dmReactionsByThread: dmReacts,
    notifications: instantNotifications.get(uid) || [],
  };
}

function pushInstantSyncToUsers(targetUids?: string[]) {
  for (const [sock, meta] of clients) {
    if (!meta.isInstant || !meta.uid) continue;
    if (targetUids && !targetUids.includes(meta.uid)) continue;
    sendToSocket(sock, buildInstantSnapshotForUser(meta.uid));
  }
}

function sendToSocket(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendToUser(uid: string, payload: unknown) {
  const sockets = userSockets.get(uid);
  if (!sockets) return;
  for (const sock of sockets) {
    sendToSocket(sock, payload);
  }
}

function broadcastAll(payload: unknown, excludeWs?: WebSocket) {
  for (const [sock] of clients) {
    if (sock !== excludeWs) {
      sendToSocket(sock, payload);
    }
  }
}

function broadcastToRoom(channelId: string, payload: unknown, excludeUid?: string) {
  const room = voiceRooms.get(channelId);
  if (!room) return;
  for (const [uid] of room) {
    if (uid !== excludeUid) {
      sendToUser(uid, payload);
    }
  }
}

function getServerVoiceRoster(serverId: string): Record<string, RoomParticipantState[]> {
  const roster: Record<string, RoomParticipantState[]> = {};
  for (const [channelId, participants] of voiceRooms) {
    const list: RoomParticipantState[] = [];
    for (const p of participants.values()) {
      if (p.serverId === serverId) {
        list.push(p);
      }
    }
    if (list.length > 0) {
      roster[channelId] = list;
    }
  }
  return roster;
}

function broadcastVoiceRoster(serverId: string) {
  const roster = getServerVoiceRoster(serverId);
  broadcastAll({
    type: 'server:voice-roster',
    serverId,
    roster,
  });
}

function removeParticipantFromRoom(meta: ClientMeta) {
  const channelId = meta.voiceChannelId;
  const serverId = meta.voiceServerId;
  if (!channelId || !serverId) return;

  const room = voiceRooms.get(channelId);
  if (room) {
    const existing = room.get(meta.uid);
    room.delete(meta.uid);
    if (room.size === 0) {
      voiceRooms.delete(channelId);
    }
    if (existing?.screenSharing) {
      broadcastAll({
        type: 'screen:stopped',
        serverId,
        channelId,
        uid: meta.uid,
        displayName: meta.displayName,
      });
    }
    broadcastToRoom(channelId, {
      type: 'room:peer-left',
      channelId,
      uid: meta.uid,
    });
  }

  meta.voiceChannelId = null;
  meta.voiceServerId = null;
  broadcastVoiceRoster(serverId);
}

function getOnlinePresenceSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const meta of clients.values()) {
    if (meta.uid) {
      snapshot[meta.uid] = meta.presence;
    }
  }
  return snapshot;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Permissions-Policy',
      'display-capture=*, microphone=*, camera=*, fullscreen=*'
    );
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  wss.on('connection', (ws) => {
    const meta: ClientMeta = {
      ws,
      uid: '',
      displayName: '',
      avatarDataUrl: '',
      presence: 'online',
      isInstant: false,
      activeServerId: null,
      activeChannelId: null,
      voiceChannelId: null,
      voiceServerId: null,
    };
    clients.set(ws, meta);

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = msg.type as string;

      if (type === 'ping') {
        sendToSocket(ws, { type: 'pong', ts: Date.now() });
        return;
      }

      if (type === 'auth:hello') {
        const uid = String(msg.uid || '');
        if (!uid) return;
        meta.uid = uid;
        meta.displayName = String(msg.displayName || 'Usuário');
        meta.avatarDataUrl = String(msg.avatarDataUrl || '');
        meta.presence = (msg.presence as ClientMeta['presence']) || 'online';
        meta.isInstant = Boolean(msg.isInstant);

        if (!userSockets.has(uid)) {
          userSockets.set(uid, new Set());
        }
        userSockets.get(uid)!.add(ws);

        sendToSocket(ws, {
          type: 'presence:snapshot',
          presences: getOnlinePresenceSnapshot(),
        });

        broadcastAll(
          {
            type: 'presence:update',
            uid: meta.uid,
            presence: meta.presence,
          },
          ws
        );

        if (meta.isInstant) {
          const now = Date.now();
          const existingUser = instantUsers.get(uid);
          const cleanName = meta.displayName.slice(0, 48) || 'Convidado';
          const cleanUsername =
            String(msg.username || existingUser?.username || cleanName)
              .toLowerCase()
              .replace(/[^a-z0-9_.-]/g, '')
              .slice(0, 32) || `convidado_${uid.slice(-4)}`;

          instantUsers.set(uid, {
            uid,
            displayName: cleanName,
            username: cleanUsername,
            bio: existingUser?.bio ?? 'Conectado via Modo Instantâneo Vesper.',
            customStatus: existingUser?.customStatus ?? '',
            presence: meta.presence,
            avatarDataUrl: meta.avatarDataUrl || existingUser?.avatarDataUrl || '',
            createdAt: existingUser?.createdAt ?? now,
            updatedAt: now,
          });

          const openMembers = instantMembers.get(DEFAULT_SERVER_ID) || [];
          if (!openMembers.some((m) => m.uid === uid)) {
            openMembers.push({
              uid,
              serverId: DEFAULT_SERVER_ID,
              role: openMembers.length === 0 ? 'owner' : 'member',
              joinedAt: now,
            });
            instantMembers.set(DEFAULT_SERVER_ID, openMembers);
          }

          pushInstantSyncToUsers();
        }
        return;
      }

      if (!meta.uid) return;

      // --- Instant Mode Handlers ---
      if (type === 'instant:profile-update') {
        const user = instantUsers.get(meta.uid);
        if (!user) return;
        const updates = (msg.updates as Partial<InstantUser>) || {};
        if (updates.displayName !== undefined) user.displayName = String(updates.displayName).slice(0, 48) || user.displayName;
        if (updates.username !== undefined) user.username = String(updates.username).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 32) || user.username;
        if (updates.bio !== undefined) user.bio = String(updates.bio).slice(0, 240);
        if (updates.customStatus !== undefined) user.customStatus = String(updates.customStatus).slice(0, 80);
        if (updates.presence !== undefined) {
          user.presence = updates.presence;
          meta.presence = updates.presence;
        }
        if (updates.avatarDataUrl !== undefined) user.avatarDataUrl = String(updates.avatarDataUrl).slice(0, 200000);
        user.updatedAt = Date.now();
        meta.displayName = user.displayName;
        meta.avatarDataUrl = user.avatarDataUrl;
        pushInstantSyncToUsers();
        return;
      }

      if (type === 'instant:server-create') {
        const now = Date.now();
        const serverId = makeId('srv');
        const name = String(msg.name || 'Nova Comunidade').slice(0, 64);
        const description = String(msg.description || '').slice(0, 240);
        const iconColor = String(msg.iconColor || '#5B6AF0');
        const inviteCode = makeInvite();

        instantServers.set(serverId, {
          id: serverId,
          name,
          description,
          iconColor,
          iconInitials: initialsFrom(name),
          iconDataUrl: '',
          ownerId: meta.uid,
          inviteCode,
          createdAt: now,
          updatedAt: now,
        });
        instantMembers.set(serverId, [{ uid: meta.uid, serverId, role: 'owner', joinedAt: now }]);
        const catTextId = makeId('cat');
        const catMediaId = makeId('cat');
        instantCategories.set(serverId, [
          { id: catTextId, serverId, name: 'Canais de Texto', position: 0, createdAt: now, updatedAt: now },
          { id: catMediaId, serverId, name: 'Voz, Vídeo & Tela', position: 1, createdAt: now, updatedAt: now },
        ]);
        instantChannels.set(serverId, [
          { id: makeId('ch'), serverId, categoryId: catTextId, name: 'geral', topic: 'Conversas da comunidade', type: 'text', position: 0, createdAt: now, updatedAt: now },
          { id: makeId('ch'), serverId, categoryId: catMediaId, name: 'Lounge de Voz', topic: 'Áudio em tempo real', type: 'voice', position: 0, createdAt: now, updatedAt: now },
          { id: makeId('ch'), serverId, categoryId: catMediaId, name: 'Sala Vídeo & Tela', topic: 'Vídeo e compartilhamento de tela', type: 'video', position: 1, createdAt: now, updatedAt: now },
        ]);
        sendToSocket(ws, { type: 'instant:server-created', serverId });
        pushInstantSyncToUsers([meta.uid]);
        return;
      }

      if (type === 'instant:server-join') {
        const code = String(msg.inviteCode || '').trim().toUpperCase();
        const targetSrv = Array.from(instantServers.values()).find((s) => s.inviteCode === code);
        if (!targetSrv) {
          sendToSocket(ws, { type: 'instant:error', message: 'Código de convite não encontrado nesta sessão.' });
          return;
        }
        const list = instantMembers.get(targetSrv.id) || [];
        if (!list.some((m) => m.uid === meta.uid)) {
          list.push({ uid: meta.uid, serverId: targetSrv.id, role: 'member', joinedAt: Date.now() });
          instantMembers.set(targetSrv.id, list);
        }
        sendToSocket(ws, { type: 'instant:server-joined', serverId: targetSrv.id });
        pushInstantSyncToUsers(list.map((m) => m.uid));
        return;
      }

      if (type === 'instant:server-update') {
        const srv = instantServers.get(String(msg.serverId || ''));
        if (!srv) return;
        const membersList = instantMembers.get(srv.id) || [];
        const me = membersList.find((m) => m.uid === meta.uid);
        if (!me || (me.role !== 'owner' && me.role !== 'admin')) return;
        if (msg.name !== undefined) {
          srv.name = String(msg.name).slice(0, 64) || srv.name;
          srv.iconInitials = initialsFrom(srv.name);
        }
        if (msg.description !== undefined) srv.description = String(msg.description).slice(0, 240);
        if (msg.iconDataUrl !== undefined) srv.iconDataUrl = String(msg.iconDataUrl).slice(0, 200000);
        srv.updatedAt = Date.now();
        pushInstantSyncToUsers(membersList.map((m) => m.uid));
        return;
      }

      if (type === 'instant:server-leave') {
        const serverId = String(msg.serverId || '');
        const membersList = instantMembers.get(serverId) || [];
        const filtered = membersList.filter((m) => m.uid !== meta.uid || m.role === 'owner');
        instantMembers.set(serverId, filtered);
        pushInstantSyncToUsers([meta.uid, ...filtered.map((m) => m.uid)]);
        return;
      }

      if (type === 'instant:member-role') {
        const serverId = String(msg.serverId || '');
        const targetUid = String(msg.targetUid || '');
        const role = msg.role === 'admin' ? 'admin' : 'member';
        const list = instantMembers.get(serverId) || [];
        const me = list.find((m) => m.uid === meta.uid);
        if (!me || me.role !== 'owner') return;
        const target = list.find((m) => m.uid === targetUid);
        if (target && target.role !== 'owner') {
          target.role = role;
          pushInstantSyncToUsers(list.map((m) => m.uid));
        }
        return;
      }

      if (type === 'instant:category-create' || type === 'instant:category-update' || type === 'instant:category-delete') {
        const serverId = String(msg.serverId || '');
        const list = instantMembers.get(serverId) || [];
        const me = list.find((m) => m.uid === meta.uid);
        if (!me || (me.role !== 'owner' && me.role !== 'admin')) return;
        const cats = instantCategories.get(serverId) || [];
        const now = Date.now();
        if (type === 'instant:category-create') {
          cats.push({ id: makeId('cat'), serverId, name: String(msg.name || 'Categoria').slice(0, 40), position: cats.length, createdAt: now, updatedAt: now });
          instantCategories.set(serverId, cats);
        } else if (type === 'instant:category-update') {
          const cat = cats.find((c) => c.id === msg.categoryId);
          if (cat) {
            cat.name = String(msg.name || cat.name).slice(0, 40);
            cat.updatedAt = now;
          }
        } else {
          instantCategories.set(serverId, cats.filter((c) => c.id !== msg.categoryId));
        }
        pushInstantSyncToUsers(list.map((m) => m.uid));
        return;
      }

      if (type === 'instant:channel-create' || type === 'instant:channel-update' || type === 'instant:channel-delete' || type === 'instant:channel-move') {
        const serverId = String(msg.serverId || '');
        const list = instantMembers.get(serverId) || [];
        const me = list.find((m) => m.uid === meta.uid);
        if (!me || (me.role !== 'owner' && me.role !== 'admin')) return;
        const chs = instantChannels.get(serverId) || [];
        const now = Date.now();
        if (type === 'instant:channel-create') {
          const chType = (msg.channelType as InstantChannel['type']) || 'text';
          const rawName = String(msg.name || 'canal');
          const cleanName = (chType === 'text' ? rawName.toLowerCase().replace(/\s+/g, '-') : rawName).slice(0, 48);
          chs.push({
            id: makeId('ch'),
            serverId,
            categoryId: String(msg.categoryId || ''),
            name: cleanName,
            topic: String(msg.topic || '').slice(0, 160),
            type: chType,
            position: chs.filter((c) => c.categoryId === msg.categoryId).length,
            createdAt: now,
            updatedAt: now,
          });
          instantChannels.set(serverId, chs);
        } else if (type === 'instant:channel-update') {
          const ch = chs.find((c) => c.id === msg.channelId);
          if (ch) {
            if (msg.name !== undefined) ch.name = String(msg.name).slice(0, 48);
            if (msg.topic !== undefined) ch.topic = String(msg.topic).slice(0, 160);
            if (msg.channelType !== undefined) ch.type = msg.channelType as InstantChannel['type'];
            if (msg.categoryId !== undefined) ch.categoryId = String(msg.categoryId);
            ch.updatedAt = now;
          }
        } else if (type === 'instant:channel-delete') {
          instantChannels.set(serverId, chs.filter((c) => c.id !== msg.channelId));
        } else if (type === 'instant:channel-move') {
          const ch = chs.find((c) => c.id === msg.channelId);
          if (ch) {
            const siblings = chs.filter((c) => c.categoryId === ch.categoryId).sort((a, b) => a.position - b.position);
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
        pushInstantSyncToUsers(list.map((m) => m.uid));
        return;
      }

      if (type === 'instant:message-send') {
        const serverId = String(msg.serverId || '');
        const channelId = String(msg.channelId || '');
        const membersList = instantMembers.get(serverId) || [];
        if (!membersList.some((m) => m.uid === meta.uid)) return;
        const user = instantUsers.get(meta.uid);
        if (!user) return;
        const arr = instantMessages.get(channelId) || [];
        const now = Date.now();
        arr.push({
          id: makeId('msg'),
          serverId,
          channelId,
          authorId: user.uid,
          authorName: user.displayName,
          authorAvatar: user.avatarDataUrl,
          content: String(msg.content || '').slice(0, 4000),
          attachmentName: String(msg.attachmentName || '').slice(0, 140),
          attachmentType: String(msg.attachmentType || '').slice(0, 80),
          attachmentDataUrl: String(msg.attachmentDataUrl || '').slice(0, 450000),
          replyToId: String(msg.replyToId || ''),
          replyToAuthor: String(msg.replyToAuthor || ''),
          replyToSnippet: String(msg.replyToSnippet || '').slice(0, 160),
          edited: false,
          createdAt: now,
          updatedAt: now,
        });
        if (arr.length > 200) arr.splice(0, arr.length - 200);
        instantMessages.set(channelId, arr);
        pushInstantSyncToUsers(membersList.map((m) => m.uid));
        return;
      }

      if (type === 'instant:message-edit') {
        const serverId = String(msg.serverId || '');
        const channelId = String(msg.channelId || '');
        const arr = instantMessages.get(channelId) || [];
        const target = arr.find((m) => m.id === msg.messageId && m.authorId === meta.uid);
        if (target) {
          target.content = String(msg.content || '').slice(0, 4000);
          target.edited = true;
          target.updatedAt = Date.now();
          const membersList = instantMembers.get(serverId) || [];
          pushInstantSyncToUsers(membersList.map((m) => m.uid));
        }
        return;
      }

      if (type === 'instant:message-delete') {
        const serverId = String(msg.serverId || '');
        const channelId = String(msg.channelId || '');
        const membersList = instantMembers.get(serverId) || [];
        const me = membersList.find((m) => m.uid === meta.uid);
        const canMod = me && (me.role === 'owner' || me.role === 'admin');
        const arr = instantMessages.get(channelId) || [];
        instantMessages.set(
          channelId,
          arr.filter((m) => !(m.id === msg.messageId && (m.authorId === meta.uid || canMod)))
        );
        pushInstantSyncToUsers(membersList.map((m) => m.uid));
        return;
      }

      if (type === 'instant:reaction-toggle') {
        const serverId = String(msg.serverId || '');
        const channelId = String(msg.channelId || '');
        const messageId = String(msg.messageId || '');
        const emoji = String(msg.emoji || '').slice(0, 16);
        const membersList = instantMembers.get(serverId) || [];
        if (!membersList.some((m) => m.uid === meta.uid)) return;
        const arr = instantReactions.get(channelId) || [];
        const existingIdx = arr.findIndex(
          (r) => r.messageId === messageId && r.userId === meta.uid && r.emoji === emoji
        );
        if (existingIdx >= 0) {
          arr.splice(existingIdx, 1);
        } else {
          arr.push({ id: makeId('rx'), messageId, userId: meta.uid, emoji, createdAt: Date.now() });
        }
        instantReactions.set(channelId, arr);
        pushInstantSyncToUsers(membersList.map((m) => m.uid));
        return;
      }

      if (type === 'instant:friend-request') {
        const username = String(msg.username || '').replace(/^@/, '').toLowerCase();
        const targetUidInput = String(msg.targetUid || '');
        const target = targetUidInput
          ? instantUsers.get(targetUidInput)
          : Array.from(instantUsers.values()).find((u) => u.username === username);
        if (!target || target.uid === meta.uid) {
          sendToSocket(ws, { type: 'instant:error', message: 'Participante não encontrado na sessão atual.' });
          return;
        }
        const fId = meta.uid < target.uid ? `${meta.uid}_${target.uid}` : `${target.uid}_${meta.uid}`;
        const existing = instantFriendships.get(fId);
        if (existing && existing.status !== 'declined') return;
        const now = Date.now();
        instantFriendships.set(fId, {
          id: fId,
          users: [meta.uid, target.uid],
          requesterId: meta.uid,
          recipientId: target.uid,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
        const list = instantNotifications.get(target.uid) || [];
        list.unshift({
          id: makeId('ntf'),
          recipientId: target.uid,
          senderId: meta.uid,
          senderName: meta.displayName,
          type: 'friend_request',
          title: 'Nova solicitação de amizade',
          body: `${meta.displayName} quer conectar-se com você.`,
          linkServerId: '',
          linkChannelId: '',
          linkUserId: meta.uid,
          read: false,
          createdAt: now,
        });
        instantNotifications.set(target.uid, list);
        pushInstantSyncToUsers([meta.uid, target.uid]);
        return;
      }

      if (type === 'instant:friend-respond') {
        const f = instantFriendships.get(String(msg.friendshipId || ''));
        if (!f || f.recipientId !== meta.uid || f.status !== 'pending') return;
        f.status = msg.accept ? 'accepted' : 'declined';
        f.updatedAt = Date.now();
        pushInstantSyncToUsers(f.users);
        return;
      }

      if (type === 'instant:friend-remove') {
        const f = instantFriendships.get(String(msg.friendshipId || ''));
        if (!f || !f.users.includes(meta.uid)) return;
        instantFriendships.delete(f.id);
        pushInstantSyncToUsers(f.users);
        return;
      }

      if (type === 'instant:dm-open') {
        const peerUid = String(msg.peerUid || '');
        if (!peerUid || peerUid === meta.uid) return;
        const threadId = meta.uid < peerUid ? `${meta.uid}_${peerUid}` : `${peerUid}_${meta.uid}`;
        if (!instantDmThreads.has(threadId)) {
          const now = Date.now();
          instantDmThreads.set(threadId, {
            id: threadId,
            participants: [meta.uid, peerUid],
            lastMessagePreview: '',
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
        pushInstantSyncToUsers([meta.uid, peerUid]);
        return;
      }

      if (type === 'instant:dm-send') {
        const peerUid = String(msg.peerUid || '');
        const threadId = meta.uid < peerUid ? `${meta.uid}_${peerUid}` : `${peerUid}_${meta.uid}`;
        const user = instantUsers.get(meta.uid);
        if (!user || !peerUid) return;
        const now = Date.now();
        let thread = instantDmThreads.get(threadId);
        if (!thread) {
          thread = {
            id: threadId,
            participants: [meta.uid, peerUid],
            lastMessagePreview: '',
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
          };
          instantDmThreads.set(threadId, thread);
        }
        const content = String(msg.content || '').slice(0, 4000);
        const attachmentName = String(msg.attachmentName || '').slice(0, 140);
        const arr = instantDmMessages.get(threadId) || [];
        arr.push({
          id: makeId('dm'),
          threadId,
          authorId: user.uid,
          authorName: user.displayName,
          authorAvatar: user.avatarDataUrl,
          content,
          attachmentName,
          attachmentType: String(msg.attachmentType || '').slice(0, 80),
          attachmentDataUrl: String(msg.attachmentDataUrl || '').slice(0, 450000),
          replyToId: String(msg.replyToId || ''),
          replyToAuthor: String(msg.replyToAuthor || ''),
          replyToSnippet: String(msg.replyToSnippet || '').slice(0, 160),
          edited: false,
          createdAt: now,
          updatedAt: now,
        });
        instantDmMessages.set(threadId, arr);
        const preview = content ? content.slice(0, 120) : `Arquivo: ${attachmentName || 'mídia'}`;
        thread.lastMessagePreview = preview;
        thread.lastMessageAt = now;
        thread.updatedAt = now;

        const notifs = instantNotifications.get(peerUid) || [];
        notifs.unshift({
          id: makeId('ntf'),
          recipientId: peerUid,
          senderId: user.uid,
          senderName: user.displayName,
          type: 'dm',
          title: `Mensagem privada de ${user.displayName}`,
          body: preview,
          linkServerId: '',
          linkChannelId: '',
          linkUserId: user.uid,
          read: false,
          createdAt: now,
        });
        instantNotifications.set(peerUid, notifs);
        pushInstantSyncToUsers([meta.uid, peerUid]);
        return;
      }

      if (type === 'instant:dm-edit' || type === 'instant:dm-delete' || type === 'instant:dm-reaction') {
        const peerUid = String(msg.peerUid || '');
        const threadId = meta.uid < peerUid ? `${meta.uid}_${peerUid}` : `${peerUid}_${meta.uid}`;
        if (type === 'instant:dm-edit') {
          const arr = instantDmMessages.get(threadId) || [];
          const m = arr.find((x) => x.id === msg.messageId && x.authorId === meta.uid);
          if (m) {
            m.content = String(msg.content || '').slice(0, 4000);
            m.edited = true;
            m.updatedAt = Date.now();
          }
        } else if (type === 'instant:dm-delete') {
          const arr = instantDmMessages.get(threadId) || [];
          instantDmMessages.set(threadId, arr.filter((x) => !(x.id === msg.messageId && x.authorId === meta.uid)));
        } else {
          const arr = instantDmReactions.get(threadId) || [];
          const messageId = String(msg.messageId || '');
          const emoji = String(msg.emoji || '').slice(0, 16);
          const idx = arr.findIndex((r) => r.messageId === messageId && r.userId === meta.uid && r.emoji === emoji);
          if (idx >= 0) arr.splice(idx, 1);
          else arr.push({ id: makeId('rx'), messageId, userId: meta.uid, emoji, createdAt: Date.now() });
          instantDmReactions.set(threadId, arr);
        }
        pushInstantSyncToUsers([meta.uid, peerUid]);
        return;
      }

      if (type === 'instant:notification-read') {
        const list = instantNotifications.get(meta.uid) || [];
        if (msg.all) {
          list.forEach((n) => (n.read = true));
        } else {
          const n = list.find((x) => x.id === msg.notificationId);
          if (n) n.read = true;
        }
        pushInstantSyncToUsers([meta.uid]);
        return;
      }

      if (type === 'instant:invite-notify') {
        const recipientId = String(msg.recipientId || '');
        const srv = instantServers.get(String(msg.serverId || ''));
        if (!recipientId || !srv) return;
        const list = instantNotifications.get(recipientId) || [];
        list.unshift({
          id: makeId('ntf'),
          recipientId,
          senderId: meta.uid,
          senderName: meta.displayName,
          type: 'invite',
          title: `Convite para ${srv.name}`,
          body: `Use o código ${srv.inviteCode} para entrar na comunidade.`,
          linkServerId: srv.id,
          linkChannelId: '',
          linkUserId: meta.uid,
          read: false,
          createdAt: Date.now(),
        });
        instantNotifications.set(recipientId, list);
        pushInstantSyncToUsers([recipientId]);
        return;
      }

      // --- Shared Signaling & Presence Handlers ---
      if (type === 'presence:set') {
        meta.presence = (msg.presence as ClientMeta['presence']) || 'online';
        broadcastAll({
          type: 'presence:update',
          uid: meta.uid,
          presence: meta.presence,
        });
        return;
      }

      if (type === 'server:subscribe') {
        const serverId = String(msg.serverId || '');
        meta.activeServerId = serverId || null;
        if (serverId) {
          sendToSocket(ws, {
            type: 'server:voice-roster',
            serverId,
            roster: getServerVoiceRoster(serverId),
          });
        }
        return;
      }

      if (type === 'typing:start' || type === 'typing:stop') {
        const channelKey = String(msg.channelKey || '');
        if (!channelKey) return;
        broadcastAll(
          {
            type,
            channelKey,
            uid: meta.uid,
            displayName: meta.displayName,
          },
          ws
        );
        return;
      }

      if (type === 'room:join') {
        const serverId = String(msg.serverId || '');
        const channelId = String(msg.channelId || '');
        const channelName = String(msg.channelName || '');
        if (!serverId || !channelId) return;

        if (meta.voiceChannelId && meta.voiceChannelId !== channelId) {
          removeParticipantFromRoom(meta);
        }

        meta.voiceChannelId = channelId;
        meta.voiceServerId = serverId;

        if (!voiceRooms.has(channelId)) {
          voiceRooms.set(channelId, new Map());
        }
        const room = voiceRooms.get(channelId)!;

        const participant: RoomParticipantState = {
          uid: meta.uid,
          displayName: String(msg.displayName || meta.displayName),
          avatarDataUrl: String(msg.avatarDataUrl || meta.avatarDataUrl),
          serverId,
          channelId,
          micMuted: Boolean(msg.micMuted),
          camEnabled: Boolean(msg.camEnabled),
          screenSharing: Boolean(msg.screenSharing),
          speaking: false,
          joinedAt: Date.now(),
        };

        const existingPeers = Array.from(room.values()).filter((p) => p.uid !== meta.uid);
        room.set(meta.uid, participant);

        sendToSocket(ws, {
          type: 'room:snapshot',
          channelId,
          serverId,
          peers: existingPeers,
        });

        broadcastToRoom(
          channelId,
          {
            type: 'room:peer-joined',
            channelId,
            serverId,
            channelName,
            peer: participant,
          },
          meta.uid
        );

        broadcastVoiceRoster(serverId);
        return;
      }

      if (type === 'room:leave') {
        removeParticipantFromRoom(meta);
        return;
      }

      if (type === 'room:state') {
        if (!meta.voiceChannelId) return;
        const room = voiceRooms.get(meta.voiceChannelId);
        if (!room) return;
        const current = room.get(meta.uid);
        if (!current) return;

        const wasScreenSharing = current.screenSharing;
        current.micMuted = msg.micMuted !== undefined ? Boolean(msg.micMuted) : current.micMuted;
        current.camEnabled = msg.camEnabled !== undefined ? Boolean(msg.camEnabled) : current.camEnabled;
        current.screenSharing = msg.screenSharing !== undefined ? Boolean(msg.screenSharing) : current.screenSharing;
        current.speaking = msg.speaking !== undefined ? Boolean(msg.speaking) : current.speaking;

        broadcastToRoom(
          meta.voiceChannelId,
          {
            type: 'room:peer-state',
            channelId: meta.voiceChannelId,
            uid: meta.uid,
            micMuted: current.micMuted,
            camEnabled: current.camEnabled,
            screenSharing: current.screenSharing,
            speaking: current.speaking,
          },
          meta.uid
        );

        if (!wasScreenSharing && current.screenSharing) {
          broadcastAll({
            type: 'screen:started',
            serverId: current.serverId,
            channelId: current.channelId,
            uid: meta.uid,
            displayName: meta.displayName,
          });
        } else if (wasScreenSharing && !current.screenSharing) {
          broadcastAll({
            type: 'screen:stopped',
            serverId: current.serverId,
            channelId: current.channelId,
            uid: meta.uid,
            displayName: meta.displayName,
          });
        }

        broadcastVoiceRoster(current.serverId);
        return;
      }

      if (type === 'rtc:offer' || type === 'rtc:answer' || type === 'rtc:ice-candidate') {
        const targetUid = String(msg.targetUid || '');
        if (!targetUid) return;
        sendToUser(targetUid, {
          type,
          fromUid: meta.uid,
          fromName: meta.displayName,
          channelId: msg.channelId,
          sdp: msg.sdp,
          candidate: msg.candidate,
        });
        return;
      }

      if (type === 'notify:realtime') {
        const targetUid = String(msg.targetUid || '');
        if (!targetUid) return;
        sendToUser(targetUid, {
          type: 'notify:realtime',
          event: msg.event,
        });
      }
    });

    ws.on('close', () => {
      if (meta.voiceChannelId) {
        removeParticipantFromRoom(meta);
      }
      if (meta.uid) {
        const sockets = userSockets.get(meta.uid);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            userSockets.delete(meta.uid);
            broadcastAll({
              type: 'presence:update',
              uid: meta.uid,
              presence: 'invisible',
            });
          }
        }
      }
      clients.delete(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Vesper server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
