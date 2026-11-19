// Validation constants synchronized verbatim with firebase-blueprint.json

export const FIELD_LIMITS = {
  ID_MAX: 128,
  LONG_ID_MAX: 260,
  DISPLAY_NAME_MAX: 48,
  USERNAME_MAX: 32,
  BIO_MAX: 240,
  CUSTOM_STATUS_MAX: 80,
  AVATAR_DATA_URL_MAX: 200000,
  EMAIL_MAX: 160,
  BLOCKED_UIDS_MAX: 100,
  SERVER_NAME_MAX: 64,
  SERVER_DESC_MAX: 240,
  INVITE_CODE_MAX: 24,
  CATEGORY_NAME_MAX: 40,
  CHANNEL_NAME_MAX: 48,
  CHANNEL_TOPIC_MAX: 160,
  MESSAGE_CONTENT_MAX: 4000,
  ATTACHMENT_NAME_MAX: 140,
  ATTACHMENT_TYPE_MAX: 80,
  ATTACHMENT_DATA_URL_MAX: 450000,
  REPLY_SNIPPET_MAX: 160,
  EMOJI_MAX: 16,
  NOTIFICATION_TITLE_MAX: 120,
  NOTIFICATION_BODY_MAX: 240,
} as const;

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, FIELD_LIMITS.ID_MAX);
}

export function generateSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return sanitizeId(`${prefix}_${ts}_${rand}`);
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, FIELD_LIMITS.USERNAME_MAX);
  return cleaned.length >= 2 ? cleaned : `user_${Math.random().toString(36).slice(2, 6)}`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'VS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function pairId(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export function encodeEmojiId(emoji: string): string {
  return Array.from(emoji)
    .map((ch) => ch.codePointAt(0)?.toString(16) || '0')
    .join('-');
}

export async function fileToCompressedDataUrl(
  file: File,
  maxBytes: number,
  maxDimension = 1280
): Promise<{ name: string; type: string; dataUrl: string }> {
  const safeName = clampString(file.name || 'arquivo', FIELD_LIMITS.ATTACHMENT_NAME_MAX);
  const safeType = clampString(file.type || 'application/octet-stream', FIELD_LIMITS.ATTACHMENT_TYPE_MAX);

  if (file.type.startsWith('image/')) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = String(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const canvas = document.createElement('canvas');
    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.82;
      let dataUrl = canvas.toDataURL('image/webp', quality);
      while (dataUrl.length > maxBytes && quality > 0.3) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL('image/webp', quality);
      }
      if (dataUrl.length <= maxBytes) {
        return { name: safeName, type: 'image/webp', dataUrl };
      }
    }
  }

  // Generic non-image file up to maxBytes raw base64 length
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (dataUrl.length > maxBytes) {
    throw new Error(
      `O arquivo excede o limite permitido (${Math.round((maxBytes * 0.75) / 1024)} KB). Escolha um arquivo menor.`
    );
  }

  return { name: safeName, type: safeType, dataUrl };
}
