import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  clampString,
  encodeEmojiId,
  FIELD_LIMITS,
  generateInviteCode,
  generateSafeId,
  getInitials,
  pairId,
  sanitizeId,
  sanitizeUsername,
} from './validation';
import {
  ChannelType,
  FriendshipDoc,
  NotificationType,
  PresenceStatus,
  ServerRole,
  UserPrivate,
  UserPublic,
} from '../types';

const SERVER_GRADIENTS = [
  '#5B6AF0',
  '#38BDF8',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
];

export async function ensureUserProfiles(
  user: User,
  preferredDisplayName?: string,
  preferredUsername?: string
): Promise<{ publicProfile: UserPublic; privateProfile: UserPrivate }> {
  const uid = sanitizeId(user.uid);
  const pubRef = doc(db, 'usersPublic', uid);
  const privRef = doc(db, 'usersPrivate', uid);

  try {
    const [pubSnap, privSnap] = await Promise.all([getDoc(pubRef), getDoc(privRef)]);
    let publicProfile: UserPublic;
    let privateProfile: UserPrivate;

    if (!pubSnap.exists()) {
      const displayName = clampString(
        preferredDisplayName || user.displayName || user.email?.split('@')[0] || 'Membro Vesper',
        FIELD_LIMITS.DISPLAY_NAME_MAX
      );
      const username = sanitizeUsername(
        preferredUsername || user.email?.split('@')[0] || displayName
      );
      const payload = {
        uid,
        displayName,
        username,
        bio: 'Conectado na plataforma Vesper.',
        customStatus: '',
        presence: 'online' as PresenceStatus,
        avatarDataUrl: clampString(user.photoURL || '', FIELD_LIMITS.AVATAR_DATA_URL_MAX),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(pubRef, payload);
      const freshPub = await getDoc(pubRef);
      publicProfile = freshPub.data() as UserPublic;
    } else {
      publicProfile = pubSnap.data() as UserPublic;
    }

    if (!privSnap.exists()) {
      const payload = {
        uid,
        email: clampString(user.email || '', FIELD_LIMITS.EMAIL_MAX),
        blockedUids: [] as string[],
        notificationsEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(privRef, payload);
      const freshPriv = await getDoc(privRef);
      privateProfile = freshPriv.data() as UserPrivate;
    } else {
      privateProfile = privSnap.data() as UserPrivate;
    }

    // Ensure user has at least one starter community workspace if none joined yet
    const membershipsQuery = query(
      collection(db, 'serverMemberships'),
      where('userId', '==', uid),
      limit(1)
    );
    const membershipSnap = await getDocs(membershipsQuery);
    if (membershipSnap.empty) {
      await createServer({
        ownerId: uid,
        name: `Estúdio ${publicProfile.displayName.split(' ')[0]}`,
        description: 'Comunidade principal com salas de texto, voz, vídeo e compartilhamento de tela.',
        iconColor: '#5B6AF0',
      });
    }

    return { publicProfile, privateProfile };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `usersPublic/${uid}`);
  }
}

export async function updateUserPublicProfile(
  uid: string,
  updates: Partial<Pick<UserPublic, 'displayName' | 'username' | 'bio' | 'customStatus' | 'presence' | 'avatarDataUrl'>>
) {
  const path = `usersPublic/${uid}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.displayName !== undefined) {
      clean.displayName = clampString(updates.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX) || 'Usuário';
    }
    if (updates.username !== undefined) {
      clean.username = sanitizeUsername(updates.username);
    }
    if (updates.bio !== undefined) {
      clean.bio = clampString(updates.bio, FIELD_LIMITS.BIO_MAX);
    }
    if (updates.customStatus !== undefined) {
      clean.customStatus = clampString(updates.customStatus, FIELD_LIMITS.CUSTOM_STATUS_MAX);
    }
    if (updates.presence !== undefined) {
      clean.presence = updates.presence;
    }
    if (updates.avatarDataUrl !== undefined) {
      clean.avatarDataUrl = clampString(updates.avatarDataUrl, FIELD_LIMITS.AVATAR_DATA_URL_MAX);
    }
    await updateDoc(doc(db, 'usersPublic', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPrivatePreferences(
  uid: string,
  updates: { blockedUids?: string[]; notificationsEnabled?: boolean }
) {
  const path = `usersPrivate/${uid}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.blockedUids !== undefined) {
      clean.blockedUids = updates.blockedUids.slice(0, FIELD_LIMITS.BLOCKED_UIDS_MAX);
    }
    if (updates.notificationsEnabled !== undefined) {
      clean.notificationsEnabled = updates.notificationsEnabled;
    }
    await updateDoc(doc(db, 'usersPrivate', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createServer(params: {
  ownerId: string;
  name: string;
  description?: string;
  iconColor?: string;
  iconDataUrl?: string;
}): Promise<string> {
  const serverId = generateSafeId('srv');
  const inviteCode = generateInviteCode();
  const cleanName = clampString(params.name, FIELD_LIMITS.SERVER_NAME_MAX) || 'Nova Comunidade';
  const cleanDesc = clampString(params.description || '', FIELD_LIMITS.SERVER_DESC_MAX);
  const iconColor =
    params.iconColor || SERVER_GRADIENTS[Math.floor(Math.random() * SERVER_GRADIENTS.length)];
  const iconInitials = getInitials(cleanName);
  const iconDataUrl = clampString(params.iconDataUrl || '', FIELD_LIMITS.AVATAR_DATA_URL_MAX);

  const catTextId = generateSafeId('cat');
  const catVoiceId = generateSafeId('cat');
  const chGeneralId = generateSafeId('ch');
  const chUpdatesId = generateSafeId('ch');
  const chVoiceId = generateSafeId('ch');
  const chVideoId = generateSafeId('ch');

  const batch = writeBatch(db);

  batch.set(doc(db, 'servers', serverId), {
    id: serverId,
    name: cleanName,
    description: cleanDesc,
    iconColor,
    iconInitials,
    iconDataUrl,
    ownerId: params.ownerId,
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'servers', serverId, 'members', params.ownerId), {
    uid: params.ownerId,
    serverId,
    role: 'owner' as ServerRole,
    joinedAt: serverTimestamp(),
  });

  const membershipId = `${serverId}_${params.ownerId}`;
  batch.set(doc(db, 'serverMemberships', membershipId), {
    id: membershipId,
    serverId,
    userId: params.ownerId,
    role: 'owner' as ServerRole,
    joinedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'invites', inviteCode), {
    code: inviteCode,
    serverId,
    serverName: cleanName,
    serverIconColor: iconColor,
    createdBy: params.ownerId,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'servers', serverId, 'categories', catTextId), {
    id: catTextId,
    serverId,
    name: 'Canais de Texto',
    position: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'servers', serverId, 'categories', catVoiceId), {
    id: catVoiceId,
    serverId,
    name: 'Voz, Vídeo & Tela',
    position: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'servers', serverId, 'channels', chGeneralId), {
    id: chGeneralId,
    serverId,
    categoryId: catTextId,
    name: 'geral',
    topic: 'Conversas abertas da comunidade em tempo real.',
    type: 'text' as ChannelType,
    position: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'servers', serverId, 'channels', chUpdatesId), {
    id: chUpdatesId,
    serverId,
    categoryId: catTextId,
    name: 'anúncios',
    topic: 'Comunicados importantes e marcos do servidor.',
    type: 'text' as ChannelType,
    position: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'servers', serverId, 'channels', chVoiceId), {
    id: chVoiceId,
    serverId,
    categoryId: catVoiceId,
    name: 'Lounge de Voz',
    topic: 'Áudio em tempo real com baixa latência.',
    type: 'voice' as ChannelType,
    position: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'servers', serverId, 'channels', chVideoId), {
    id: chVideoId,
    serverId,
    categoryId: catVoiceId,
    name: 'Sala Vídeo & Tela',
    topic: 'Chamada com câmera e compartilhamento de tela em alta definição.',
    type: 'video' as ChannelType,
    position: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return serverId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `servers/${serverId}`);
  }
}

export async function joinServerByInviteCode(codeInput: string, uid: string): Promise<string> {
  const code = sanitizeId(codeInput.trim().toUpperCase());
  if (code.length < 4) {
    throw new Error('Código de convite inválido.');
  }

  try {
    const inviteSnap = await getDoc(doc(db, 'invites', code));
    if (!inviteSnap.exists()) {
      throw new Error('Convite não encontrado ou expirado.');
    }
    const invite = inviteSnap.data() as { serverId: string; serverName: string };
    const memberRef = doc(db, 'servers', invite.serverId, 'members', uid);
    const existingMember = await getDoc(memberRef);
    if (existingMember.exists()) {
      return invite.serverId;
    }

    const batch = writeBatch(db);
    batch.set(memberRef, {
      uid,
      serverId: invite.serverId,
      role: 'member' as ServerRole,
      joinedAt: serverTimestamp(),
    });
    const membershipId = `${invite.serverId}_${uid}`;
    batch.set(doc(db, 'serverMemberships', membershipId), {
      id: membershipId,
      serverId: invite.serverId,
      userId: uid,
      role: 'member' as ServerRole,
      joinedAt: serverTimestamp(),
    });
    await batch.commit();
    return invite.serverId;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Convite') || error.message.includes('Código'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `invites/${code}`);
  }
}

export async function updateServerInfo(
  serverId: string,
  updates: { name?: string; description?: string; iconColor?: string; iconDataUrl?: string }
) {
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) {
      const n = clampString(updates.name, FIELD_LIMITS.SERVER_NAME_MAX) || 'Comunidade';
      clean.name = n;
      clean.iconInitials = getInitials(n);
    }
    if (updates.description !== undefined) {
      clean.description = clampString(updates.description, FIELD_LIMITS.SERVER_DESC_MAX);
    }
    if (updates.iconColor !== undefined) {
      clean.iconColor = updates.iconColor;
    }
    if (updates.iconDataUrl !== undefined) {
      clean.iconDataUrl = clampString(updates.iconDataUrl, FIELD_LIMITS.AVATAR_DATA_URL_MAX);
    }
    await updateDoc(doc(db, 'servers', serverId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `servers/${serverId}`);
  }
}

export async function leaveServer(serverId: string, uid: string) {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'servers', serverId, 'members', uid));
    batch.delete(doc(db, 'serverMemberships', `${serverId}_${uid}`));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `servers/${serverId}/members/${uid}`);
  }
}

export async function updateMemberRole(serverId: string, targetUid: string, role: 'admin' | 'member') {
  try {
    await updateDoc(doc(db, 'servers', serverId, 'members', targetUid), { role });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `servers/${serverId}/members/${targetUid}`);
  }
}

export async function createCategory(serverId: string, name: string, position: number): Promise<string> {
  const categoryId = generateSafeId('cat');
  try {
    await setDoc(doc(db, 'servers', serverId, 'categories', categoryId), {
      id: categoryId,
      serverId,
      name: clampString(name, FIELD_LIMITS.CATEGORY_NAME_MAX) || 'Nova Categoria',
      position,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return categoryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `servers/${serverId}/categories/${categoryId}`);
  }
}

export async function updateCategory(serverId: string, categoryId: string, name: string, position?: number) {
  try {
    const clean: Record<string, unknown> = {
      name: clampString(name, FIELD_LIMITS.CATEGORY_NAME_MAX) || 'Categoria',
      updatedAt: serverTimestamp(),
    };
    if (position !== undefined) clean.position = position;
    await updateDoc(doc(db, 'servers', serverId, 'categories', categoryId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `servers/${serverId}/categories/${categoryId}`);
  }
}

export async function deleteCategory(serverId: string, categoryId: string) {
  try {
    await deleteDoc(doc(db, 'servers', serverId, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `servers/${serverId}/categories/${categoryId}`);
  }
}

export async function createChannel(params: {
  serverId: string;
  categoryId: string;
  name: string;
  topic?: string;
  type: ChannelType;
  position: number;
}): Promise<string> {
  const channelId = generateSafeId('ch');
  const rawName = params.type === 'text' ? params.name.toLowerCase().replace(/\s+/g, '-') : params.name;
  try {
    await setDoc(doc(db, 'servers', params.serverId, 'channels', channelId), {
      id: channelId,
      serverId: params.serverId,
      categoryId: params.categoryId,
      name: clampString(rawName, FIELD_LIMITS.CHANNEL_NAME_MAX) || 'novo-canal',
      topic: clampString(params.topic || '', FIELD_LIMITS.CHANNEL_TOPIC_MAX),
      type: params.type,
      position: params.position,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return channelId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `servers/${params.serverId}/channels/${channelId}`);
  }
}

export async function updateChannel(
  serverId: string,
  channelId: string,
  updates: { name?: string; topic?: string; type?: ChannelType; categoryId?: string; position?: number }
) {
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) {
      clean.name = clampString(updates.name, FIELD_LIMITS.CHANNEL_NAME_MAX) || 'canal';
    }
    if (updates.topic !== undefined) {
      clean.topic = clampString(updates.topic, FIELD_LIMITS.CHANNEL_TOPIC_MAX);
    }
    if (updates.type !== undefined) clean.type = updates.type;
    if (updates.categoryId !== undefined) clean.categoryId = updates.categoryId;
    if (updates.position !== undefined) clean.position = updates.position;

    await updateDoc(doc(db, 'servers', serverId, 'channels', channelId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `servers/${serverId}/channels/${channelId}`);
  }
}

export async function deleteChannel(serverId: string, channelId: string) {
  try {
    await deleteDoc(doc(db, 'servers', serverId, 'channels', channelId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `servers/${serverId}/channels/${channelId}`);
  }
}

export async function sendChannelMessage(params: {
  serverId: string;
  channelId: string;
  author: UserPublic;
  content: string;
  attachment?: { name: string; type: string; dataUrl: string };
  replyTo?: { id: string; authorName: string; snippet: string };
}) {
  const messageId = generateSafeId('msg');
  const path = `servers/${params.serverId}/channels/${params.channelId}/messages/${messageId}`;
  try {
    await setDoc(doc(db, 'servers', params.serverId, 'channels', params.channelId, 'messages', messageId), {
      id: messageId,
      serverId: params.serverId,
      channelId: params.channelId,
      authorId: params.author.uid,
      authorName: clampString(params.author.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX) || 'Usuário',
      authorAvatar: clampString(params.author.avatarDataUrl || '', FIELD_LIMITS.AVATAR_DATA_URL_MAX),
      content: clampString(params.content, FIELD_LIMITS.MESSAGE_CONTENT_MAX),
      attachmentName: clampString(params.attachment?.name || '', FIELD_LIMITS.ATTACHMENT_NAME_MAX),
      attachmentType: clampString(params.attachment?.type || '', FIELD_LIMITS.ATTACHMENT_TYPE_MAX),
      attachmentDataUrl: clampString(params.attachment?.dataUrl || '', FIELD_LIMITS.ATTACHMENT_DATA_URL_MAX),
      replyToId: params.replyTo?.id || '',
      replyToAuthor: clampString(params.replyTo?.authorName || '', FIELD_LIMITS.DISPLAY_NAME_MAX),
      replyToSnippet: clampString(params.replyTo?.snippet || '', FIELD_LIMITS.REPLY_SNIPPET_MAX),
      edited: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function editChannelMessage(
  serverId: string,
  channelId: string,
  messageId: string,
  content: string
) {
  const path = `servers/${serverId}/channels/${channelId}/messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId), {
      content: clampString(content, FIELD_LIMITS.MESSAGE_CONTENT_MAX),
      edited: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteChannelMessage(serverId: string, channelId: string, messageId: string) {
  const path = `servers/${serverId}/channels/${channelId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleChannelReaction(params: {
  serverId: string;
  channelId: string;
  messageId: string;
  userId: string;
  emoji: string;
  currentlyReacted: boolean;
}) {
  const reactionId = `${params.messageId}_${params.userId}_${encodeEmojiId(params.emoji)}`;
  const ref = doc(
    db,
    'servers',
    params.serverId,
    'channels',
    params.channelId,
    'reactions',
    reactionId
  );
  try {
    if (params.currentlyReacted) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        id: reactionId,
        serverId: params.serverId,
        channelId: params.channelId,
        messageId: params.messageId,
        userId: params.userId,
        emoji: clampString(params.emoji, FIELD_LIMITS.EMOJI_MAX),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ref.path);
  }
}

export async function findUserByUsername(usernameInput: string): Promise<UserPublic | null> {
  const clean = sanitizeUsername(usernameInput.replace(/^@/, ''));
  try {
    const q = query(collection(db, 'usersPublic'), where('username', '==', clean), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as UserPublic;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'usersPublic');
  }
}

export async function sendFriendRequest(requester: UserPublic, recipient: UserPublic) {
  if (requester.uid === recipient.uid) {
    throw new Error('Você não pode adicionar a si mesmo.');
  }
  const fId = pairId(requester.uid, recipient.uid);
  const fRef = doc(db, 'friendships', fId);
  try {
    const existing = await getDoc(fRef);
    if (existing.exists()) {
      const data = existing.data() as FriendshipDoc;
      if (data.status === 'accepted') throw new Error('Vocês já são amigos.');
      if (data.status === 'pending') throw new Error('Já existe uma solicitação pendente.');
      // If declined previously, remove old doc so a fresh request can be sent
      await deleteDoc(fRef);
    }

    await setDoc(fRef, {
      id: fId,
      users: [requester.uid, recipient.uid],
      requesterId: requester.uid,
      recipientId: recipient.uid,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      recipientId: recipient.uid,
      senderId: requester.uid,
      senderName: requester.displayName,
      type: 'friend_request',
      title: 'Nova solicitação de amizade',
      body: `${requester.displayName} (@${requester.username}) quer conectar-se com você.`,
      linkUserId: requester.uid,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('já são') || error.message.includes('pendente') || error.message.includes('si mesmo'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `friendships/${fId}`);
  }
}

export async function respondFriendRequest(friendshipId: string, status: 'accepted' | 'declined') {
  try {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `friendships/${friendshipId}`);
  }
}

export async function removeFriendship(friendshipId: string) {
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `friendships/${friendshipId}`);
  }
}

export async function getOrCreateDmThread(currentUid: string, peerUid: string): Promise<string> {
  const threadId = pairId(currentUid, peerUid);
  const ref = doc(db, 'dmThreads', threadId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: threadId,
        participants: [currentUid, peerUid],
        lastMessagePreview: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return threadId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `dmThreads/${threadId}`);
  }
}

export async function sendDmMessage(params: {
  threadId: string;
  recipientUid: string;
  author: UserPublic;
  content: string;
  attachment?: { name: string; type: string; dataUrl: string };
  replyTo?: { id: string; authorName: string; snippet: string };
}) {
  const messageId = generateSafeId('dm');
  const preview = params.content
    ? clampString(params.content, 120)
    : `Arquivo: ${clampString(params.attachment?.name || 'mídia', 80)}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'dmThreads', params.threadId, 'messages', messageId), {
      id: messageId,
      threadId: params.threadId,
      authorId: params.author.uid,
      authorName: clampString(params.author.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX) || 'Usuário',
      authorAvatar: clampString(params.author.avatarDataUrl || '', FIELD_LIMITS.AVATAR_DATA_URL_MAX),
      content: clampString(params.content, FIELD_LIMITS.MESSAGE_CONTENT_MAX),
      attachmentName: clampString(params.attachment?.name || '', FIELD_LIMITS.ATTACHMENT_NAME_MAX),
      attachmentType: clampString(params.attachment?.type || '', FIELD_LIMITS.ATTACHMENT_TYPE_MAX),
      attachmentDataUrl: clampString(params.attachment?.dataUrl || '', FIELD_LIMITS.ATTACHMENT_DATA_URL_MAX),
      replyToId: params.replyTo?.id || '',
      replyToAuthor: clampString(params.replyTo?.authorName || '', FIELD_LIMITS.DISPLAY_NAME_MAX),
      replyToSnippet: clampString(params.replyTo?.snippet || '', FIELD_LIMITS.REPLY_SNIPPET_MAX),
      edited: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'dmThreads', params.threadId), {
      lastMessagePreview: preview,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await createNotification({
      recipientId: params.recipientUid,
      senderId: params.author.uid,
      senderName: params.author.displayName,
      type: 'dm',
      title: `Mensagem privada de ${params.author.displayName}`,
      body: preview,
      linkUserId: params.author.uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `dmThreads/${params.threadId}/messages/${messageId}`);
  }
}

export async function editDmMessage(threadId: string, messageId: string, content: string) {
  try {
    await updateDoc(doc(db, 'dmThreads', threadId, 'messages', messageId), {
      content: clampString(content, FIELD_LIMITS.MESSAGE_CONTENT_MAX),
      edited: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dmThreads/${threadId}/messages/${messageId}`);
  }
}

export async function deleteDmMessage(threadId: string, messageId: string) {
  try {
    await deleteDoc(doc(db, 'dmThreads', threadId, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `dmThreads/${threadId}/messages/${messageId}`);
  }
}

export async function toggleDmReaction(params: {
  threadId: string;
  messageId: string;
  userId: string;
  emoji: string;
  currentlyReacted: boolean;
}) {
  const reactionId = `${params.messageId}_${params.userId}_${encodeEmojiId(params.emoji)}`;
  const ref = doc(db, 'dmThreads', params.threadId, 'reactions', reactionId);
  try {
    if (params.currentlyReacted) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        id: reactionId,
        threadId: params.threadId,
        messageId: params.messageId,
        userId: params.userId,
        emoji: clampString(params.emoji, FIELD_LIMITS.EMOJI_MAX),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ref.path);
  }
}

export async function createNotification(params: {
  recipientId: string;
  senderId: string;
  senderName: string;
  type: NotificationType;
  title: string;
  body: string;
  linkServerId?: string;
  linkChannelId?: string;
  linkUserId?: string;
}) {
  if (!params.recipientId || params.recipientId === params.senderId) return;
  const notificationId = generateSafeId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notificationId), {
      id: notificationId,
      recipientId: params.recipientId,
      senderId: params.senderId,
      senderName: clampString(params.senderName, FIELD_LIMITS.DISPLAY_NAME_MAX) || 'Usuário',
      type: params.type,
      title: clampString(params.title, FIELD_LIMITS.NOTIFICATION_TITLE_MAX),
      body: clampString(params.body, FIELD_LIMITS.NOTIFICATION_BODY_MAX),
      linkServerId: params.linkServerId || '',
      linkChannelId: params.linkChannelId || '',
      linkUserId: params.linkUserId || '',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notificationId}`);
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of notificationIds.slice(0, 100)) {
      batch.update(doc(db, 'notifications', id), { read: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}
