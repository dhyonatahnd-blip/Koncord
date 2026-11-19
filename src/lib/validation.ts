export const FIELD_LIMITS = {
  DISPLAY_NAME_MAX: 32,
  USERNAME_MAX: 32,
  BIO_MAX: 240,
  CUSTOM_STATUS_MAX: 80,
  SERVER_NAME_MAX: 64,
  SERVER_DESC_MAX: 240,
  CATEGORY_NAME_MAX: 40,
  CHANNEL_NAME_MAX: 48,
  CHANNEL_TOPIC_MAX: 160,
  MESSAGE_CONTENT_MAX: 4000,
  TEMP_FILE_BYTES_MAX: 10 * 1024 * 1024, // 10 MB per temporary file
  TEMP_FILE_TTL_MS: 5 * 60 * 1000, // 5 minutes mandatory server expiration
  ATTACHMENT_DATA_URL_MAX: 450000,
  AVATAR_DATA_URL_MAX: 180000,
  EMAIL_MAX: 120,
  BLOCKED_UIDS_MAX: 200,
  ATTACHMENT_NAME_MAX: 140,
  ATTACHMENT_TYPE_MAX: 120,
  REPLY_SNIPPET_MAX: 180,
  EMOJI_MAX: 32,
  NOTIFICATION_TITLE_MAX: 120,
  NOTIFICATION_BODY_MAX: 300,
};

export const ALLOWED_UPLOAD_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'mp4',
  'webm',
  'pdf',
  'txt',
  'md',
  'csv',
  'json',
  'docx',
  'xlsx',
  'zip',
];

export const ALLOWED_UPLOAD_MIME_PREFIXES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
];

export function isAllowedTemporaryFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) return true;
  if (file.type && ALLOWED_UPLOAD_MIME_PREFIXES.includes(file.type.toLowerCase())) return true;
  return false;
}

export function sanitizeChannelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, FIELD_LIMITS.CHANNEL_NAME_MAX);
}

export function sanitizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, FIELD_LIMITS.USERNAME_MAX);
}

export function computeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'ZN';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const getInitials = computeInitials;

export function pairId(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export function sanitizeId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

export function clampString(raw: string, max: number): string {
  return raw.trim().slice(0, max);
}

export function generateSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function encodeEmojiId(emoji: string): string {
  return Array.from(emoji)
    .map((ch) => ch.codePointAt(0)?.toString(16) || '0')
    .join('_');
}

export function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!envUrl) return '';
  return envUrl.replace(/\/+$/, '');
}

export function resolveAttachmentUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const base = getApiBaseUrl();
  return base ? `${base}${url.startsWith('/') ? '' : '/'}${url}` : url;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatRemainingMs(ms: number): string {
  const clamped = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export async function fileToCompressedDataUrl(
  file: File,
  maxLengthBytes = FIELD_LIMITS.AVATAR_DATA_URL_MAX,
  maxDim = 512
): Promise<{ dataUrl: string; type: string; name: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
  }
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao carregar imagem.'));
      el.src = bitmapUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.84;
    let out = canvas.toDataURL('image/webp', quality);
    while (out.length > maxLengthBytes && quality > 0.3) {
      quality -= 0.14;
      out = canvas.toDataURL('image/webp', quality);
    }
    return {
      dataUrl: out,
      type: 'image/webp',
      name: file.name,
    };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export function fileToBase64Payload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}
