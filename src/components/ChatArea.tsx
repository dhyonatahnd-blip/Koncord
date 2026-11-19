import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CornerUpLeft,
  Download,
  Edit3,
  FileText,
  Paperclip,
  SendHorizontal,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import { ChatMessage, MessageReaction, UserPublic } from '../types';
import { FIELD_LIMITS, fileToCompressedDataUrl } from '../lib/validation';
import { Avatar } from './Avatar';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🚀', '😂', '👏', '👀', '🎉', '✨', '💯'];

function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Agora';
  let date: Date;
  if (typeof ts === 'number') {
    date = new Date(ts);
  } else if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    date = ts;
  } else {
    return 'Agora';
  }
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hoje às ${time}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`;
}

interface ChatAreaProps {
  channelKey: string;
  placeholder: string;
  messages: ChatMessage[];
  reactions: MessageReaction[];
  currentUser: UserPublic;
  blockedUids: string[];
  canModerate?: boolean;
  typingUsers: string[];
  onTypingChange: (isTyping: boolean) => void;
  onSendMessage: (payload: {
    content: string;
    attachment?: { name: string; type: string; dataUrl: string };
    replyTo?: { id: string; authorName: string; snippet: string };
  }) => Promise<void>;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleReaction: (messageId: string, emoji: string, currentlyReacted: boolean) => Promise<void>;
  onClickAuthor?: (uid: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channelKey,
  placeholder,
  messages,
  reactions,
  currentUser,
  blockedUids,
  canModerate = false,
  typingUsers,
  onTypingChange,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onClickAuthor,
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; type: string; dataUrl: string } | null>(
    null
  );
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string; snippet: string } | null>(
    null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !blockedUids.includes(m.authorId)),
    [messages, blockedUids]
  );

  // Group reactions by messageId -> emoji -> userIds
  const reactionsMap = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const r of reactions) {
      if (!map[r.messageId]) map[r.messageId] = {};
      if (!map[r.messageId][r.emoji]) map[r.messageId][r.emoji] = [];
      map[r.messageId][r.emoji].push(r.userId);
    }
    return map;
  }, [reactions]);

  useEffect(() => {
    setReplyTo(null);
    setEditingId(null);
    setPickerMessageId(null);
    setComposerEmojiOpen(false);
  }, [channelKey]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length, channelKey]);

  const handleDraftChange = (val: string) => {
    setDraft(val);
    onTypingChange(val.trim().length > 0);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (val.trim().length > 0) {
      typingTimerRef.current = window.setTimeout(() => {
        onTypingChange(false);
      }, 2500);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      const processed = await fileToCompressedDataUrl(
        file,
        FIELD_LIMITS.ATTACHMENT_DATA_URL_MAX,
        1280
      );
      setAttachment(processed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if ((!content && !attachment) || sending) return;
    setSending(true);
    setUploadError(null);
    try {
      await onSendMessage({
        content,
        attachment: attachment || undefined,
        replyTo: replyTo || undefined,
      });
      setDraft('');
      setAttachment(null);
      setReplyTo(null);
      onTypingChange(false);
    } finally {
      setSending(false);
    }
  };

  const submitEdit = async (messageId: string) => {
    const clean = editingDraft.trim();
    if (!clean) return;
    await onEditMessage(messageId, clean);
    setEditingId(null);
    setEditingDraft('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0C10]">
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-1">
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-center text-zinc-400 mb-4">
              <SendHorizontal className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-200">Nenhuma mensagem ainda</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Envie a primeira mensagem, compartilhe uma imagem ou anexe um arquivo para iniciar a conversa.
            </p>
          </div>
        ) : (
          visibleMessages.map((msg, idx) => {
            const prev = idx > 0 ? visibleMessages[idx - 1] : null;
            const isGrouped = Boolean(prev && prev.authorId === msg.authorId && !msg.replyToId);
            const isOwn = msg.authorId === currentUser.uid;
            const msgReactions = reactionsMap[msg.id] || {};

            return (
              <div
                key={msg.id}
                className={`group relative rounded-xl px-3 transition-colors hover:bg-white/[0.03] ${
                  isGrouped ? 'py-1' : 'pt-3 pb-1.5 mt-1'
                }`}
              >
                {/* Hover Action Toolbar */}
                <div className="hidden group-hover:flex items-center gap-0.5 absolute -top-3 right-3 z-10 px-1.5 py-1 rounded-lg bg-[#161820] border border-white/10 shadow-xl">
                  <button
                    type="button"
                    onClick={() => setPickerMessageId(pickerMessageId === msg.id ? null : msg.id)}
                    title="Reagir"
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReplyTo({
                        id: msg.id,
                        authorName: msg.authorName,
                        snippet: msg.content || msg.attachmentName || 'Anexo',
                      })
                    }
                    title="Responder"
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" />
                  </button>
                  {isOwn && msg.content && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(msg.id);
                        setEditingDraft(msg.content);
                      }}
                      title="Editar"
                      className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(isOwn || canModerate) && (
                    <button
                      type="button"
                      onClick={() => onDeleteMessage(msg.id)}
                      title="Excluir"
                      className="p-1.5 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Inline Emoji Picker */}
                {pickerMessageId === msg.id && (
                  <div className="absolute right-3 top-6 z-20 flex items-center gap-1 p-1.5 rounded-xl bg-[#181A23] border border-white/12 shadow-2xl">
                    {QUICK_EMOJIS.map((emoji) => {
                      const already = (msgReactions[emoji] || []).includes(currentUser.uid);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={async () => {
                            setPickerMessageId(null);
                            await onToggleReaction(msg.id, emoji, already);
                          }}
                          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-base transition-transform hover:scale-110"
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Reply Quote Banner */}
                {msg.replyToId && (
                  <div className="flex items-center gap-2 ml-12 mb-1 text-xs text-zinc-400">
                    <CornerUpLeft className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="font-medium text-zinc-300">{msg.replyToAuthor}</span>
                    <span className="truncate max-w-md text-zinc-500">{msg.replyToSnippet}</span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  {isGrouped ? (
                    <div className="w-9 shrink-0 text-[10px] font-mono text-zinc-600 opacity-0 group-hover:opacity-100 text-right pt-1 select-none tabular-nums">
                      {formatTimestamp(msg.createdAt).split(' ').pop()}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onClickAuthor?.(msg.authorId)}
                      className="shrink-0 mt-0.5"
                    >
                      <Avatar name={msg.authorName} src={msg.authorAvatar} size="md" />
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2.5 mb-0.5">
                        <button
                          type="button"
                          onClick={() => onClickAuthor?.(msg.authorId)}
                          className="text-sm font-semibold text-white hover:underline"
                        >
                          {msg.authorName}
                        </button>
                        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                          {formatTimestamp(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    {editingId === msg.id ? (
                      <div className="mt-1 space-y-2">
                        <input
                          type="text"
                          value={editingDraft}
                          maxLength={FIELD_LIMITS.MESSAGE_CONTENT_MAX}
                          onChange={(e) => setEditingDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitEdit(msg.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-indigo-500/50 text-sm text-white"
                        />
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => submitEdit(msg.id)}
                            className="px-2.5 py-1 rounded-md bg-indigo-500 text-white font-medium flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 rounded-md bg-white/5 text-zinc-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      msg.content && (
                        <p className="text-[14.5px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                          {msg.edited && (
                            <span className="ml-1.5 text-[11px] text-zinc-500">(editado)</span>
                          )}
                        </p>
                      )
                    )}

                    {/* Attachment Rendering */}
                    {msg.attachmentDataUrl && (
                      <div className="mt-2">
                        {msg.attachmentType.startsWith('image/') ? (
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({ src: msg.attachmentDataUrl, name: msg.attachmentName })
                            }
                            className="block rounded-xl overflow-hidden border border-white/10 max-w-sm hover:opacity-95 transition-opacity"
                          >
                            <img
                              src={msg.attachmentDataUrl}
                              alt={msg.attachmentName || 'Imagem enviada'}
                              referrerPolicy="no-referrer"
                              className="max-h-72 w-auto object-contain bg-black/40"
                            />
                          </button>
                        ) : (
                          <a
                            href={msg.attachmentDataUrl}
                            download={msg.attachmentName || 'arquivo'}
                            className="inline-flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-colors max-w-xs"
                          >
                            <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-zinc-200 truncate">
                                {msg.attachmentName || 'Arquivo anexo'}
                              </div>
                              <div className="text-[11px] text-zinc-500">Clique para baixar</div>
                            </div>
                            <Download className="w-4 h-4 text-zinc-400 shrink-0" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Reaction Chips */}
                    {Object.keys(msgReactions).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(msgReactions).map(([emoji, users]) => {
                          const reacted = users.includes(currentUser.uid);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => onToggleReaction(msg.id, emoji, reacted)}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs border transition-colors ${
                                reacted
                                  ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200'
                                  : 'bg-white/[0.04] border-white/10 text-zinc-300 hover:bg-white/[0.08]'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-mono text-[11px] tabular-nums">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {/* Typing Indicator Strip */}
      <div className="px-6 h-5 flex items-center text-xs text-zinc-400">
        {typingUsers.length > 0 && (
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} está digitando...`
              : `${typingUsers.join(', ')} estão digitando...`}
          </span>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 sm:px-6 pb-4 pt-1">
        {uploadError && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center justify-between">
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {replyTo && (
          <div className="mb-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CornerUpLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-zinc-400">Respondendo a</span>
              <span className="font-semibold text-white">{replyTo.authorName}</span>
              <span className="text-zinc-500 truncate">{replyTo.snippet}</span>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {attachment && (
          <div className="mb-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {attachment.type.startsWith('image/') ? (
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="w-12 h-12 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-200 truncate">{attachment.name}</div>
                <div className="text-[11px] text-zinc-500">Pronto para enviar</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="relative flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#14161D] border border-white/10 focus-within:border-indigo-500/60 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFilePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar imagem ou arquivo"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={draft}
            maxLength={FIELD_LIMITS.MESSAGE_CONTENT_MAX}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none py-1.5"
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setComposerEmojiOpen((o) => !o)}
              title="Inserir emoji"
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors shrink-0"
            >
              <Smile className="w-4 h-4" />
            </button>
            {composerEmojiOpen && (
              <div className="absolute bottom-12 right-0 z-20 flex flex-wrap gap-1 p-2 rounded-xl bg-[#181A23] border border-white/12 shadow-2xl w-52">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      handleDraftChange(`${draft}${emoji}`);
                      setComposerEmojiOpen(false);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-base"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={sending || (!draft.trim() && !attachment)}
            className="p-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-40 disabled:hover:bg-indigo-500 transition-colors shrink-0"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={lightboxImage.src}
              alt={lightboxImage.name}
              className="max-w-full max-h-[82vh] rounded-2xl border border-white/10 object-contain"
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-zinc-300">{lightboxImage.name}</span>
              <a
                href={lightboxImage.src}
                download={lightboxImage.name}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Baixar
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
