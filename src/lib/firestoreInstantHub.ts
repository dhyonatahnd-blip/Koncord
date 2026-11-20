import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { encodeEmojiId, pairId, sanitizeId, sanitizeUsername } from './validation';
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

const DEFAULT_SERVER_ID = 'srv_zone_eu';
const SECONDARY_PUBLIC_SERVER_ID = 'srv_euro_design';
const HEARTBEAT_INTERVAL_MS = 25_000;
const STALE_USER_MS = 110_000;
const CLEANUP_SWEEP_MS = 20_000;

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

function extractRoomLookupCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/[?&](?:room|invite)=([A-Za-z0-9_-]+)/i);
  if (match && match[1]) return match[1].toUpperCase();
  return trimmed.toUpperCase();
}

function retentionToMs(retention?: MessageRetention): number | null {
  if (retention === '5m') return 5 * 60 * 1000;
  if (retention === '15m') return 15 * 60 * 1000;
  if (retention === '60m') return 60 * 60 * 1000;
  return null;
}

function toMillis(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (
    typeof val === 'object' &&
    val !== null &&
    'toMillis' in val &&
    typeof (val as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export class FirestoreInstantHub {
  private uid: string;
  private tag: string;
  private displayName: string;
  private username: string;
  private avatarDataUrl: string;
  private presence: PresenceStatus;
  private initialInviteCode: string;
  private onMessage: (msg: Record<string, unknown>) => void;

  private disposed = false;
  private activeServerId: string | null = null;
  private voiceChannelId: string | null = null;
  private voiceServerId: string | null = null;

  private unsubs: Unsubscribe[] = [];
  private serverUnsubs = new Map<string, Unsubscribe[]>();
  private channelUnsubs = new Map<string, Unsubscribe[]>();
  private dmUnsubs = new Map<string, Unsubscribe[]>();

  private usersByUid: Record<string, UserPublic> = {};
  private livePresences: Record<string, PresenceStatus> = {};
  private allActiveServers = new Map<string, ServerDoc>();
  private joinedServerIds = new Set<string>();
  private membersByServer: Record<string, ServerMember[]> = {};
  private categoriesByServer: Record<string, CategoryDoc[]> = {};
  private channelsByServer: Record<string, ChannelDoc[]> = {};
  private messagesByChannel: Record<string, ChatMessage[]> = {};
  private reactionsByChannel: Record<string, MessageReaction[]> = {};
  private voicePeersByServer: Record<string, Record<string, VoicePeer[]>> = {};
  private prevVoicePeersInActiveChannel = new Map<string, VoicePeer>();
  private friendships: FriendshipDoc[] = [];
  private dmThreads: DmThread[] = [];
  private dmMessagesByThread: Record<string, ChatMessage[]> = {};
  private dmReactionsByThread: Record<string, MessageReaction[]> = {};
  private notifications: NotificationItem[] = [];
  private seenSignalIds = new Set<string>();
  private activeTypingState = new Map<string, Record<string, string>>();
  private expiredNotifiedIds = new Set<string>();

  private heartbeatTimer: number | null = null;
  private cleanupTimer: number | null = null;
  private beforeUnloadHandler: (() => void) | null = null;

  constructor(params: {
    uid: string;
    displayName: string;
    username?: string;
    avatarDataUrl: string;
    presence: PresenceStatus;
    initialInviteCode?: string;
    onMessage: (msg: Record<string, unknown>) => void;
    onError?: (err: unknown) => void;
  }) {
    this.uid = sanitizeId(params.uid);
    this.tag = makeTagFromUid(this.uid);
    this.displayName = params.displayName.trim().slice(0, 48) || 'Guest';
    this.username = sanitizeUsername(params.username || `${this.displayName}_${this.uid.slice(-4)}`);
    this.avatarDataUrl = (params.avatarDataUrl || '').slice(0, 200000);
    this.presence = params.presence || 'online';
    this.initialInviteCode = params.initialInviteCode || '';
    this.onMessage = params.onMessage;

    void this.boot().catch((err) => {
      console.error('FirestoreInstantHub boot failed:', err);
      params.onError?.(err);
    });
  }

  private async boot() {
    await this.upsertCurrentUser();
    await this.seedDefaultPublicRooms();
    if (this.disposed) return;

    this.attachCoreListeners();

    const membershipsSnap = await getDocs(
      query(collection(db, 'zoneMemberships'), where('uid', '==', this.uid))
    );
    if (this.disposed) return;

    if (membershipsSnap.empty) {
      await this.joinServerRecord(DEFAULT_SERVER_ID, 'member');
    }

    const invite = extractRoomLookupCode(this.initialInviteCode);
    if (invite) {
      await this.handleServerJoin({ inviteCode: invite });
    }

    this.heartbeatTimer = window.setInterval(() => {
      void this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    this.cleanupTimer = window.setInterval(() => {
      void this.runCleanupSweep();
    }, CLEANUP_SWEEP_MS);

    this.beforeUnloadHandler = () => {
      this.markOfflineBestEffort();
    };
    window.addEventListener('pagehide', this.beforeUnloadHandler);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private async upsertCurrentUser() {
    const userRef = doc(db, 'zoneUsers', this.uid);
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: this.uid,
          tag: this.tag,
          displayName: this.displayName,
          username: this.username,
          bio: '',
          customStatus: '',
          presence: this.presence,
          avatarDataUrl: this.avatarDataUrl,
          lastSeenAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const prev = snap.data();
        await updateDoc(userRef, {
          displayName: this.displayName,
          username: this.username,
          avatarDataUrl: this.avatarDataUrl || String(prev.avatarDataUrl || ''),
          presence: this.presence,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `zoneUsers/${this.uid}`);
    }
  }

  private async seedDefaultPublicRooms() {
    const seeds: Array<{
      id: string;
      name: string;
      description: string;
      iconColor: string;
      iconInitials: string;
      inviteCode: string;
      retention: MessageRetention;
      categories: Array<{ id: string; name: string; position: number }>;
      channels: Array<{ id: string; categoryId: string; name: string; topic: string; type: 'text' | 'voice' | 'video'; position: number }>;
    }> = [
      {
        id: DEFAULT_SERVER_ID,
        name: 'ZONE Europa',
        description: 'Lobby público temporário para conversas, chamadas e compartilhamento de tela.',
        iconColor: '#3B82F6',
        iconInitials: 'ZE',
        inviteCode: 'ZONEEU',
        retention: 'until_close',
        categories: [
          { id: 'cat_text_eu', name: 'Texto', position: 0 },
          { id: 'cat_media_eu', name: 'Voz, Vídeo & Tela', position: 1 },
        ],
        channels: [
          {
            id: 'ch_geral_eu',
            categoryId: 'cat_text_eu',
            name: 'geral',
            topic: 'Chat temporário em tempo real. Arquivos enviados expiram em 5 minutos.',
            type: 'text',
            position: 0,
          },
          {
            id: 'ch_voz_eu',
            categoryId: 'cat_media_eu',
            name: 'Lounge de Voz',
            topic: 'Chamada de voz em tempo real.',
            type: 'voice',
            position: 0,
          },
          {
            id: 'ch_video_eu',
            categoryId: 'cat_media_eu',
            name: 'Sala Vídeo & Tela',
            topic: 'Vídeo multi-participante e tela cheia sem cortes.',
            type: 'video',
            position: 1,
          },
        ],
      },
      {
        id: SECONDARY_PUBLIC_SERVER_ID,
        name: 'Euro Studio & Dev',
        description: 'Sala pública para design, tecnologia e apresentações de tela.',
        iconColor: '#7C3AED',
        iconInitials: 'ES',
        inviteCode: 'EURODEV',
        retention: '60m',
        categories: [
          { id: 'cat_text_dev', name: 'Texto', position: 0 },
          { id: 'cat_media_dev', name: 'Review & Vídeo', position: 1 },
        ],
        channels: [
          {
            id: 'ch_geral_dev',
            categoryId: 'cat_text_dev',
            name: 'showcase',
            topic: 'Envie imagens, vídeos ou PDFs (autoexclusão em 5 min).',
            type: 'text',
            position: 0,
          },
          {
            id: 'ch_video_dev',
            categoryId: 'cat_media_dev',
            name: 'Screen Review',
            topic: 'Compartilhe janela ou tela inteira em alta definição.',
            type: 'video',
            position: 0,
          },
        ],
      },
    ];

    for (const seed of seeds) {
      const srvRef = doc(db, 'zoneServers', seed.id);
      const snap = await getDoc(srvRef);
      if (snap.exists()) continue;

      const batch = writeBatch(db);
      batch.set(srvRef, {
        id: seed.id,
        name: seed.name,
        description: seed.description,
        iconColor: seed.iconColor,
        iconInitials: seed.iconInitials,
        iconDataUrl: '',
        ownerId: 'system',
        inviteCode: seed.inviteCode,
        visibility: 'public',
        retention: seed.retention,
        clearOnClose: true,
        memberCount: 0,
        closed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (const cat of seed.categories) {
        batch.set(doc(db, 'zoneServers', seed.id, 'categories', cat.id), {
          id: cat.id,
          serverId: seed.id,
          name: cat.name,
          position: cat.position,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const ch of seed.channels) {
        batch.set(doc(db, 'zoneServers', seed.id, 'channels', ch.id), {
          id: ch.id,
          serverId: seed.id,
          categoryId: ch.categoryId,
          name: ch.name,
          topic: ch.topic,
          type: ch.type,
          position: ch.position,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }

  private attachCoreListeners() {
    // 1. Active Users & Live Presences
    this.unsubs.push(
      onSnapshot(
        query(
          collection(db, 'zoneUsers'),
          limit(150)
        ),
        (snap) => {
          const now = Date.now();
          const nextUsers: Record<string, UserPublic> = {};
          const nextPresences: Record<string, PresenceStatus> = {};
          for (const d of snap.docs) {
            const raw = d.data();
            const lastSeenMs = toMillis(raw.lastSeenAt || raw.updatedAt);
            const stale = d.id !== this.uid && now - lastSeenMs > STALE_USER_MS;
            const effPresence: PresenceStatus = stale
              ? 'invisible'
              : ((raw.presence as PresenceStatus) || 'online');
            nextUsers[d.id] = {
              uid: String(raw.uid || d.id),
              tag: String(raw.tag || makeTagFromUid(d.id)),
              displayName: String(raw.displayName || 'User'),
              username: String(raw.username || 'user'),
              bio: String(raw.bio || ''),
              customStatus: String(raw.customStatus || ''),
              presence: effPresence,
              avatarDataUrl: String(raw.avatarDataUrl || ''),
              createdAt: toMillis(raw.createdAt),
              updatedAt: toMillis(raw.updatedAt),
            };
            nextPresences[d.id] = effPresence;
          }
          this.usersByUid = nextUsers;
          this.livePresences = nextPresences;
          this.onMessage({ type: 'presence:snapshot', presences: nextPresences });
          this.pushSnapshot();
        },
        (err) => {
          console.error('zoneUsers listener error:', err);
        }
      )
    );

    // 2. Open Servers Directory & Updates
    this.unsubs.push(
      onSnapshot(
        query(collection(db, 'zoneServers'), where('closed', '==', false)),
        (snap) => {
          const nextServers = new Map<string, ServerDoc>();
          for (const d of snap.docs) {
            const raw = d.data();
            nextServers.set(d.id, {
              id: d.id,
              name: String(raw.name || 'Sala'),
              description: String(raw.description || ''),
              iconColor: String(raw.iconColor || '#3B82F6'),
              iconInitials: String(raw.iconInitials || 'ZN'),
              iconDataUrl: String(raw.iconDataUrl || ''),
              ownerId: String(raw.ownerId || 'system'),
              inviteCode: String(raw.inviteCode || ''),
              visibility: raw.visibility === 'private' ? 'private' : 'public',
              retention: (raw.retention as MessageRetention) || 'until_close',
              clearOnClose: raw.clearOnClose !== false,
              memberCount: typeof raw.memberCount === 'number' ? raw.memberCount : 0,
              createdAt: toMillis(raw.createdAt),
              updatedAt: toMillis(raw.updatedAt),
            });
          }

          // Check if any joined server was closed
          for (const joinedId of Array.from(this.joinedServerIds)) {
            if (!nextServers.has(joinedId) && this.allActiveServers.has(joinedId)) {
              const prevSrv = this.allActiveServers.get(joinedId);
              this.detachServerListeners(joinedId);
              this.joinedServerIds.delete(joinedId);
              this.onMessage({
                type: 'zone:room-closed',
                serverId: joinedId,
                serverName: prevSrv?.name || 'Sala',
              });
            }
          }

          this.allActiveServers = nextServers;
          this.pushSnapshot();
        },
        (err) => {
          console.error('zoneServers listener error:', err);
        }
      )
    );

    // 3. Current User Memberships
    this.unsubs.push(
      onSnapshot(
        query(collection(db, 'zoneMemberships'), where('uid', '==', this.uid)),
        (snap) => {
          const nextIds = new Set<string>();
          for (const d of snap.docs) {
            const srvId = String(d.data().serverId || '');
            if (srvId) nextIds.add(srvId);
          }

          for (const id of nextIds) {
            if (!this.joinedServerIds.has(id)) {
              this.joinedServerIds.add(id);
              this.attachServerListeners(id);
            }
          }
          for (const id of Array.from(this.joinedServerIds)) {
            if (!nextIds.has(id)) {
              this.joinedServerIds.delete(id);
              this.detachServerListeners(id);
            }
          }
          this.pushSnapshot();
        },
        (err) => {
          console.error('zoneMemberships listener error:', err);
        }
      )
    );

    // 4. Friendships
    this.unsubs.push(
      onSnapshot(
        query(collection(db, 'zoneFriendships'), where('users', 'array-contains', this.uid), limit(100)),
        (snap) => {
          this.friendships = snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              users: (raw.users as string[]) || [],
              requesterId: String(raw.requesterId || ''),
              recipientId: String(raw.recipientId || ''),
              status: (raw.status as FriendshipDoc['status']) || 'pending',
              createdAt: toMillis(raw.createdAt),
              updatedAt: toMillis(raw.updatedAt),
            };
          });
          this.pushSnapshot();
        },
        (err) => {
          console.error('zoneFriendships listener error:', err);
        }
      )
    );

    // 5. DM Threads
    this.unsubs.push(
      onSnapshot(
        query(collection(db, 'zoneDmThreads'), where('participants', 'array-contains', this.uid), limit(100)),
        (snap) => {
          const activeThreadIds = new Set<string>();
          this.dmThreads = snap.docs
            .map((d) => {
              activeThreadIds.add(d.id);
              const raw = d.data();
              return {
                id: d.id,
                participants: (raw.participants as string[]) || [],
                lastMessagePreview: String(raw.lastMessagePreview || ''),
                lastMessageAt: toMillis(raw.lastMessageAt),
                createdAt: toMillis(raw.createdAt),
                updatedAt: toMillis(raw.updatedAt),
              };
            })
            .sort((a, b) => toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt));

          for (const tid of activeThreadIds) {
            if (!this.dmUnsubs.has(tid)) {
              this.attachDmListeners(tid);
            }
          }
          for (const tid of Array.from(this.dmUnsubs.keys())) {
            if (!activeThreadIds.has(tid)) {
              this.detachDmListeners(tid);
            }
          }
          this.pushSnapshot();
        },
        (err) => {
          console.error('zoneDmThreads listener error:', err);
        }
      )
    );

    // 6. Notifications
    this.unsubs.push(
      onSnapshot(
        query(collection(db, 'zoneNotifications'), where('recipientId', '==', this.uid)),
        (snap) => {
          this.notifications = snap.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: d.id,
                recipientId: String(raw.recipientId || ''),
                senderId: String(raw.senderId || ''),
                senderName: String(raw.senderName || ''),
                type: (raw.type as NotificationItem['type']) || 'invite',
                title: String(raw.title || ''),
                body: String(raw.body || ''),
                linkServerId: String(raw.linkServerId || ''),
                linkChannelId: String(raw.linkChannelId || ''),
                linkUserId: String(raw.linkUserId || ''),
                inviteCode: String(raw.inviteCode || ''),
                read: Boolean(raw.read),
                createdAt: toMillis(raw.createdAt),
              };
            })
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          this.pushSnapshot();
        },
        (err) => {
          console.error('zoneNotifications listener error:', err);
        }
      )
    );

    // 7. WebRTC P2P Signals
    this.unsubs.push(
      onSnapshot(
        query(collection(db, 'zoneSignals'), where('toUid', '==', this.uid)),
        (snap) => {
          for (const d of snap.docs) {
            if (this.seenSignalIds.has(d.id)) continue;
            this.seenSignalIds.add(d.id);
            const raw = d.data();
            const type = String(raw.type || '');
            const fromUid = String(raw.fromUid || '');
            const fromName = String(raw.fromName || '');
            const channelId = String(raw.channelId || '');

            if (type === 'rtc:offer' || type === 'rtc:answer') {
              this.onMessage({
                type,
                fromUid,
                fromName,
                channelId,
                sdp: {
                  description: {
                    type: String(raw.sdpType || (type === 'rtc:offer' ? 'offer' : 'answer')),
                    sdp: String(raw.sdp || ''),
                  },
                  camStreamId: raw.camStreamId ? String(raw.camStreamId) : null,
                  screenStreamId: raw.screenStreamId ? String(raw.screenStreamId) : null,
                },
              });
            } else if (type === 'rtc:ice-candidate') {
              const idx = typeof raw.sdpMLineIndex === 'number' ? raw.sdpMLineIndex : -1;
              this.onMessage({
                type,
                fromUid,
                fromName,
                channelId,
                candidate: {
                  candidate: String(raw.candidate || ''),
                  sdpMid: raw.sdpMid ? String(raw.sdpMid) : null,
                  sdpMLineIndex: idx >= 0 ? idx : null,
                },
              });
            }

            deleteDoc(d.ref).catch(() => {});
          }
        },
        (err) => {
          console.error('zoneSignals listener error:', err);
        }
      )
    );

    // 8. Typing Indicators
    this.unsubs.push(
      onSnapshot(
        query(collection(db, 'zoneTyping'), where('isTyping', '==', true), limit(50)),
        (snap) => {
          const now = Date.now();
          const nextByChannel = new Map<string, Record<string, string>>();
          for (const d of snap.docs) {
            const raw = d.data();
            const chKey = String(raw.channelKey || '');
            const tyUid = String(raw.uid || '');
            const tyName = String(raw.displayName || '');
            const updatedAt = toMillis(raw.updatedAt);
            if (!chKey || !tyUid || tyUid === this.uid || now - updatedAt > 10_000) continue;
            if (!nextByChannel.has(chKey)) nextByChannel.set(chKey, {});
            nextByChannel.get(chKey)![tyUid] = tyName;
          }

          // Diff against previous typing state to emit typing:start / typing:stop
          for (const [chKey, prevUsers] of this.activeTypingState) {
            const currUsers = nextByChannel.get(chKey) || {};
            for (const tyUid of Object.keys(prevUsers)) {
              if (!currUsers[tyUid]) {
                this.onMessage({ type: 'typing:stop', channelKey: chKey, uid: tyUid });
              }
            }
          }
          for (const [chKey, currUsers] of nextByChannel) {
            const prevUsers = this.activeTypingState.get(chKey) || {};
            for (const [tyUid, tyName] of Object.entries(currUsers)) {
              if (!prevUsers[tyUid]) {
                this.onMessage({
                  type: 'typing:start',
                  channelKey: chKey,
                  uid: tyUid,
                  displayName: tyName,
                });
              }
            }
          }
          this.activeTypingState = nextByChannel;
        },
        (err) => {
          console.error('zoneTyping listener error:', err);
        }
      )
    );
  }

  private attachServerListeners(serverId: string) {
    if (this.serverUnsubs.has(serverId)) return;
    const list: Unsubscribe[] = [];

    list.push(
      onSnapshot(
        query(collection(db, 'zoneServers', serverId, 'members'), where('serverId', '==', serverId)),
        (snap) => {
          this.membersByServer[serverId] = snap.docs.map((d) => {
            const raw = d.data();
            return {
              uid: String(raw.uid || d.id),
              serverId,
              role: (raw.role as ServerMember['role']) || 'member',
              joinedAt: toMillis(raw.joinedAt),
            };
          });
          this.pushSnapshot();
        },
        (err) => console.error('members listener error:', err)
      )
    );

    list.push(
      onSnapshot(
        query(
          collection(db, 'zoneServers', serverId, 'categories'),
          where('serverId', '==', serverId)
        ),
        (snap) => {
          this.categoriesByServer[serverId] = snap.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: d.id,
                serverId,
                name: String(raw.name || 'Categoria'),
                position: typeof raw.position === 'number' ? raw.position : 0,
                createdAt: toMillis(raw.createdAt),
                updatedAt: toMillis(raw.updatedAt),
              };
            })
            .sort((a, b) => a.position - b.position);
          this.pushSnapshot();
        },
        (err) => console.error('categories listener error:', err)
      )
    );

    list.push(
      onSnapshot(
        query(
          collection(db, 'zoneServers', serverId, 'channels'),
          where('serverId', '==', serverId)
        ),
        (snap) => {
          const nextChannels = snap.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: d.id,
                serverId,
                categoryId: String(raw.categoryId || ''),
                name: String(raw.name || 'canal'),
                topic: String(raw.topic || ''),
                type: (raw.type as ChannelDoc['type']) || 'text',
                position: typeof raw.position === 'number' ? raw.position : 0,
                createdAt: toMillis(raw.createdAt),
                updatedAt: toMillis(raw.updatedAt),
              };
            })
            .sort((a, b) => a.position - b.position);

          this.channelsByServer[serverId] = nextChannels;

          const activeChIds = new Set(nextChannels.map((c) => c.id));
          for (const ch of nextChannels) {
            if (!this.channelUnsubs.has(ch.id)) {
              this.attachChannelListeners(serverId, ch.id);
            }
          }
          for (const existingChId of Array.from(this.channelUnsubs.keys())) {
            const belongsHere = nextChannels.some((c) => c.id === existingChId);
            if (!belongsHere && !activeChIds.has(existingChId)) {
              // Keep channel listeners belonging to other servers untouched
            }
          }
          this.pushSnapshot();
        },
        (err) => console.error('channels listener error:', err)
      )
    );

    list.push(
      onSnapshot(
        query(
          collection(db, 'zoneServers', serverId, 'voicePeers'),
          where('serverId', '==', serverId)
        ),
        (snap) => {
          const now = Date.now();
          const roster: Record<string, VoicePeer[]> = {};
          for (const d of snap.docs) {
            const raw = d.data();
            const updatedMs = toMillis(raw.updatedAt || raw.joinedAt);
            if (d.id !== this.uid && now - updatedMs > STALE_USER_MS) {
              continue;
            }
            const chId = String(raw.channelId || '');
            if (!chId) continue;
            if (!roster[chId]) roster[chId] = [];
            roster[chId].push({
              uid: String(raw.uid || d.id),
              serverId,
              channelId: chId,
              displayName: String(raw.displayName || 'Participant'),
              avatarDataUrl: String(raw.avatarDataUrl || ''),
              micMuted: Boolean(raw.micMuted),
              camEnabled: Boolean(raw.camEnabled),
              screenSharing: Boolean(raw.screenSharing),
              speaking: Boolean(raw.speaking),
              joinedAt: toMillis(raw.joinedAt),
            });
          }
          this.voicePeersByServer[serverId] = roster;

          if (this.activeServerId === serverId || this.voiceServerId === serverId) {
            this.onMessage({ type: 'server:voice-roster', serverId, roster });
          }

          if (this.voiceServerId === serverId && this.voiceChannelId) {
            const currPeers = roster[this.voiceChannelId] || [];
            const currMap = new Map(currPeers.map((p) => [p.uid, p]));
            const chName =
              this.channelsByServer[serverId]?.find((c) => c.id === this.voiceChannelId)?.name ||
              'room';

            for (const [peerUid, peer] of currMap) {
              if (peerUid === this.uid) continue;
              const prev = this.prevVoicePeersInActiveChannel.get(peerUid);
              if (!prev) {
                this.onMessage({
                  type: 'room:peer-joined',
                  channelId: this.voiceChannelId,
                  channelName: chName,
                  peer,
                });
              } else {
                if (
                  prev.micMuted !== peer.micMuted ||
                  prev.camEnabled !== peer.camEnabled ||
                  prev.screenSharing !== peer.screenSharing ||
                  prev.speaking !== peer.speaking
                ) {
                  this.onMessage({
                    type: 'room:peer-state',
                    channelId: this.voiceChannelId,
                    uid: peer.uid,
                    micMuted: peer.micMuted,
                    camEnabled: peer.camEnabled,
                    screenSharing: peer.screenSharing,
                    speaking: peer.speaking,
                  });
                }
                if (!prev.screenSharing && peer.screenSharing) {
                  this.onMessage({
                    type: 'screen:started',
                    serverId,
                    channelId: this.voiceChannelId,
                    uid: peer.uid,
                    displayName: peer.displayName,
                  });
                } else if (prev.screenSharing && !peer.screenSharing) {
                  this.onMessage({
                    type: 'screen:stopped',
                    serverId,
                    channelId: this.voiceChannelId,
                    uid: peer.uid,
                    displayName: peer.displayName,
                  });
                }
              }
            }

            for (const [prevUid, prevPeer] of this.prevVoicePeersInActiveChannel) {
              if (prevUid === this.uid) continue;
              if (!currMap.has(prevUid)) {
                if (prevPeer.screenSharing) {
                  this.onMessage({
                    type: 'screen:stopped',
                    serverId,
                    channelId: this.voiceChannelId,
                    uid: prevUid,
                    displayName: prevPeer.displayName,
                  });
                }
                this.onMessage({
                  type: 'room:peer-left',
                  channelId: this.voiceChannelId,
                  uid: prevUid,
                });
              }
            }

            this.prevVoicePeersInActiveChannel = currMap;
          }
        },
        (err) => console.error('voicePeers listener error:', err)
      )
    );

    this.serverUnsubs.set(serverId, list);
  }

  private detachServerListeners(serverId: string) {
    const list = this.serverUnsubs.get(serverId);
    if (list) {
      list.forEach((u) => u());
      this.serverUnsubs.delete(serverId);
    }
    const chs = this.channelsByServer[serverId] || [];
    for (const ch of chs) {
      const cu = this.channelUnsubs.get(ch.id);
      if (cu) {
        cu.forEach((u) => u());
        this.channelUnsubs.delete(ch.id);
      }
      delete this.messagesByChannel[ch.id];
      delete this.reactionsByChannel[ch.id];
    }
    delete this.membersByServer[serverId];
    delete this.categoriesByServer[serverId];
    delete this.channelsByServer[serverId];
    delete this.voicePeersByServer[serverId];
  }

  private attachChannelListeners(serverId: string, channelId: string) {
    if (this.channelUnsubs.has(channelId)) return;
    const list: Unsubscribe[] = [];

    list.push(
      onSnapshot(
        query(
          collection(db, 'zoneServers', serverId, 'channels', channelId, 'messages'),
          where('serverId', '==', serverId),
          where('channelId', '==', channelId)
        ),
        (snap) => {
          const now = Date.now();
          this.messagesByChannel[channelId] = snap.docs
            .map((d) => {
              const raw = d.data();
              const attExpiresAt =
                typeof raw.attachmentExpiresAt === 'number' && raw.attachmentExpiresAt > 0
                  ? raw.attachmentExpiresAt
                  : undefined;
              const isExpired = Boolean(raw.attachmentExpired || (attExpiresAt && now >= attExpiresAt));
              return {
                id: d.id,
                serverId,
                channelId,
                authorId: String(raw.authorId || ''),
                authorName: String(raw.authorName || 'User'),
                authorTag: String(raw.authorTag || ''),
                authorAvatar: String(raw.authorAvatar || ''),
                content: String(raw.content || ''),
                attachmentName: String(raw.attachmentName || ''),
                attachmentType: String(raw.attachmentType || ''),
                attachmentSize: typeof raw.attachmentSize === 'number' ? raw.attachmentSize : undefined,
                attachmentDataUrl: isExpired ? '' : String(raw.attachmentDataUrl || ''),
                attachmentExpiresAt: attExpiresAt,
                attachmentExpired: isExpired,
                replyToId: String(raw.replyToId || ''),
                replyToAuthor: String(raw.replyToAuthor || ''),
                replyToSnippet: String(raw.replyToSnippet || ''),
                edited: Boolean(raw.edited),
                expiresAt: typeof raw.expiresAt === 'number' && raw.expiresAt > 0 ? raw.expiresAt : undefined,
                createdAt: toMillis(raw.createdAt),
                updatedAt: toMillis(raw.updatedAt),
              } as ChatMessage;
            })
            .filter((m) => !m.expiresAt || m.expiresAt > now)
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
          this.pushSnapshot();
        },
        (err) => console.error('channel messages listener error:', err)
      )
    );

    list.push(
      onSnapshot(
        query(
          collection(db, 'zoneServers', serverId, 'channels', channelId, 'reactions'),
          where('serverId', '==', serverId),
          where('channelId', '==', channelId)
        ),
        (snap) => {
          this.reactionsByChannel[channelId] = snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              serverId,
              channelId,
              messageId: String(raw.messageId || ''),
              userId: String(raw.userId || ''),
              emoji: String(raw.emoji || ''),
              createdAt: toMillis(raw.createdAt),
            };
          });
          this.pushSnapshot();
        },
        (err) => console.error('channel reactions listener error:', err)
      )
    );

    this.channelUnsubs.set(channelId, list);
  }

  private attachDmListeners(threadId: string) {
    if (this.dmUnsubs.has(threadId)) return;
    const list: Unsubscribe[] = [];

    list.push(
      onSnapshot(
        query(
          collection(db, 'zoneDmThreads', threadId, 'messages'),
          where('threadId', '==', threadId)
        ),
        (snap) => {
          const now = Date.now();
          this.dmMessagesByThread[threadId] = snap.docs
            .map((d) => {
              const raw = d.data();
              const attExpiresAt =
                typeof raw.attachmentExpiresAt === 'number' && raw.attachmentExpiresAt > 0
                  ? raw.attachmentExpiresAt
                  : undefined;
              const isExpired = Boolean(raw.attachmentExpired || (attExpiresAt && now >= attExpiresAt));
              return {
                id: d.id,
                threadId,
                authorId: String(raw.authorId || ''),
                authorName: String(raw.authorName || 'User'),
                authorTag: String(raw.authorTag || ''),
                authorAvatar: String(raw.authorAvatar || ''),
                content: String(raw.content || ''),
                attachmentName: String(raw.attachmentName || ''),
                attachmentType: String(raw.attachmentType || ''),
                attachmentSize: typeof raw.attachmentSize === 'number' ? raw.attachmentSize : undefined,
                attachmentDataUrl: isExpired ? '' : String(raw.attachmentDataUrl || ''),
                attachmentExpiresAt: attExpiresAt,
                attachmentExpired: isExpired,
                replyToId: String(raw.replyToId || ''),
                replyToAuthor: String(raw.replyToAuthor || ''),
                replyToSnippet: String(raw.replyToSnippet || ''),
                edited: Boolean(raw.edited),
                createdAt: toMillis(raw.createdAt),
                updatedAt: toMillis(raw.updatedAt),
              } as ChatMessage;
            })
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
          this.pushSnapshot();
        },
        (err) => console.error('dm messages listener error:', err)
      )
    );

    list.push(
      onSnapshot(
        query(
          collection(db, 'zoneDmThreads', threadId, 'reactions'),
          where('threadId', '==', threadId)
        ),
        (snap) => {
          this.dmReactionsByThread[threadId] = snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              threadId,
              messageId: String(raw.messageId || ''),
              userId: String(raw.userId || ''),
              emoji: String(raw.emoji || ''),
              createdAt: toMillis(raw.createdAt),
            };
          });
          this.pushSnapshot();
        },
        (err) => console.error('dm reactions listener error:', err)
      )
    );

    this.dmUnsubs.set(threadId, list);
  }

  private detachDmListeners(threadId: string) {
    const list = this.dmUnsubs.get(threadId);
    if (list) {
      list.forEach((u) => u());
      this.dmUnsubs.delete(threadId);
    }
    delete this.dmMessagesByThread[threadId];
    delete this.dmReactionsByThread[threadId];
  }

  private pushSnapshot() {
    if (this.disposed) return;
    const servers: ServerDoc[] = [];
    const publicServers: ServerDoc[] = [];

    for (const srv of this.allActiveServers.values()) {
      const liveMemberLen = this.membersByServer[srv.id]?.length;
      const withCount: ServerDoc = {
        ...srv,
        memberCount: typeof liveMemberLen === 'number' ? liveMemberLen : srv.memberCount ?? 0,
      };
      if (srv.visibility === 'public') {
        publicServers.push(withCount);
      }
      if (this.joinedServerIds.has(srv.id)) {
        servers.push(withCount);
      }
    }

    this.onMessage({
      type: 'instant:snapshot',
      usersByUid: { ...this.usersByUid },
      servers,
      publicServers,
      membersByServer: { ...this.membersByServer },
      categoriesByServer: { ...this.categoriesByServer },
      channelsByServer: { ...this.channelsByServer },
      messagesByChannel: { ...this.messagesByChannel },
      reactionsByChannel: { ...this.reactionsByChannel },
      friendships: [...this.friendships],
      dmThreads: [...this.dmThreads],
      dmMessagesByThread: { ...this.dmMessagesByThread },
      dmReactionsByThread: { ...this.dmReactionsByThread },
      notifications: [...this.notifications],
    });
  }

  private async joinServerRecord(serverId: string, role: ServerMember['role']) {
    const membershipId = `${serverId}_${this.uid}`;
    const memIdxRef = doc(db, 'zoneMemberships', membershipId);
    const subMemRef = doc(db, 'zoneServers', serverId, 'members', this.uid);
    const existing = await getDoc(memIdxRef);
    if (existing.exists()) return;

    const batch = writeBatch(db);
    batch.set(memIdxRef, {
      id: membershipId,
      serverId,
      uid: this.uid,
      role,
      joinedAt: serverTimestamp(),
    });
    batch.set(subMemRef, {
      uid: this.uid,
      serverId,
      role,
      joinedAt: serverTimestamp(),
    });
    await batch.commit();

    const srv = this.allActiveServers.get(serverId);
    if (srv) {
      updateDoc(doc(db, 'zoneServers', serverId), {
        memberCount: (srv.memberCount || 0) + 1,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  }

  private async sendHeartbeat() {
    if (this.disposed) return;
    try {
      await updateDoc(doc(db, 'zoneUsers', this.uid), {
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (this.voiceServerId && this.voiceChannelId) {
        await updateDoc(doc(db, 'zoneServers', this.voiceServerId, 'voicePeers', this.uid), {
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {
      // ignore transient heartbeat failure
    }
  }

  private async runCleanupSweep() {
    if (this.disposed) return;
    const now = Date.now();
    let anyFileExpired = false;

    for (const [serverId, channels] of Object.entries(this.channelsByServer)) {
      for (const ch of channels) {
        const msgs = this.messagesByChannel[ch.id] || [];
        for (const m of msgs) {
          if (m.attachmentExpiresAt && !m.attachmentExpired && now >= m.attachmentExpiresAt) {
            if (!this.expiredNotifiedIds.has(m.id)) {
              this.expiredNotifiedIds.add(m.id);
              anyFileExpired = true;
            }
            updateDoc(doc(db, 'zoneServers', serverId, 'channels', ch.id, 'messages', m.id), {
              attachmentDataUrl: '',
              attachmentExpired: true,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          if (m.expiresAt && now >= m.expiresAt) {
            deleteDoc(doc(db, 'zoneServers', serverId, 'channels', ch.id, 'messages', m.id)).catch(
              () => {}
            );
          }
        }
      }
    }

    for (const [threadId, msgs] of Object.entries(this.dmMessagesByThread)) {
      for (const m of msgs) {
        if (m.attachmentExpiresAt && !m.attachmentExpired && now >= m.attachmentExpiresAt) {
          if (!this.expiredNotifiedIds.has(m.id)) {
            this.expiredNotifiedIds.add(m.id);
            anyFileExpired = true;
          }
          updateDoc(doc(db, 'zoneDmThreads', threadId, 'messages', m.id), {
            attachmentDataUrl: '',
            attachmentExpired: true,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
    }

    if (anyFileExpired) {
      this.onMessage({ type: 'zone:file-expired' });
    }
  }

  private markOfflineBestEffort() {
    updateDoc(doc(db, 'zoneUsers', this.uid), {
      presence: 'invisible',
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    if (this.voiceServerId) {
      deleteDoc(doc(db, 'zoneServers', this.voiceServerId, 'voicePeers', this.uid)).catch(() => {});
    }
  }

  public send(msg: Record<string, unknown>) {
    if (this.disposed) return;
    void this.handleCommand(msg).catch((err) => {
      console.error('FirestoreInstantHub command error:', err);
      this.onMessage({
        type: 'instant:error',
        message: err instanceof Error ? err.message : 'Falha na sincronização em nuvem.',
      });
    });
  }

  private async handleCommand(msg: Record<string, unknown>) {
    const type = String(msg.type || '');

    if (type === 'presence:set') {
      const next = (msg.presence as PresenceStatus) || 'online';
      this.presence = next;
      await updateDoc(doc(db, 'zoneUsers', this.uid), {
        presence: next,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:profile-update') {
      const updates = (msg.updates as Partial<UserPublic>) || {};
      const patch: Record<string, unknown> = {
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (updates.displayName !== undefined) {
        this.displayName = String(updates.displayName).trim().slice(0, 48) || this.displayName;
        patch.displayName = this.displayName;
      }
      if (updates.username !== undefined) {
        this.username = sanitizeUsername(String(updates.username)) || this.username;
        patch.username = this.username;
      }
      if (updates.bio !== undefined) patch.bio = String(updates.bio).slice(0, 240);
      if (updates.customStatus !== undefined) patch.customStatus = String(updates.customStatus).slice(0, 80);
      if (updates.presence !== undefined) {
        this.presence = updates.presence;
        patch.presence = updates.presence;
      }
      if (updates.avatarDataUrl !== undefined) {
        this.avatarDataUrl = String(updates.avatarDataUrl).slice(0, 200000);
        patch.avatarDataUrl = this.avatarDataUrl;
      }
      await updateDoc(doc(db, 'zoneUsers', this.uid), patch);
      return;
    }

    if (type === 'instant:server-create') {
      const serverId = makeId('srv');
      const name = String(msg.name || 'Nova Sala').trim().slice(0, 64) || 'Nova Sala';
      const description = String(msg.description || '').slice(0, 240);
      const iconColor = String(msg.iconColor || '#3B82F6').slice(0, 32);
      const visibility = msg.visibility === 'private' ? 'private' : 'public';
      const retention: MessageRetention =
        msg.retention === '5m' || msg.retention === '15m' || msg.retention === '60m'
          ? msg.retention
          : 'until_close';
      const clearOnClose = msg.clearOnClose !== false;
      const inviteCode = makeInvite();
      const catTextId = makeId('cat');
      const catMediaId = makeId('cat');
      const chTextId = makeId('ch');
      const chVoiceId = makeId('ch');
      const chVideoId = makeId('ch');
      const membershipId = `${serverId}_${this.uid}`;

      const batch = writeBatch(db);
      batch.set(doc(db, 'zoneServers', serverId), {
        id: serverId,
        name,
        description,
        iconColor,
        iconInitials: initialsFrom(name),
        iconDataUrl: '',
        ownerId: this.uid,
        inviteCode,
        visibility,
        retention,
        clearOnClose,
        memberCount: 1,
        closed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'zoneMemberships', membershipId), {
        id: membershipId,
        serverId,
        uid: this.uid,
        role: 'owner',
        joinedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'zoneServers', serverId, 'members', this.uid), {
        uid: this.uid,
        serverId,
        role: 'owner',
        joinedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'zoneServers', serverId, 'categories', catTextId), {
        id: catTextId,
        serverId,
        name: 'Texto',
        position: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'zoneServers', serverId, 'categories', catMediaId), {
        id: catMediaId,
        serverId,
        name: 'Voz, Vídeo & Tela',
        position: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'zoneServers', serverId, 'channels', chTextId), {
        id: chTextId,
        serverId,
        categoryId: catTextId,
        name: 'geral',
        topic: 'Chat temporário — arquivos expiram em 5 min.',
        type: 'text',
        position: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'zoneServers', serverId, 'channels', chVoiceId), {
        id: chVoiceId,
        serverId,
        categoryId: catMediaId,
        name: 'Voz',
        topic: 'Áudio em tempo real',
        type: 'voice',
        position: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'zoneServers', serverId, 'channels', chVideoId), {
        id: chVideoId,
        serverId,
        categoryId: catMediaId,
        name: 'Vídeo & Tela',
        topic: 'Câmera e compartilhamento de tela',
        type: 'video',
        position: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      const now = Date.now();
      this.allActiveServers.set(serverId, {
        id: serverId,
        name,
        description,
        iconColor,
        iconInitials: initialsFrom(name),
        iconDataUrl: '',
        ownerId: this.uid,
        inviteCode,
        visibility,
        retention,
        clearOnClose,
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      this.joinedServerIds.add(serverId);
      this.attachServerListeners(serverId);
      this.pushSnapshot();
      this.onMessage({ type: 'instant:server-created', serverId });
      return;
    }

    if (type === 'instant:server-join') {
      await this.handleServerJoin(msg);
      return;
    }

    if (type === 'instant:server-update') {
      const serverId = String(msg.serverId || '');
      if (!serverId) return;
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (msg.name !== undefined) {
        const cleanName = String(msg.name).trim().slice(0, 64);
        if (cleanName) {
          patch.name = cleanName;
          patch.iconInitials = initialsFrom(cleanName);
        }
      }
      if (msg.description !== undefined) patch.description = String(msg.description).slice(0, 240);
      if (msg.iconDataUrl !== undefined) patch.iconDataUrl = String(msg.iconDataUrl).slice(0, 200000);
      if (msg.visibility === 'public' || msg.visibility === 'private') patch.visibility = msg.visibility;
      if (
        msg.retention === '5m' ||
        msg.retention === '15m' ||
        msg.retention === '60m' ||
        msg.retention === 'until_close'
      ) {
        patch.retention = msg.retention;
      }
      if (msg.clearOnClose !== undefined) patch.clearOnClose = Boolean(msg.clearOnClose);
      await updateDoc(doc(db, 'zoneServers', serverId), patch);
      return;
    }

    if (type === 'instant:server-leave') {
      const serverId = String(msg.serverId || '');
      if (!serverId) return;
      const mem = this.membersByServer[serverId]?.find((m) => m.uid === this.uid);
      if (mem?.role === 'owner') return;
      await deleteDoc(doc(db, 'zoneMemberships', `${serverId}_${this.uid}`));
      await deleteDoc(doc(db, 'zoneServers', serverId, 'members', this.uid)).catch(() => {});
      return;
    }

    if (type === 'instant:server-close') {
      const serverId = String(msg.serverId || '');
      if (!serverId || serverId === DEFAULT_SERVER_ID || serverId === SECONDARY_PUBLIC_SERVER_ID) {
        this.onMessage({
          type: 'instant:error',
          message: 'Salas públicas do sistema não podem ser encerradas.',
        });
        return;
      }
      const srv = this.allActiveServers.get(serverId);
      if (!srv || srv.ownerId !== this.uid) return;
      await updateDoc(doc(db, 'zoneServers', serverId), {
        closed: true,
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'zoneMemberships', `${serverId}_${this.uid}`)).catch(() => {});
      return;
    }

    if (type === 'instant:member-role') {
      const serverId = String(msg.serverId || '');
      const targetUid = String(msg.targetUid || '');
      const role = msg.role === 'admin' ? 'admin' : 'member';
      if (!serverId || !targetUid) return;
      await updateDoc(doc(db, 'zoneServers', serverId, 'members', targetUid), { role });
      await updateDoc(doc(db, 'zoneMemberships', `${serverId}_${targetUid}`), { role }).catch(
        () => {}
      );
      return;
    }

    if (type === 'instant:category-create') {
      const serverId = String(msg.serverId || '');
      const catId = makeId('cat');
      const pos = this.categoriesByServer[serverId]?.length || 0;
      await setDoc(doc(db, 'zoneServers', serverId, 'categories', catId), {
        id: catId,
        serverId,
        name: String(msg.name || 'Categoria').slice(0, 40),
        position: pos,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:category-update') {
      const serverId = String(msg.serverId || '');
      const catId = String(msg.categoryId || '');
      await updateDoc(doc(db, 'zoneServers', serverId, 'categories', catId), {
        name: String(msg.name || 'Categoria').slice(0, 40),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:category-delete') {
      const serverId = String(msg.serverId || '');
      const catId = String(msg.categoryId || '');
      await deleteDoc(doc(db, 'zoneServers', serverId, 'categories', catId));
      return;
    }

    if (type === 'instant:channel-create') {
      const serverId = String(msg.serverId || '');
      const categoryId = String(msg.categoryId || '');
      const chId = makeId('ch');
      const chType = (msg.channelType as ChannelDoc['type']) || 'text';
      const rawName = String(msg.name || 'canal');
      const cleanName = (chType === 'text' ? rawName.toLowerCase().replace(/\s+/g, '-') : rawName).slice(
        0,
        48
      );
      const siblings =
        this.channelsByServer[serverId]?.filter((c) => c.categoryId === categoryId) || [];
      await setDoc(doc(db, 'zoneServers', serverId, 'channels', chId), {
        id: chId,
        serverId,
        categoryId,
        name: cleanName || 'canal',
        topic: String(msg.topic || '').slice(0, 160),
        type: chType,
        position: siblings.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:channel-update') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (msg.name !== undefined) patch.name = String(msg.name).slice(0, 48);
      if (msg.topic !== undefined) patch.topic = String(msg.topic).slice(0, 160);
      if (msg.channelType !== undefined) patch.type = String(msg.channelType);
      if (msg.categoryId !== undefined) patch.categoryId = String(msg.categoryId);
      await updateDoc(doc(db, 'zoneServers', serverId, 'channels', channelId), patch);
      return;
    }

    if (type === 'instant:channel-delete') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      await deleteDoc(doc(db, 'zoneServers', serverId, 'channels', channelId));
      return;
    }

    if (type === 'instant:channel-move') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const chs = this.channelsByServer[serverId] || [];
      const ch = chs.find((c) => c.id === channelId);
      if (!ch) return;
      const siblings = chs
        .filter((c) => c.categoryId === ch.categoryId)
        .sort((a, b) => a.position - b.position);
      const idx = siblings.findIndex((c) => c.id === ch.id);
      const swapIdx = msg.direction === 'up' ? idx - 1 : idx + 1;
      if (idx >= 0 && swapIdx >= 0 && swapIdx < siblings.length) {
        const other = siblings[swapIdx];
        const batch = writeBatch(db);
        batch.update(doc(db, 'zoneServers', serverId, 'channels', ch.id), {
          position: other.position,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'zoneServers', serverId, 'channels', other.id), {
          position: ch.position,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }
      return;
    }

    if (type === 'instant:message-send') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const srv = this.allActiveServers.get(serverId);
      if (!serverId || !channelId) return;
      const msgId = makeId('msg');
      const now = Date.now();
      const retentionMs = retentionToMs(srv?.retention);
      const expiresAt = retentionMs ? now + retentionMs : 0;
      const attDataUrl = String(msg.attachmentDataUrl || '').slice(0, 450000);
      const attExpiresAt =
        typeof msg.attachmentExpiresAt === 'number' && msg.attachmentExpiresAt > 0
          ? msg.attachmentExpiresAt
          : attDataUrl
          ? now + 5 * 60 * 1000
          : 0;

      await setDoc(doc(db, 'zoneServers', serverId, 'channels', channelId, 'messages', msgId), {
        id: msgId,
        serverId,
        channelId,
        authorId: this.uid,
        authorName: this.displayName,
        authorTag: this.tag,
        authorAvatar: this.avatarDataUrl,
        content: String(msg.content || '').slice(0, 4000),
        attachmentName: String(msg.attachmentName || '').slice(0, 140),
        attachmentType: String(msg.attachmentType || '').slice(0, 100),
        attachmentSize: typeof msg.attachmentSize === 'number' ? msg.attachmentSize : 0,
        attachmentDataUrl: attDataUrl,
        attachmentExpiresAt: attExpiresAt,
        attachmentExpired: false,
        replyToId: String(msg.replyToId || '').slice(0, 128),
        replyToAuthor: String(msg.replyToAuthor || '').slice(0, 48),
        replyToSnippet: String(msg.replyToSnippet || '').slice(0, 160),
        edited: false,
        expiresAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:message-edit') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const messageId = String(msg.messageId || '');
      await updateDoc(doc(db, 'zoneServers', serverId, 'channels', channelId, 'messages', messageId), {
        content: String(msg.content || '').slice(0, 4000),
        edited: true,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:message-delete') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const messageId = String(msg.messageId || '');
      await deleteDoc(doc(db, 'zoneServers', serverId, 'channels', channelId, 'messages', messageId));
      return;
    }

    if (type === 'instant:reaction-toggle') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      const messageId = String(msg.messageId || '');
      const emoji = String(msg.emoji || '').slice(0, 16);
      if (!serverId || !channelId || !messageId || !emoji) return;
      const reactionId = `${messageId}_${this.uid}_${encodeEmojiId(emoji)}`;
      const ref = doc(db, 'zoneServers', serverId, 'channels', channelId, 'reactions', reactionId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          id: reactionId,
          serverId,
          channelId,
          messageId,
          userId: this.uid,
          emoji,
          createdAt: serverTimestamp(),
        });
      }
      return;
    }

    if (type === 'instant:friend-request') {
      const cleanQuery = String(msg.username || '').trim().replace(/^@/, '').toLowerCase();
      const targetUidInput = String(msg.targetUid || '');
      const target = targetUidInput
        ? this.usersByUid[targetUidInput]
        : Object.values(this.usersByUid).find((u) => {
            if (u.uid === this.uid) return false;
            const uname = u.username.toLowerCase();
            const dname = u.displayName.toLowerCase();
            const tag = (u.tag || '').toLowerCase();
            return (
              uname === cleanQuery ||
              dname === cleanQuery ||
              tag === cleanQuery ||
              tag === `#${cleanQuery}` ||
              `${dname}${tag}` === cleanQuery
            );
          });
      if (!target || target.uid === this.uid) {
        this.onMessage({
          type: 'instant:error',
          message: 'Participante não encontrado na sessão atual.',
        });
        return;
      }
      const fId = pairId(this.uid, target.uid);
      const fRef = doc(db, 'zoneFriendships', fId);
      const existing = await getDoc(fRef);
      if (existing.exists() && existing.data().status !== 'declined') return;

      const usersSorted = [this.uid, target.uid].sort();
      if (existing.exists()) {
        await deleteDoc(fRef);
      }
      await setDoc(fRef, {
        id: fId,
        users: usersSorted,
        requesterId: this.uid,
        recipientId: target.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ntfId = makeId('ntf');
      await setDoc(doc(db, 'zoneNotifications', ntfId), {
        id: ntfId,
        recipientId: target.uid,
        senderId: this.uid,
        senderName: this.displayName,
        type: 'friend_request',
        title: 'Nova solicitação de contato',
        body: `${this.displayName} quer conectar-se com você.`,
        linkServerId: '',
        linkChannelId: '',
        linkUserId: this.uid,
        inviteCode: '',
        read: false,
        createdAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:friend-respond') {
      const fId = String(msg.friendshipId || '');
      await updateDoc(doc(db, 'zoneFriendships', fId), {
        status: msg.accept ? 'accepted' : 'declined',
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:friend-remove') {
      const fId = String(msg.friendshipId || '');
      await deleteDoc(doc(db, 'zoneFriendships', fId));
      return;
    }

    if (type === 'instant:dm-open') {
      const peerUid = String(msg.peerUid || '');
      if (!peerUid || peerUid === this.uid) return;
      const threadId = pairId(this.uid, peerUid);
      const ref = doc(db, 'zoneDmThreads', threadId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          id: threadId,
          participants: [this.uid, peerUid].sort(),
          lastMessagePreview: '',
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return;
    }

    if (type === 'instant:dm-send') {
      const peerUid = String(msg.peerUid || '');
      if (!peerUid || peerUid === this.uid) return;
      const threadId = pairId(this.uid, peerUid);
      const threadRef = doc(db, 'zoneDmThreads', threadId);
      const snap = await getDoc(threadRef);
      const content = String(msg.content || '').slice(0, 4000);
      const attName = String(msg.attachmentName || '').slice(0, 140);
      const preview = (content ? content.slice(0, 120) : `Arquivo: ${attName || 'mídia'}`).slice(
        0,
        160
      );

      if (!snap.exists()) {
        await setDoc(threadRef, {
          id: threadId,
          participants: [this.uid, peerUid].sort(),
          lastMessagePreview: preview,
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(threadRef, {
          lastMessagePreview: preview,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const now = Date.now();
      const attDataUrl = String(msg.attachmentDataUrl || '').slice(0, 450000);
      const attExpiresAt =
        typeof msg.attachmentExpiresAt === 'number' && msg.attachmentExpiresAt > 0
          ? msg.attachmentExpiresAt
          : attDataUrl
          ? now + 5 * 60 * 1000
          : 0;
      const msgId = makeId('dm');
      await setDoc(doc(db, 'zoneDmThreads', threadId, 'messages', msgId), {
        id: msgId,
        threadId,
        authorId: this.uid,
        authorName: this.displayName,
        authorTag: this.tag,
        authorAvatar: this.avatarDataUrl,
        content,
        attachmentName: attName,
        attachmentType: String(msg.attachmentType || '').slice(0, 100),
        attachmentSize: typeof msg.attachmentSize === 'number' ? msg.attachmentSize : 0,
        attachmentDataUrl: attDataUrl,
        attachmentExpiresAt: attExpiresAt,
        attachmentExpired: false,
        replyToId: String(msg.replyToId || '').slice(0, 128),
        replyToAuthor: String(msg.replyToAuthor || '').slice(0, 48),
        replyToSnippet: String(msg.replyToSnippet || '').slice(0, 160),
        edited: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ntfId = makeId('ntf');
      await setDoc(doc(db, 'zoneNotifications', ntfId), {
        id: ntfId,
        recipientId: peerUid,
        senderId: this.uid,
        senderName: this.displayName,
        type: 'dm',
        title: `DM · ${this.displayName}`,
        body: preview.slice(0, 240),
        linkServerId: '',
        linkChannelId: '',
        linkUserId: this.uid,
        inviteCode: '',
        read: false,
        createdAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:dm-edit') {
      const peerUid = String(msg.peerUid || '');
      const threadId = pairId(this.uid, peerUid);
      await updateDoc(doc(db, 'zoneDmThreads', threadId, 'messages', String(msg.messageId || '')), {
        content: String(msg.content || '').slice(0, 4000),
        edited: true,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'instant:dm-delete') {
      const peerUid = String(msg.peerUid || '');
      const threadId = pairId(this.uid, peerUid);
      await deleteDoc(doc(db, 'zoneDmThreads', threadId, 'messages', String(msg.messageId || '')));
      return;
    }

    if (type === 'instant:dm-reaction') {
      const peerUid = String(msg.peerUid || '');
      const threadId = pairId(this.uid, peerUid);
      const messageId = String(msg.messageId || '');
      const emoji = String(msg.emoji || '').slice(0, 16);
      const reactionId = `${messageId}_${this.uid}_${encodeEmojiId(emoji)}`;
      const ref = doc(db, 'zoneDmThreads', threadId, 'reactions', reactionId);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
      else {
        await setDoc(ref, {
          id: reactionId,
          threadId,
          messageId,
          userId: this.uid,
          emoji,
          createdAt: serverTimestamp(),
        });
      }
      return;
    }

    if (type === 'instant:notification-read') {
      if (msg.all) {
        const unread = this.notifications.filter((n) => !n.read);
        await Promise.all(
          unread.map((n) => updateDoc(doc(db, 'zoneNotifications', n.id), { read: true }))
        );
      } else if (msg.notificationId) {
        await updateDoc(doc(db, 'zoneNotifications', String(msg.notificationId)), { read: true });
      }
      return;
    }

    if (type === 'instant:invite-notify') {
      const recipientId = String(msg.recipientId || '');
      const serverId = String(msg.serverId || '');
      const srv = this.allActiveServers.get(serverId);
      if (!recipientId || !srv) return;
      const ntfId = makeId('ntf');
      await setDoc(doc(db, 'zoneNotifications', ntfId), {
        id: ntfId,
        recipientId,
        senderId: this.uid,
        senderName: this.displayName,
        type: 'invite',
        title: `Convite para ${srv.name}`.slice(0, 120),
        body: `Código: ${srv.inviteCode}`.slice(0, 240),
        linkServerId: srv.id,
        linkChannelId: '',
        linkUserId: this.uid,
        inviteCode: srv.inviteCode,
        read: false,
        createdAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'server:subscribe') {
      const serverId = String(msg.serverId || '');
      this.activeServerId = serverId || null;
      if (serverId) {
        this.onMessage({
          type: 'server:voice-roster',
          serverId,
          roster: this.voicePeersByServer[serverId] || {},
        });
      }
      return;
    }

    if (type === 'typing:start' || type === 'typing:stop') {
      const channelKey = String(msg.channelKey || '').slice(0, 160);
      if (!channelKey) return;
      const typingId = `${sanitizeId(channelKey)}_${this.uid}`;
      const isTyping = type === 'typing:start';
      await setDoc(doc(db, 'zoneTyping', typingId), {
        id: typingId,
        channelKey,
        uid: this.uid,
        displayName: this.displayName,
        isTyping,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (type === 'room:join') {
      const serverId = String(msg.serverId || '');
      const channelId = String(msg.channelId || '');
      if (!serverId || !channelId) return;

      if (this.voiceServerId && (this.voiceServerId !== serverId || this.voiceChannelId !== channelId)) {
        await deleteDoc(doc(db, 'zoneServers', this.voiceServerId, 'voicePeers', this.uid)).catch(
          () => {}
        );
      }

      this.voiceServerId = serverId;
      this.voiceChannelId = channelId;

      const peerDoc = {
        uid: this.uid,
        serverId,
        channelId,
        displayName: String(msg.displayName || this.displayName).trim().slice(0, 48) || this.displayName,
        avatarDataUrl: String(msg.avatarDataUrl || this.avatarDataUrl).slice(0, 200000),
        micMuted: Boolean(msg.micMuted),
        camEnabled: Boolean(msg.camEnabled),
        screenSharing: Boolean(msg.screenSharing),
        speaking: false,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'zoneServers', serverId, 'voicePeers', this.uid), peerDoc);

      const peersSnap = await getDocs(
        query(
          collection(db, 'zoneServers', serverId, 'voicePeers'),
          where('serverId', '==', serverId)
        )
      );
      const now = Date.now();
      const peersInChannel: VoicePeer[] = [];
      for (const d of peersSnap.docs) {
        if (d.id === this.uid) continue;
        const raw = d.data();
        if (String(raw.channelId || '') !== channelId) continue;
        if (now - toMillis(raw.updatedAt || raw.joinedAt) > STALE_USER_MS) {
          continue;
        }
        peersInChannel.push({
          uid: String(raw.uid || d.id),
          serverId,
          channelId,
          displayName: String(raw.displayName || 'Participant'),
          avatarDataUrl: String(raw.avatarDataUrl || ''),
          micMuted: Boolean(raw.micMuted),
          camEnabled: Boolean(raw.camEnabled),
          screenSharing: Boolean(raw.screenSharing),
          speaking: Boolean(raw.speaking),
          joinedAt: toMillis(raw.joinedAt),
        });
      }
      this.prevVoicePeersInActiveChannel = new Map(peersInChannel.map((p) => [p.uid, p]));
      this.onMessage({
        type: 'room:snapshot',
        serverId,
        channelId,
        peers: peersInChannel,
      });
      return;
    }

    if (type === 'room:leave') {
      if (this.voiceServerId) {
        const oldSrv = this.voiceServerId;
        this.voiceServerId = null;
        this.voiceChannelId = null;
        this.prevVoicePeersInActiveChannel.clear();
        await deleteDoc(doc(db, 'zoneServers', oldSrv, 'voicePeers', this.uid)).catch(() => {});
      }
      return;
    }

    if (type === 'room:state' || type === 'room:media-state') {
      if (!this.voiceServerId || !this.voiceChannelId) return;
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (msg.micMuted !== undefined) patch.micMuted = Boolean(msg.micMuted);
      if (msg.camEnabled !== undefined) patch.camEnabled = Boolean(msg.camEnabled);
      if (msg.screenSharing !== undefined) patch.screenSharing = Boolean(msg.screenSharing);
      if (msg.speaking !== undefined) patch.speaking = Boolean(msg.speaking);
      await updateDoc(doc(db, 'zoneServers', this.voiceServerId, 'voicePeers', this.uid), patch);
      return;
    }

    if (type === 'rtc:offer' || type === 'rtc:answer' || type === 'rtc:ice-candidate') {
      const targetUid = String(msg.targetUid || '');
      const channelId = String(msg.channelId || this.voiceChannelId || '');
      if (!targetUid || !channelId) return;

      const sdpEnvelope =
        (msg.sdp as
          | {
              description?: { type?: string; sdp?: string };
              type?: string;
              sdp?: string;
              camStreamId?: string | null;
              screenStreamId?: string | null;
            }
          | undefined) || undefined;
      const desc = sdpEnvelope?.description || sdpEnvelope;
      const candObj =
        (msg.candidate as
          | { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null }
          | undefined) || undefined;

      const sigId = makeId('sig');
      await setDoc(doc(db, 'zoneSignals', sigId), {
        id: sigId,
        fromUid: this.uid,
        fromName: this.displayName,
        toUid: targetUid,
        channelId,
        type,
        sdpType: String(desc?.type || '').slice(0, 32),
        sdp: String(desc?.sdp || '').slice(0, 32000),
        camStreamId: String(sdpEnvelope?.camStreamId || '').slice(0, 128),
        screenStreamId: String(sdpEnvelope?.screenStreamId || '').slice(0, 128),
        candidate: String(candObj?.candidate || '').slice(0, 4096),
        sdpMid: String(candObj?.sdpMid || '').slice(0, 64),
        sdpMLineIndex: typeof candObj?.sdpMLineIndex === 'number' ? candObj.sdpMLineIndex : -1,
        createdAt: serverTimestamp(),
      });
    }
  }

  private async handleServerJoin(msg: Record<string, unknown>) {
    const code = extractRoomLookupCode(String(msg.inviteCode || ''));
    const serverIdParam = String(msg.serverId || '').trim();

    // Refresh open servers directly from Firestore in case snapshot hasn't arrived yet
    const serversSnap = await getDocs(
      query(collection(db, 'zoneServers'), where('closed', '==', false))
    );
    let targetSrv: ServerDoc | null = null;
    for (const d of serversSnap.docs) {
      const raw = d.data();
      const s: ServerDoc = {
        id: d.id,
        name: String(raw.name || 'Sala'),
        description: String(raw.description || ''),
        iconColor: String(raw.iconColor || '#3B82F6'),
        iconInitials: String(raw.iconInitials || 'ZN'),
        iconDataUrl: String(raw.iconDataUrl || ''),
        ownerId: String(raw.ownerId || 'system'),
        inviteCode: String(raw.inviteCode || ''),
        visibility: raw.visibility === 'private' ? 'private' : 'public',
        retention: (raw.retention as MessageRetention) || 'until_close',
        clearOnClose: raw.clearOnClose !== false,
        memberCount: typeof raw.memberCount === 'number' ? raw.memberCount : 0,
        createdAt: toMillis(raw.createdAt),
        updatedAt: toMillis(raw.updatedAt),
      };
      this.allActiveServers.set(s.id, s);

      if (serverIdParam && s.id === serverIdParam) {
        if (s.visibility === 'public') targetSrv = s;
      } else if (
        code &&
        (s.inviteCode.toUpperCase() === code ||
          (s.visibility === 'public' &&
            (s.id.toUpperCase() === code || s.name.trim().toUpperCase() === code)))
      ) {
        targetSrv = s;
      }
    }

    if (!targetSrv) {
      this.onMessage({
        type: 'instant:error',
        message: 'Sala ou link de convite não encontrado (verifique se a sala ainda está aberta).',
      });
      return;
    }

    await this.joinServerRecord(targetSrv.id, 'member');
    this.joinedServerIds.add(targetSrv.id);
    this.attachServerListeners(targetSrv.id);
    this.pushSnapshot();
    this.onMessage({ type: 'instant:server-joined', serverId: targetSrv.id });
  }

  public dispose() {
    this.disposed = true;
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) window.clearInterval(this.cleanupTimer);
    if (this.beforeUnloadHandler) {
      window.removeEventListener('pagehide', this.beforeUnloadHandler);
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    this.markOfflineBestEffort();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    for (const list of this.serverUnsubs.values()) list.forEach((u) => u());
    this.serverUnsubs.clear();
    for (const list of this.channelUnsubs.values()) list.forEach((u) => u());
    this.channelUnsubs.clear();
    for (const list of this.dmUnsubs.values()) list.forEach((u) => u());
    this.dmUnsubs.clear();
  }
}
