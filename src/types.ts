export type LanguageCode = 'pt-BR' | 'en' | 'ru';
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';
export type ServerRole = 'owner' | 'admin' | 'member';
export type ChannelType = 'text' | 'voice' | 'video';
export type RoomVisibility = 'public' | 'private';
export type MessageRetention = '5m' | '15m' | '60m' | 'until_close';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type NotificationType =
  | 'message'
  | 'dm'
  | 'invite'
  | 'friend_request'
  | 'voice_join'
  | 'screen_share';

export interface UserPublic {
  uid: string;
  tag?: string;
  displayName: string;
  username: string;
  bio: string;
  customStatus: string;
  presence: PresenceStatus;
  avatarDataUrl: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivate {
  uid: string;
  email: string;
  blockedUids: string[];
  notificationsEnabled: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ServerDoc {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  iconInitials: string;
  iconDataUrl: string;
  ownerId: string;
  inviteCode: string;
  visibility?: RoomVisibility;
  retention?: MessageRetention;
  clearOnClose?: boolean;
  memberCount?: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ServerMembership {
  id: string;
  serverId: string;
  userId: string;
  role: ServerRole;
  joinedAt: unknown;
}

export interface ServerMember {
  uid: string;
  serverId: string;
  role: ServerRole;
  joinedAt: unknown;
}

export interface CategoryDoc {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChannelDoc {
  id: string;
  serverId: string;
  categoryId: string;
  name: string;
  topic: string;
  type: ChannelType;
  position: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChatMessage {
  id: string;
  serverId?: string;
  channelId?: string;
  threadId?: string;
  authorId: string;
  authorName: string;
  authorTag?: string;
  authorAvatar: string;
  content: string;
  attachmentId?: string;
  attachmentName: string;
  attachmentType: string;
  attachmentSize?: number;
  attachmentDataUrl: string;
  attachmentUrl?: string;
  attachmentExpiresAt?: number;
  attachmentExpired?: boolean;
  replyToId: string;
  replyToAuthor: string;
  replyToSnippet: string;
  edited: boolean;
  expiresAt?: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: unknown;
}

export interface FriendshipDoc {
  id: string;
  users: string[];
  requesterId: string;
  recipientId: string;
  status: FriendshipStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DmThread {
  id: string;
  participants: string[];
  lastMessagePreview: string;
  lastMessageAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  type: NotificationType;
  title: string;
  body: string;
  linkServerId: string;
  linkChannelId: string;
  linkUserId: string;
  read: boolean;
  createdAt: unknown;
}

export interface VoicePeer {
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

export interface ToastAlert {
  id: string;
  title: string;
  body: string;
  type: NotificationType | 'info' | 'error';
  createdAt: number;
}
