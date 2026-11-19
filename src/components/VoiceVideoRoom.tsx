import React, { useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  ExternalLink,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChannelDoc, UserPublic, VoicePeer } from '../types';
import { RemoteMediaStreams } from '../hooks/useWebRTC';
import { useI18n } from '../i18n/I18nContext';
import { Avatar } from './Avatar';
import { ScreenFeed, ScreenShareStage } from './ScreenShareStage';

const RemoteAudioPlayer: React.FC<{ stream: MediaStream | null; volume: number }> = ({
  stream,
  volume,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  if (!stream) return null;
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

const VideoSurface: React.FC<{
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
}> = ({ stream, muted = false, mirrored = false }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && stream) {
      if (ref.current.srcObject !== stream) {
        ref.current.srcObject = stream;
      }
      ref.current.play().catch(() => {});
    }
  }, [stream]);

  if (!stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
    />
  );
};

interface VoiceVideoRoomProps {
  channel: ChannelDoc;
  currentUser: UserPublic;
  isJoined: boolean;
  livekitActive?: boolean;
  peers: Record<string, VoicePeer>;
  rosterPeers: VoicePeer[];
  remoteMedia: Record<string, RemoteMediaStreams>;
  peerVolumes: Record<string, number>;
  speakingUids: Record<string, boolean>;
  micMuted: boolean;
  camEnabled: boolean;
  screenSharing: boolean;
  screenHasSystemAudio: boolean;
  mediaError: string | null;
  screenShareBlockedByIframe: boolean;
  localCamStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onSetPeerVolume: (uid: string, vol: number) => void;
  onClearError: () => void;
}

export const VoiceVideoRoom: React.FC<VoiceVideoRoomProps> = ({
  channel,
  currentUser,
  isJoined,
  livekitActive = false,
  peers,
  rosterPeers,
  remoteMedia,
  peerVolumes,
  speakingUids,
  micMuted,
  camEnabled,
  screenSharing,
  screenHasSystemAudio,
  mediaError,
  screenShareBlockedByIframe,
  localCamStream,
  localScreenStream,
  onJoin,
  onLeave,
  onToggleMic,
  onToggleCam,
  onStartScreenShare,
  onStopScreenShare,
  onSetPeerVolume,
  onClearError,
}) => {
  const { t } = useI18n();

  const screenFeeds: ScreenFeed[] = [];
  if (screenSharing && localScreenStream) {
    screenFeeds.push({
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      stream: localScreenStream,
      isLocal: true,
      hasSystemAudio: screenHasSystemAudio,
    });
  }
  for (const [peerUid, media] of Object.entries(remoteMedia)) {
    if (media.screenStream) {
      const peerInfo = peers[peerUid];
      screenFeeds.push({
        uid: peerUid,
        displayName: peerInfo?.displayName || t.memberRole,
        stream: media.screenStream,
        isLocal: false,
      });
    }
  }

  const peerList = Object.values(peers);

  if (!isJoined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md w-full rounded-2xl border border-white/10 glass-elevated p-8 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400 mx-auto mb-5">
            {channel.type === 'video' ? <Camera className="w-7 h-7" /> : <Volume2 className="w-7 h-7" />}
          </div>
          <h2 className="font-display text-xl font-semibold text-white mb-2">{channel.name}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            {channel.topic || (channel.type === 'video' ? t.videoRoomTitle : t.voiceRoomTitle)}
          </p>

          {rosterPeers.length > 0 && (
            <div className="mb-6 rounded-xl bg-white/[0.03] border border-white/8 p-3.5 text-left">
              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2.5">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {rosterPeers.length} {t.participantsInRoom}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rosterPeers.map((p) => (
                  <div
                    key={p.uid}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/8 text-xs text-zinc-200"
                  >
                    <Avatar name={p.displayName} src={p.avatarDataUrl} size="xs" />
                    <span className="truncate max-w-[120px]">{p.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onJoin}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/25"
            >
              {t.joinRoomBtn}
            </button>
            <button
              type="button"
              onClick={onStartScreenShare}
              className="w-full py-2.5 px-5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-zinc-100 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <MonitorUp className="w-4 h-4 text-sky-400" />
              {t.joinAndShareBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0A0B0E]">
      {peerList.map((peer) => (
        <RemoteAudioPlayer
          key={`audio-${peer.uid}`}
          stream={remoteMedia[peer.uid]?.audioStream || null}
          volume={peerVolumes[peer.uid] ?? 1}
        />
      ))}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {mediaError && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <span className="flex-1 min-w-[220px]">{mediaError}</span>
            <div className="flex items-center gap-2 shrink-0">
              {screenShareBlockedByIframe && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-semibold flex items-center gap-1.5 hover:bg-amber-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t.openInNewTab}
                </a>
              )}
              <button
                type="button"
                onClick={onClearError}
                className="text-amber-300 hover:text-white font-medium shrink-0 px-2 py-1"
              >
                {t.closeBtn}
              </button>
            </div>
          </div>
        )}

        {screenFeeds.length > 0 && (
          <ScreenShareStage feeds={screenFeeds} onStopLocalShare={onStopScreenShare} />
        )}

        <div
          className={`grid gap-4 ${
            peerList.length === 0
              ? 'grid-cols-1 max-w-xl mx-auto'
              : peerList.length === 1
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {/* Local Card */}
          <div
            className={`relative rounded-2xl border bg-[#12141A] overflow-hidden aspect-video flex flex-col items-center justify-center transition-all ${
              speakingUids[currentUser.uid]
                ? 'border-emerald-400/70 shadow-[0_0_0_1px_rgba(52,211,153,0.4)]'
                : 'border-white/8'
            }`}
          >
            {camEnabled && localCamStream ? (
              <VideoSurface stream={localCamStream} muted mirrored />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Avatar
                  name={currentUser.displayName}
                  src={currentUser.avatarDataUrl}
                  size="xl"
                  speaking={Boolean(speakingUids[currentUser.uid])}
                />
                <span className="text-xs text-zinc-400">
                  {micMuted ? t.micOff : speakingUids[currentUser.uid] ? t.speakingNow : t.connectedInRoom}
                </span>
              </div>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-black/55 backdrop-blur-md border border-white/10">
              <span className="text-xs font-medium text-white truncate">
                {currentUser.displayName} ({t.localYou})
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {micMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Mic
                    className={`w-3.5 h-3.5 ${
                      speakingUids[currentUser.uid] ? 'text-emerald-400' : 'text-zinc-300'
                    }`}
                  />
                )}
                {!camEnabled && <CameraOff className="w-3.5 h-3.5 text-zinc-500" />}
              </div>
            </div>
          </div>

          {/* Remote Participants */}
          {peerList.map((peer) => {
            const media = remoteMedia[peer.uid];
            const vol = peerVolumes[peer.uid] ?? 1;
            const isSpeaking = Boolean(speakingUids[peer.uid] || peer.speaking);
            return (
              <div
                key={peer.uid}
                className={`relative rounded-2xl border bg-[#12141A] overflow-hidden aspect-video flex flex-col items-center justify-center transition-all ${
                  isSpeaking
                    ? 'border-emerald-400/70 shadow-[0_0_0_1px_rgba(52,211,153,0.4)]'
                    : 'border-white/8'
                }`}
              >
                {peer.camEnabled && media?.camStream ? (
                  <VideoSurface stream={media.camStream} muted />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Avatar
                      name={peer.displayName}
                      src={peer.avatarDataUrl}
                      size="xl"
                      speaking={isSpeaking}
                    />
                    <span className="text-xs text-zinc-400">
                      {peer.micMuted ? t.micOff : isSpeaking ? t.speakingNow : t.connectedInRoom}
                    </span>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                  <span className="text-xs font-medium text-white truncate">{peer.displayName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSetPeerVolume(peer.uid, vol === 0 ? 1 : 0)}
                      title={vol === 0 ? t.unmuteMic : t.muteMic}
                      className="text-zinc-300 hover:text-white"
                    >
                      {vol === 0 ? (
                        <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(vol * 100)}
                      onChange={(e) => onSetPeerVolume(peer.uid, Number(e.target.value) / 100)}
                      title={`${t.participantVolume}: ${Math.round(vol * 100)}%`}
                      className="w-16 accent-blue-500 cursor-pointer"
                    />
                    {peer.micMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Glassmorphic Media Controls Bar */}
      <div className="px-4 py-3.5 border-t border-white/8 bg-[#111217]/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-zinc-200 font-medium">{channel.name}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {peerList.length + 1} {t.participantsInRoom}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-zinc-500">{livekitActive ? t.livekitActive : t.webrtcDirect}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleMic}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              micMuted
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                : 'bg-white/8 border border-white/10 text-zinc-100 hover:bg-white/14'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {micMuted ? t.unmuteMic : t.muteMic}
          </button>

          <button
            type="button"
            onClick={onToggleCam}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              camEnabled
                ? 'bg-blue-500/20 border border-blue-400/35 text-blue-200 hover:bg-blue-500/30'
                : 'bg-white/8 border border-white/10 text-zinc-100 hover:bg-white/14'
            }`}
          >
            {camEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
            {camEnabled ? t.camOff : t.camOn}
          </button>

          <button
            type="button"
            onClick={screenSharing ? onStopScreenShare : onStartScreenShare}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
              screenSharing
                ? 'bg-sky-500 text-zinc-950 hover:bg-sky-400 shadow-lg shadow-sky-500/20'
                : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {screenSharing ? <MonitorOff className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
            {screenSharing ? t.stopShare : t.shareScreen}
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <PhoneOff className="w-4 h-4" />
            {t.leaveCall}
          </button>
        </div>
      </div>
    </div>
  );
};
