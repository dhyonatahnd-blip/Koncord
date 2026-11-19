import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastAlert, VoicePeer } from '../types';
import { SignalListener } from './useWebSocketSignaling';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

interface PeerConnectionBundle {
  pc: RTCPeerConnection;
  camStreamId: string | null;
  screenStreamId: string | null;
}

export interface RemoteMediaStreams {
  camStream: MediaStream | null;
  screenStream: MediaStream | null;
  audioStream: MediaStream | null;
}

export function useWebRTC(params: {
  uid: string | null;
  displayName: string;
  avatarDataUrl: string;
  sendSignal: (payload: Record<string, unknown>) => boolean;
  subscribeSignal: (listener: SignalListener) => () => void;
  onAlert?: (alert: Omit<ToastAlert, 'id' | 'createdAt'>) => void;
}) {
  const { uid, displayName, avatarDataUrl, sendSignal, subscribeSignal, onAlert } = params;

  const [activeRoom, setActiveRoom] = useState<{
    serverId: string;
    channelId: string;
    channelName: string;
    channelType: 'voice' | 'video';
  } | null>(null);

  const [peers, setPeers] = useState<Record<string, VoicePeer>>({});
  const [remoteMedia, setRemoteMedia] = useState<Record<string, RemoteMediaStreams>>({});
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [speakingUids, setSpeakingUids] = useState<Record<string, boolean>>({});

  const [micMuted, setMicMuted] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenHasSystemAudio, setScreenHasSystemAudio] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [screenShareBlockedByIframe, setScreenShareBlockedByIframe] = useState(false);

  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerBundlesRef = useRef<Map<string, PeerConnectionBundle>>(new Map());
  const activeRoomRef = useRef(activeRoom);
  activeRoomRef.current = activeRoom;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>>(
    new Map()
  );
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const attachLocalAndRemoteTracks = useCallback((pc: RTCPeerConnection) => {
    const existingSenders = pc.getSenders();
    const attachedTrackIds = new Set(existingSenders.map((s) => s.track?.id).filter(Boolean));

    const streams: (MediaStream | null)[] = [
      micStreamRef.current,
      camStreamRef.current,
      screenStreamRef.current,
    ];
    for (const stream of streams) {
      if (!stream) continue;
      for (const track of stream.getTracks()) {
        if (!attachedTrackIds.has(track.id)) {
          pc.addTrack(track, stream);
        }
      }
    }
  }, []);

  const monitorAudioLevel = useCallback((targetUid: string, stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const prev = analysersRef.current.get(targetUid);
      if (prev) {
        try {
          prev.source.disconnect();
        } catch {
          // ignore
        }
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analysersRef.current.set(targetUid, { analyser, source });
    } catch {
      // Ignore AudioContext blocks in restricted browsers
    }
  }, []);

  // Poll speaking levels gently
  useEffect(() => {
    if (!activeRoom) return;
    const data = new Uint8Array(128);
    const interval = window.setInterval(() => {
      const nextSpeaking: Record<string, boolean> = {};
      for (const [targetUid, { analyser }] of analysersRef.current) {
        if (targetUid === uid && micMuted) {
          nextSpeaking[targetUid] = false;
          continue;
        }
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        nextSpeaking[targetUid] = avg > 14;
      }
      setSpeakingUids((prev) => {
        const changed =
          Object.keys(nextSpeaking).some((k) => prev[k] !== nextSpeaking[k]) ||
          Object.keys(prev).some((k) => prev[k] !== nextSpeaking[k]);
        return changed ? nextSpeaking : prev;
      });
    }, 180);
    return () => window.clearInterval(interval);
  }, [activeRoom, uid, micMuted]);

  const sendOfferToPeer = useCallback(
    async (targetUid: string, bundle: PeerConnectionBundle, channelId: string) => {
      try {
        attachLocalAndRemoteTracks(bundle.pc);
        const offer = await bundle.pc.createOffer();
        await bundle.pc.setLocalDescription(offer);
        sendSignal({
          type: 'rtc:offer',
          targetUid,
          channelId,
          sdp: {
            description: offer,
            camStreamId: camStreamRef.current?.id || null,
            screenStreamId: screenStreamRef.current?.id || null,
          },
        });
      } catch (err) {
        console.error('Failed creating WebRTC offer:', err);
      }
    },
    [attachLocalAndRemoteTracks, sendSignal]
  );

  const createPeerConnection = useCallback(
    (targetUid: string, channelId: string): PeerConnectionBundle => {
      const existing = peerBundlesRef.current.get(targetUid);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      const bundle: PeerConnectionBundle = {
        pc,
        camStreamId: null,
        screenStreamId: null,
      };
      peerBundlesRef.current.set(targetUid, bundle);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: 'rtc:ice-candidate',
            targetUid,
            channelId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const incomingStream = event.streams[0];
        if (!incomingStream) return;

        if (event.track.kind === 'audio') {
          monitorAudioLevel(targetUid, incomingStream);
          setRemoteMedia((prev) => ({
            ...prev,
            [targetUid]: {
              camStream: prev[targetUid]?.camStream || null,
              screenStream: prev[targetUid]?.screenStream || null,
              audioStream: incomingStream,
            },
          }));
          return;
        }

        if (event.track.kind === 'video') {
          const isScreen =
            bundle.screenStreamId === incomingStream.id ||
            event.track.label.toLowerCase().includes('screen') ||
            event.track.label.toLowerCase().includes('window') ||
            event.track.label.toLowerCase().includes('tab') ||
            event.track.label.toLowerCase().includes('monitor');

          setRemoteMedia((prev) => ({
            ...prev,
            [targetUid]: {
              camStream: isScreen ? prev[targetUid]?.camStream || null : incomingStream,
              screenStream: isScreen ? incomingStream : prev[targetUid]?.screenStream || null,
              audioStream: prev[targetUid]?.audioStream || null,
            },
          }));

          event.track.onended = () => {
            setRemoteMedia((prev) => {
              const cur = prev[targetUid];
              if (!cur) return prev;
              return {
                ...prev,
                [targetUid]: {
                  ...cur,
                  screenStream: cur.screenStream?.id === incomingStream.id ? null : cur.screenStream,
                  camStream: cur.camStream?.id === incomingStream.id ? null : cur.camStream,
                },
              };
            });
          };
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          // Clean up stale streams if peer dropped
          if (pc.connectionState === 'closed') {
            peerBundlesRef.current.delete(targetUid);
          }
        }
      };

      return bundle;
    },
    [monitorAudioLevel, sendSignal]
  );

  const renegotiateAllPeers = useCallback(async () => {
    const room = activeRoomRef.current;
    if (!room) return;
    for (const [targetUid, bundle] of peerBundlesRef.current) {
      await sendOfferToPeer(targetUid, bundle, room.channelId);
    }
  }, [sendOfferToPeer]);

  // Listen to WebRTC signaling messages from WebSocket
  useEffect(() => {
    if (!uid) return;
    return subscribeSignal(async (msg) => {
      const type = msg.type as string;
      const room = activeRoomRef.current;
      if (!room) return;

      if (type === 'room:snapshot' && msg.channelId === room.channelId) {
        const incomingPeers = (msg.peers as VoicePeer[]) || [];
        const map: Record<string, VoicePeer> = {};
        for (const p of incomingPeers) {
          map[p.uid] = p;
          const bundle = createPeerConnection(p.uid, room.channelId);
          await sendOfferToPeer(p.uid, bundle, room.channelId);
        }
        setPeers(map);
      } else if (type === 'room:peer-joined' && msg.channelId === room.channelId) {
        const peer = msg.peer as VoicePeer;
        if (peer && peer.uid !== uid) {
          setPeers((prev) => ({ ...prev, [peer.uid]: peer }));
          createPeerConnection(peer.uid, room.channelId);
        }
      } else if (type === 'room:peer-left' && msg.channelId === room.channelId) {
        const leftUid = String(msg.uid || '');
        if (!leftUid) return;
        const bundle = peerBundlesRef.current.get(leftUid);
        if (bundle) {
          bundle.pc.close();
          peerBundlesRef.current.delete(leftUid);
        }
        analysersRef.current.delete(leftUid);
        setPeers((prev) => {
          const next = { ...prev };
          delete next[leftUid];
          return next;
        });
        setRemoteMedia((prev) => {
          const next = { ...prev };
          delete next[leftUid];
          return next;
        });
      } else if (type === 'room:peer-state' && msg.channelId === room.channelId) {
        const targetUid = String(msg.uid || '');
        if (!targetUid) return;
        const nextScreenSharing = Boolean(msg.screenSharing);
        setPeers((prev) => {
          const existing = prev[targetUid];
          if (!existing) return prev;
          return {
            ...prev,
            [targetUid]: {
              ...existing,
              micMuted: Boolean(msg.micMuted),
              camEnabled: Boolean(msg.camEnabled),
              screenSharing: nextScreenSharing,
              speaking: Boolean(msg.speaking),
            },
          };
        });
        if (!nextScreenSharing) {
          setRemoteMedia((prev) => {
            const cur = prev[targetUid];
            if (!cur) return prev;
            return { ...prev, [targetUid]: { ...cur, screenStream: null } };
          });
        }
      } else if (type === 'rtc:offer' && msg.channelId === room.channelId) {
        const fromUid = String(msg.fromUid || '');
        const sdpPayload = msg.sdp as {
          description: RTCSessionDescriptionInit;
          camStreamId: string | null;
          screenStreamId: string | null;
        };
        if (!fromUid || !sdpPayload?.description) return;
        const bundle = createPeerConnection(fromUid, room.channelId);
        bundle.camStreamId = sdpPayload.camStreamId;
        bundle.screenStreamId = sdpPayload.screenStreamId;

        try {
          await bundle.pc.setRemoteDescription(new RTCSessionDescription(sdpPayload.description));
          attachLocalAndRemoteTracks(bundle.pc);
          const answer = await bundle.pc.createAnswer();
          await bundle.pc.setLocalDescription(answer);
          sendSignal({
            type: 'rtc:answer',
            targetUid: fromUid,
            channelId: room.channelId,
            sdp: {
              description: answer,
              camStreamId: camStreamRef.current?.id || null,
              screenStreamId: screenStreamRef.current?.id || null,
            },
          });
        } catch (err) {
          console.error('Failed handling rtc:offer:', err);
        }
      } else if (type === 'rtc:answer' && msg.channelId === room.channelId) {
        const fromUid = String(msg.fromUid || '');
        const sdpPayload = msg.sdp as {
          description: RTCSessionDescriptionInit;
          camStreamId: string | null;
          screenStreamId: string | null;
        };
        const bundle = peerBundlesRef.current.get(fromUid);
        if (!bundle || !sdpPayload?.description) return;
        bundle.camStreamId = sdpPayload.camStreamId;
        bundle.screenStreamId = sdpPayload.screenStreamId;
        try {
          await bundle.pc.setRemoteDescription(new RTCSessionDescription(sdpPayload.description));
        } catch (err) {
          console.error('Failed handling rtc:answer:', err);
        }
      } else if (type === 'rtc:ice-candidate' && msg.channelId === room.channelId) {
        const fromUid = String(msg.fromUid || '');
        const candidate = msg.candidate as RTCIceCandidateInit;
        const bundle = peerBundlesRef.current.get(fromUid);
        if (bundle && candidate) {
          try {
            await bundle.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // ignore race candidates
          }
        }
      }
    });
  }, [uid, subscribeSignal, createPeerConnection, sendOfferToPeer, attachLocalAndRemoteTracks, sendSignal]);

  const stopStream = (stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
  };

  const leaveRoom = useCallback(() => {
    if (!activeRoomRef.current) return;
    sendSignal({ type: 'room:leave' });
    for (const bundle of peerBundlesRef.current.values()) {
      bundle.pc.close();
    }
    peerBundlesRef.current.clear();
    analysersRef.current.clear();

    stopStream(micStreamRef.current);
    stopStream(camStreamRef.current);
    stopStream(screenStreamRef.current);
    micStreamRef.current = null;
    camStreamRef.current = null;
    screenStreamRef.current = null;

    setLocalCamStream(null);
    setLocalScreenStream(null);
    setScreenSharing(false);
    setScreenHasSystemAudio(false);
    setCamEnabled(false);
    setMicMuted(false);
    setPeers({});
    setRemoteMedia({});
    setActiveRoom(null);
    setMediaError(null);
  }, [sendSignal]);

  const joinRoom = useCallback(
    async (room: {
      serverId: string;
      channelId: string;
      channelName: string;
      channelType: 'voice' | 'video';
    }) => {
      if (activeRoomRef.current?.channelId === room.channelId) return;
      if (activeRoomRef.current) {
        leaveRoom();
      }
      setMediaError(null);

      let micMutedInitial = false;
      let camEnabledInitial = false;

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStreamRef.current = audioStream;
        if (uid) monitorAudioLevel(uid, audioStream);
      } catch (err) {
        micMutedInitial = true;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError') {
          setMediaError('Microfone bloqueado pelas permissões do navegador. Você entrou em modo ouvinte.');
        } else {
          setMediaError('Microfone indisponível neste dispositivo. Você entrou em modo ouvinte.');
        }
      }

      if (room.channelType === 'video') {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          camStreamRef.current = videoStream;
          setLocalCamStream(videoStream);
          camEnabledInitial = true;
        } catch {
          camEnabledInitial = false;
        }
      }

      setMicMuted(micMutedInitial);
      setCamEnabled(camEnabledInitial);
      setActiveRoom(room);

      sendSignal({
        type: 'room:join',
        serverId: room.serverId,
        channelId: room.channelId,
        channelName: room.channelName,
        displayName,
        avatarDataUrl,
        micMuted: micMutedInitial,
        camEnabled: camEnabledInitial,
        screenSharing: Boolean(screenStreamRef.current),
      });
    },
    [uid, displayName, avatarDataUrl, leaveRoom, monitorAudioLevel, sendSignal]
  );

  const toggleMic = useCallback(async () => {
    if (!activeRoomRef.current) return;
    if (!micStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        if (uid) monitorAudioLevel(uid, stream);
        setMicMuted(false);
        setMediaError(null);
        await renegotiateAllPeers();
        sendSignal({ type: 'room:state', micMuted: false });
      } catch {
        setMediaError('Permita o acesso ao microfone nas configurações do navegador.');
      }
      return;
    }

    const nextMuted = !micMuted;
    micStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
    setMicMuted(nextMuted);
    sendSignal({ type: 'room:state', micMuted: nextMuted });
  }, [micMuted, uid, monitorAudioLevel, renegotiateAllPeers, sendSignal]);

  const toggleCamera = useCallback(async () => {
    if (!activeRoomRef.current) return;
    if (camEnabled && camStreamRef.current) {
      for (const bundle of peerBundlesRef.current.values()) {
        for (const sender of bundle.pc.getSenders()) {
          if (sender.track && camStreamRef.current.getTracks().some((t) => t.id === sender.track?.id)) {
            bundle.pc.removeTrack(sender);
          }
        }
      }
      stopStream(camStreamRef.current);
      camStreamRef.current = null;
      setLocalCamStream(null);
      setCamEnabled(false);
      await renegotiateAllPeers();
      sendSignal({ type: 'room:state', camEnabled: false });
      return;
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      camStreamRef.current = videoStream;
      setLocalCamStream(videoStream);
      setCamEnabled(true);
      setMediaError(null);
      await renegotiateAllPeers();
      sendSignal({ type: 'room:state', camEnabled: true });
    } catch {
      setMediaError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  }, [camEnabled, renegotiateAllPeers, sendSignal]);

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) {
      setScreenSharing(false);
      setScreenHasSystemAudio(false);
      setLocalScreenStream(null);
      return;
    }

    for (const bundle of peerBundlesRef.current.values()) {
      for (const sender of bundle.pc.getSenders()) {
        if (sender.track && screenStreamRef.current.getTracks().some((t) => t.id === sender.track?.id)) {
          bundle.pc.removeTrack(sender);
        }
      }
    }

    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setLocalScreenStream(null);
    setScreenSharing(false);
    setScreenHasSystemAudio(false);

    if (activeRoomRef.current) {
      await renegotiateAllPeers();
      sendSignal({ type: 'room:state', screenSharing: false });
    }
  }, [renegotiateAllPeers, sendSignal]);

  const startScreenShare = useCallback(
    async (autoJoinRoom?: {
      serverId: string;
      channelId: string;
      channelName: string;
      channelType: 'voice' | 'video';
    }) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setMediaError(
          'Seu navegador atual não disponibiliza a API getDisplayMedia. Use Chrome, Edge, Firefox ou Safari atualizado.'
        );
        return false;
      }

      setMediaError(null);
      setScreenShareBlockedByIframe(false);

      let displayStream: MediaStream | null = null;
      try {
        // Call getDisplayMedia synchronously first to preserve user-gesture token (critical for Safari/Firefox in Europe)
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });
      } catch (firstErr) {
        const firstName = firstErr instanceof DOMException ? firstErr.name : '';
        const firstMsg = firstErr instanceof Error ? firstErr.message.toLowerCase() : '';

        // Retry without audio/strict video constraints for browsers/OS (macOS Safari, Firefox) that reject system audio capture
        if (
          firstName === 'OverconstrainedError' ||
          firstName === 'NotSupportedError' ||
          firstName === 'TypeError'
        ) {
          try {
            displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false,
            });
          } catch (retryErr) {
            const retryName = retryErr instanceof DOMException ? retryErr.name : '';
            if (retryName === 'AbortError') return false;
            setMediaError('Não foi possível iniciar o compartilhamento de tela neste navegador.');
            return false;
          }
        } else if (firstName === 'AbortError') {
          return false;
        } else if (
          firstName === 'NotAllowedError' ||
          firstName === 'SecurityError' ||
          firstMsg.includes('permissions policy') ||
          firstMsg.includes('disallowed')
        ) {
          const inIframe = window.self !== window.top;
          if (inIframe && (firstMsg.includes('permissions') || firstMsg.includes('policy') || firstMsg.includes('disallowed'))) {
            setScreenShareBlockedByIframe(true);
            setMediaError(
              'O painel incorporado bloqueou a permissão de captura de tela. Abra o aplicativo diretamente em uma nova aba do navegador para compartilhar sua tela.'
            );
          } else {
            setMediaError('Permissão de compartilhamento de tela cancelada ou bloqueada.');
          }
          return false;
        } else {
          setMediaError('Não foi possível iniciar o compartilhamento de tela.');
          return false;
        }
      }

      if (!displayStream) return false;

      if (screenStreamRef.current) {
        stopStream(screenStreamRef.current);
      }

      const [videoTrack] = displayStream.getVideoTracks();
      const hasAudio = displayStream.getAudioTracks().length > 0;

      if (videoTrack) {
        videoTrack.contentHint = 'detail';
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      screenStreamRef.current = displayStream;
      setLocalScreenStream(displayStream);
      setScreenSharing(true);
      setScreenHasSystemAudio(hasAudio);

      if (!activeRoomRef.current && autoJoinRoom) {
        await joinRoom(autoJoinRoom);
      } else if (activeRoomRef.current) {
        await renegotiateAllPeers();
        sendSignal({ type: 'room:state', screenSharing: true });
      }

      onAlertRef.current?.({
        type: 'screen_share',
        title: 'Você está compartilhando a tela',
        body: hasAudio
          ? 'Vídeo e áudio do sistema estão sendo transmitidos em tempo real.'
          : 'Transmissão de tela ativa. Clique em TELA CHEIA para expandir.',
      });
      return true;
    },
    [joinRoom, renegotiateAllPeers, sendSignal, stopScreenShare]
  );

  const setVolumeForPeer = useCallback((targetUid: string, volume: number) => {
    setPeerVolumes((prev) => ({
      ...prev,
      [targetUid]: Math.max(0, Math.min(2, volume)),
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream(micStreamRef.current);
      stopStream(camStreamRef.current);
      stopStream(screenStreamRef.current);
      for (const bundle of peerBundlesRef.current.values()) {
        bundle.pc.close();
      }
    };
  }, []);

  return {
    activeRoom,
    peers,
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
    joinRoom,
    leaveRoom,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    setVolumeForPeer,
    clearMediaError: () => {
      setMediaError(null);
      setScreenShareBlockedByIframe(false);
    },
  };
}
