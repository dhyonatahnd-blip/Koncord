import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Gamepad2,
  Maximize2,
  Minimize2,
  MonitorOff,
  MonitorUp,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ScreenShareMode } from '../hooks/useWebRTC';
import { useI18n } from '../i18n/I18nContext';

export interface ScreenFeed {
  uid: string;
  displayName: string;
  stream: MediaStream;
  audioStream?: MediaStream | null;
  isLocal: boolean;
  hasSystemAudio?: boolean;
  mode?: ScreenShareMode;
}

const RemoteScreenAudioPlayer: React.FC<{
  stream: MediaStream | null;
  volume: number;
  muted: boolean;
}> = ({ stream, volume, muted }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }

    // Disconnect previous Web Audio chain if stream changed
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceRef.current = null;
    }

    if (stream.getAudioTracks().length > 0 && typeof AudioContext !== 'undefined') {
      try {
        const ctx = ctxRef.current || new AudioContext();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        sourceRef.current = source;
        gainRef.current = gain;
      } catch {
        gainRef.current = null;
      }
    }

    el.play().catch(() => {});

    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // ignore
        }
        sourceRef.current = null;
      }
    };
  }, [stream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const effVol = muted ? 0 : Math.max(0, Math.min(2, volume));
    const ctx = ctxRef.current;

    if (ctx && ctx.state === 'suspended' && effVol > 0) {
      ctx.resume().catch(() => {});
    }

    if (ctx && ctx.state === 'running' && gainRef.current) {
      // Keep <audio muted> so Chrome decodes WebRTC stream while GainNode handles 0%-200%
      el.muted = true;
      gainRef.current.gain.value = effVol;
    } else {
      el.muted = effVol === 0;
      el.volume = Math.min(1, effVol);
    }
  }, [volume, muted, stream]);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  if (!stream) return null;
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

interface ScreenShareStageProps {
  feeds: ScreenFeed[];
  screenVolumes: Record<string, number>;
  screenMutedUids: Record<string, boolean>;
  localScreenAudioMuted: boolean;
  onSetScreenVolume: (uid: string, volume: number) => void;
  onToggleScreenMute: (uid: string) => void;
  onToggleLocalScreenAudioMute: () => void;
  onStopLocalShare: () => void;
}

export const ScreenShareStage: React.FC<ScreenShareStageProps> = ({
  feeds,
  screenVolumes,
  screenMutedUids,
  localScreenAudioMuted,
  onSetScreenVolume,
  onToggleScreenMute,
  onToggleLocalScreenAudioMute,
  onStopLocalShare,
}) => {
  const { t } = useI18n();
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [idleHidden, setIdleHidden] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  const activeFeed = feeds.find((f) => f.uid === selectedUid) || feeds[0] || null;

  useEffect(() => {
    if (activeFeed && videoRef.current) {
      if (videoRef.current.srcObject !== activeFeed.stream) {
        videoRef.current.srcObject = activeFeed.stream;
      }
      // Video element stays muted because RemoteScreenAudioPlayer handles 0%-200% audio & mute
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [activeFeed, isFullscreen]);

  const scheduleIdleHide = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    setIdleHidden(false);
    if (isFullscreen) {
      idleTimerRef.current = window.setTimeout(() => {
        setIdleHidden(true);
      }, 2800);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setIdleHidden(false);
      setControlsHidden(false);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      return;
    }
    scheduleIdleHide();
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [isFullscreen, scheduleIdleHide]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const nativeActive = Boolean(document.fullscreenElement);
      if (!nativeActive) {
        setIsFullscreen(false);
        setControlsHidden(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
        setControlsHidden(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const enterFullscreen = async () => {
    setIsFullscreen(true);
    setControlsHidden(false);
    const el = containerRef.current;
    if (el && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
      } catch {
        // Fallback: CSS fixed viewport fullscreen remains active
      }
    }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
    setIsFullscreen(false);
    setControlsHidden(false);
  };

  if (!activeFeed) return null;

  const showOverlayControls = !isFullscreen || (!controlsHidden && !idleHidden);
  const activeVolume = screenVolumes[activeFeed.uid] ?? 1;
  const activeMuted = Boolean(screenMutedUids[activeFeed.uid]) || activeVolume === 0;
  const activeVolumePct = activeMuted ? 0 : Math.round(activeVolume * 100);
  const activeRemoteAudioStream = !activeFeed.isLocal
    ? activeFeed.audioStream ||
      (activeFeed.stream.getAudioTracks().length > 0 ? activeFeed.stream : null)
    : null;

  const VolumeIcon = activeMuted ? VolumeX : activeVolume < 0.7 ? Volume1 : Volume2;

  const renderAudioControls = (compact = false) => {
    if (activeFeed.isLocal) {
      if (!activeFeed.hasSystemAudio) {
        return (
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-400/20 text-[11px] text-amber-300 whitespace-nowrap">
            {t.noSystemAudioBadge}
          </span>
        );
      }
      return (
        <button
          type="button"
          onClick={onToggleLocalScreenAudioMute}
          title={localScreenAudioMuted ? t.unmuteOutgoingScreenAudio : t.muteOutgoingScreenAudio}
          className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
            localScreenAudioMuted
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
              : 'bg-white/8 border-white/10 text-zinc-200 hover:bg-white/14'
          }`}
        >
          {localScreenAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{localScreenAudioMuted ? t.unmuteOutgoingScreenAudio : t.muteOutgoingScreenAudio}</span>
        </button>
      );
    }

    return (
      <div
        className={`flex items-center gap-1.5 sm:gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2 sm:px-2.5 py-1 min-h-[38px] shrink-0 ${
          compact ? '' : 'backdrop-blur-md'
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleScreenMute(activeFeed.uid)}
          title={activeMuted ? t.unmuteStreamBtn : t.muteStreamBtn}
          aria-label={activeMuted ? t.unmuteStreamBtn : t.muteStreamBtn}
          className={`min-h-[32px] min-w-[32px] rounded-lg transition-colors flex items-center justify-center ${
            activeMuted
              ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25'
              : 'text-zinc-200 hover:bg-white/10'
          }`}
        >
          <VolumeIcon className="w-4 h-4" />
        </button>
        <input
          type="range"
          min={0}
          max={200}
          step={5}
          value={activeVolumePct}
          onChange={(e) => onSetScreenVolume(activeFeed.uid, Number(e.target.value) / 100)}
          aria-label={t.screenVolumeLabel}
          title={`${t.screenVolumeLabel}: ${activeVolumePct}%`}
          className="w-16 sm:w-24 accent-blue-500 cursor-pointer"
        />
        <span className="text-[11px] font-mono tabular-nums text-zinc-300 w-9 text-right">
          {activeVolumePct}%
        </span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={() => {
        if (isFullscreen) scheduleIdleHide();
      }}
      onTouchStart={() => {
        if (isFullscreen) scheduleIdleHide();
      }}
      onPointerDown={() => {
        if (isFullscreen) scheduleIdleHide();
      }}
      onClick={() => {
        if (isFullscreen && idleHidden) scheduleIdleHide();
      }}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 h-[100dvh] w-[100dvw] bg-black flex flex-col items-center justify-center select-none'
          : 'relative rounded-2xl border border-white/10 bg-[#0B0C10] overflow-hidden shadow-2xl flex flex-col'
      }
    >
      <RemoteScreenAudioPlayer
        stream={activeRemoteAudioStream}
        volume={activeVolume}
        muted={activeMuted}
      />

      {/* Top Bar */}
      <div
        className={
          isFullscreen
            ? `absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-black/65 backdrop-blur-xl border border-white/10 transition-opacity duration-200 ${
                showOverlayControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`
            : 'flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/8 bg-white/[0.02]'
        }
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              activeFeed.mode === 'game'
                ? 'bg-violet-500/15 border-violet-400/30 text-violet-300'
                : 'bg-sky-500/15 border-sky-400/30 text-sky-400'
            }`}
          >
            {activeFeed.mode === 'game' ? (
              <Gamepad2 className="w-4 h-4" />
            ) : (
              <MonitorUp className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-white truncate">
                {activeFeed.isLocal ? t.localYou : activeFeed.displayName} · {t.liveScreenTitle}
              </span>
              {activeFeed.mode === 'game' && (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/30 text-[10px] font-semibold text-violet-200 whitespace-nowrap">
                  {t.gameModeBadge}
                </span>
              )}
            </div>
            <div className="text-[11px] sm:text-xs text-zinc-400 truncate">
              {activeFeed.isLocal && activeFeed.hasSystemAudio
                ? localScreenAudioMuted
                  ? t.screenAudioMutedBadge
                  : t.withSystemAudio
                : t.escHint}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
          {feeds.length > 1 && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 overflow-x-auto no-scrollbar max-w-full">
              {feeds.map((feed) => (
                <button
                  key={feed.uid}
                  type="button"
                  onClick={() => setSelectedUid(feed.uid)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                    feed.uid === activeFeed.uid
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {feed.isLocal ? t.localYou : feed.displayName}
                </button>
              ))}
            </div>
          )}

          {!isFullscreen && renderAudioControls(false)}

          {!isFullscreen && (
            <button
              type="button"
              onClick={enterFullscreen}
              className="min-h-[38px] px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold tracking-wide flex items-center gap-1.5 sm:gap-2 transition-colors shadow-lg shadow-blue-500/25 whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              {t.fullscreenBtn}
            </button>
          )}

          {activeFeed.isLocal && (
            <button
              type="button"
              onClick={onStopLocalShare}
              className="min-h-[38px] px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <MonitorOff className="w-3.5 h-3.5" />
              {t.stopShare}
            </button>
          )}
        </div>
      </div>

      {/* Video Stage — Preserves Original Aspect Ratio */}
      <div
        className={
          isFullscreen
            ? 'w-full h-full flex items-center justify-center p-2 sm:p-4 bg-black'
            : 'relative w-full aspect-video max-h-[42vh] sm:max-h-[58vh] bg-black flex items-center justify-center'
        }
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="max-w-full max-h-full w-full h-full object-contain"
        />
      </div>

      {/* Discreet Fullscreen Floating Controls */}
      {isFullscreen && (
        <>
          <div
            className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/12 shadow-2xl transition-all duration-200 max-w-[calc(100vw-1.5rem)] ${
              showOverlayControls
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-3 pointer-events-none'
            }`}
          >
            {renderAudioControls(true)}

            <button
              type="button"
              onClick={() => setControlsHidden(true)}
              className="min-h-[38px] px-3 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <EyeOff className="w-4 h-4" />
              <span className="hidden sm:inline">{t.hideControlsBtn}</span>
            </button>

            {activeFeed.isLocal && (
              <button
                type="button"
                onClick={() => {
                  exitFullscreen();
                  onStopLocalShare();
                }}
                className="min-h-[38px] px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <MonitorOff className="w-4 h-4" />
                <span>{t.stopShare}</span>
              </button>
            )}

            <button
              type="button"
              onClick={exitFullscreen}
              className="min-h-[38px] px-3.5 sm:px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Minimize2 className="w-4 h-4" />
              <span>{t.exitFullscreenBtn}</span>
              <span className="hidden sm:inline">(ESC)</span>
            </button>
          </div>

          {controlsHidden && (
            <button
              type="button"
              onClick={() => setControlsHidden(false)}
              title={t.showControlsBtn}
              className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-black/50 hover:bg-black/80 border border-white/10 text-zinc-300 backdrop-blur-md transition-opacity opacity-65 hover:opacity-100 flex items-center justify-center"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
