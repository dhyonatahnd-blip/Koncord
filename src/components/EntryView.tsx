import React, { useState } from 'react';
import {
  Camera,
  Clock,
  Globe,
  MonitorUp,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { LanguageCode } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { PRESET_AVATARS } from '../lib/avatars';
import { FIELD_LIMITS, fileToCompressedDataUrl } from '../lib/validation';
import { Avatar } from './Avatar';

interface EntryViewProps {
  initialInviteCode?: string;
  onEnter: (payload: {
    nickname: string;
    avatarDataUrl: string;
    inviteCode: string;
  }) => void;
  onOpenPrivacy: () => void;
}

const LANGUAGES: Array<{ code: LanguageCode; label: string; short: string }> = [
  { code: 'pt-BR', label: 'Português (BR)', short: 'PT' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ru', label: 'Русский', short: 'RU' },
];

function extractInviteCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/[?&]room=([A-Za-z0-9_-]+)/i);
  if (match && match[1]) return match[1].toUpperCase().slice(0, 16);
  return trimmed.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
}

export const EntryView: React.FC<EntryViewProps> = ({
  initialInviteCode = '',
  onEnter,
  onOpenPrivacy,
}) => {
  const { lang, setLang, t } = useI18n();
  const [nickname, setNickname] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState(PRESET_AVATARS[0].dataUrl);
  const [inviteInput, setInviteInput] = useState(initialInviteCode);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      const processed = await fileToCompressedDataUrl(file, FIELD_LIMITS.AVATAR_DATA_URL_MAX, 512);
      setAvatarDataUrl(processed.dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.tempFileOpenError);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nickname.trim();
    if (!cleanName) return;
    onEnter({
      nickname: cleanName.slice(0, FIELD_LIMITS.DISPLAY_NAME_MAX),
      avatarDataUrl,
      inviteCode: extractInviteCode(inviteInput),
    });
  };

  return (
    <div className="min-h-screen bg-[#07080B] text-zinc-100 relative overflow-y-auto flex items-center justify-center p-4 sm:p-8">
      {/* Subtle Blue & Violet Atmospheric Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-blue-600/14 blur-[140px]" />
        <div className="absolute -bottom-44 -right-24 w-[520px] h-[520px] rounded-full bg-violet-600/14 blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Brand & Value Overview */}
        <section className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-white/15">
              <span className="font-display font-bold text-lg tracking-tight text-white">Z</span>
            </div>
            <div>
              <div className="font-display font-bold text-xl tracking-tight text-white">
                {t.brandName}
              </div>
              <div className="text-xs text-zinc-400">{t.brandSubtitle}</div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-[1.15]">
              {t.entryHeadline}
            </h1>
            <p className="text-sm sm:text-[15px] text-zinc-400 leading-relaxed max-w-xl">
              {t.entryLead}
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.025] border border-white/8">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/25 text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-zinc-100">{t.entryFeature1Title}</h2>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t.entryFeature1Desc}</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.025] border border-white/8">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-400 flex items-center justify-center shrink-0">
                <MonitorUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-zinc-100">{t.entryFeature2Title}</h2>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t.entryFeature2Desc}</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.025] border border-white/8">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/25 text-sky-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-zinc-100">{t.entryFeature3Title}</h2>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t.entryFeature3Desc}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium underline underline-offset-4"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {t.readPrivacyPolicy}
            </button>
            <span aria-hidden="true">·</span>
            <span>{t.noAccountRequired}</span>
          </div>
        </section>

        {/* Registration-Free Entry Card */}
        <section className="lg:col-span-6">
          <div className="rounded-3xl border border-white/12 glass-elevated p-6 sm:p-8 shadow-2xl">
            {/* Language Selector */}
            <div className="flex items-center justify-between gap-3 pb-5 mb-5 border-b border-white/8">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>{t.languageLabel}</span>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/8">
                {LANGUAGES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLang(item.code)}
                    title={item.label}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      lang === item.code
                        ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {item.short}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nickname */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {t.nicknameLabel}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={FIELD_LIMITS.DISPLAY_NAME_MAX}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t.nicknamePlaceholder}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Avatar Upload + Preset Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-300">{t.avatarLabel}</label>
                </div>

                <div className="flex items-center gap-4 mb-3.5">
                  <Avatar
                    name={nickname || 'ZONE'}
                    src={avatarDataUrl}
                    size="lg"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white cursor-pointer transition-colors">
                      <Camera className="w-3.5 h-3.5 text-blue-400" />
                      {t.uploadPhoto}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {avatarDataUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarDataUrl('')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t.removePhoto}
                      </button>
                    )}
                  </div>
                </div>

                {uploadError && (
                  <p className="text-xs text-rose-400 mb-2">{uploadError}</p>
                )}

                <div className="text-[11px] text-zinc-500 mb-2">{t.presetAvatarsLabel}</div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_AVATARS.map((preset) => {
                    const selected = avatarDataUrl === preset.dataUrl;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAvatarDataUrl(preset.dataUrl)}
                        title={preset.label}
                        className={`aspect-square rounded-xl overflow-hidden border transition-all ${
                          selected
                            ? 'border-blue-400 ring-2 ring-blue-500/40 scale-105'
                            : 'border-white/10 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={preset.dataUrl}
                          alt={preset.label}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Room Invite Code */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {t.inviteOptionalLabel}
                </label>
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder={t.inviteOptionalPlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-white placeholder:text-zinc-500"
                />
              </div>

              <button
                type="submit"
                disabled={!nickname.trim()}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-45 text-white text-sm font-bold tracking-wide shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                {t.enterButton}
              </button>

              <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                {t.entryPrivacyNote}
              </p>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
