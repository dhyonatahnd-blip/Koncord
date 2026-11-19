import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  MonitorOff,
  MonitorUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export interface ScreenFeed {
  uid: string;
  displayName: string;
  stream: MediaStream;
  isLocal: boolean;
  hasSystemAudio?: boolean;
}

interface ScreenShareStageProps {
  feeds: ScreenFeed[];
  onStopLocalShare: () => void;
}

export const ScreenShareStage: React.FC<ScreenShareStageProps> = ({
  feeds,
  onStopLocalShare,
}) => {
  const { t } = useI18n();
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [idleHidden, setIdleHidden] = useState(false);
  const [viewerMuted, setViewerMuted] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  const activeFeed = feeds.find((f) => f.uid === selectedUid) || feeds[0] || null;

  useEffect(() => {
    if (activeFeed && videoRef.current) {
      if (videoRef.current.srcObject !== activeFeed.stream) {
        videoRef.current.srcObject = activeFeed.stream;
      }
      videoRef.current.muted = activeFeed.isLocal || viewerMuted;
      videoRef.current.play().catch(() => {});
    }
  }, [activeFeed, viewerMuted, isFullscreen]);

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

  return (
    <div
      ref={containerRef}
      onMouseMove={() => {
        if (isFullscreen) scheduleIdleHide();
      }}
      onClick={() => {
        if (isFullscreen && idleHidden) scheduleIdleHide();
      }}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none'
          : 'relative rounded-2xl border border-white/10 bg-[#0B0C10] overflow-hidden shadow-2xl flex flex-col'
      }
    >
      {/* Top Bar */}
      <div
        className={
          isFullscreen
            ? `absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl bg-black/65 backdrop-blur-xl border border-white/10 transition-opacity duration-200 ${
                showOverlayControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`
            : 'flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 bg-white/[0.02]'
        }
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
            <MonitorUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {activeFeed.isLocal ? t.localYou : activeFeed.displayName} · {t.liveScreenTitle}
            </div>
            <div className="text-xs text-zinc-400 truncate">
              {activeFeed.isLocal && activeFeed.hasSystemAudio
                ? t.withSystemAudio
                : t.escHint}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {feeds.length > 1 && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
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

          {!isFullscreen && (
            <button
              type="button"
              onClick={enterFullscreen}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/25 whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              {t.fullscreenBtn}
            </button>
          )}

          {activeFeed.isLocal && (
            <button
              type="button"
              onClick={onStopLocalShare}
              className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
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
            : 'relative w-full aspect-video max-h-[58vh] bg-black flex items-center justify-center'
        }
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="max-w-full max-h-full w-full h-full object-contain"
        />
      </div>

      {/* Discreet Fullscreen Floating Controls */}
      {isFullscreen && (
        <>
          <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/12 shadow-2xl transition-all duration-200 ${
              showOverlayControls
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-3 pointer-events-none'
            }`}
          >
            {!activeFeed.isLocal && (
              <button
                type="button"
                onClick={() => setViewerMuted((m) => !m)}
                className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {viewerMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                {viewerMuted ? t.unmuteMic : t.muteMic}
              </button>
            )}

            <button
              type="button"
              onClick={() => setControlsHidden(true)}
              className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <EyeOff className="w-4 h-4" />
              {t.hideControlsBtn}
            </button>

            {activeFeed.isLocal && (
              <button
                type="button"
                onClick={() => {
                  exitFullscreen();
                  onStopLocalShare();
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <MonitorOff className="w-4 h-4" />
                {t.stopShare}
              </button>
            )}

            <button
              type="button"
              onClick={exitFullscreen}
              className="px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Minimize2 className="w-4 h-4" />
              {t.exitFullscreenBtn} (ESC)
            </button>
          </div>

          {controlsHidden && (
            <button
              type="button"
              onClick={() => setControlsHidden(false)}
              title={t.showControlsBtn}
              className="fixed bottom-4 right-4 z-30 p-2.5 rounded-xl bg-black/50 hover:bg-black/80 border border-white/10 text-zinc-300 backdrop-blur-md transition-opacity opacity-50 hover:opacity-100"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
