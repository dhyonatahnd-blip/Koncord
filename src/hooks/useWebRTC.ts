import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { ToastAlert, VoicePeer } from '../types';
import { getApiBaseUrl } from '../lib/validation';
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
  const [livekitActive, setLivekitActive] = useState(false);

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
  const livekitRoomRef = useRef<Room | null>(null);
  const livekitPubsRef = useRef<{
    mic?: LocalTrackPublication;
    cam?: LocalTrackPublication;
    screenVideo?: LocalTrackPublication;
    screenAudio?: LocalTrackPublication;
  }>({});
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
    if (!activeRoom || livekitActive) return;
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
  }, [activeRoom, livekitActive, uid, micMuted]);

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
        if (pc.connectionState === 'closed') {
          peerBundlesRef.current.delete(targetUid);
        }
      };

      return bundle;
    },
    [monitorAudioLevel, sendSignal]
  );

  const renegotiateAllPeers = useCallback(async () => {
    const room = activeRoomRef.current;
    if (!room || livekitRoomRef.current) return;
    for (const [targetUid, bundle] of peerBundlesRef.current) {
      await sendOfferToPeer(targetUid, bundle, room.channelId);
    }
  }, [sendOfferToPeer]);

  // Listen to WebRTC signaling messages from WebSocket (Mesh mode when LiveKit is off)
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
          if (!livekitRoomRef.current) {
            const bundle = createPeerConnection(p.uid, room.channelId);
            await sendOfferToPeer(p.uid, bundle, room.channelId);
          }
        }
        setPeers(map);
      } else if (type === 'room:peer-joined' && msg.channelId === room.channelId) {
        const peer = msg.peer as VoicePeer;
        if (peer && peer.uid !== uid) {
          setPeers((prev) => ({ ...prev, [peer.uid]: peer }));
          if (!livekitRoomRef.current) {
            createPeerConnection(peer.uid, room.channelId);
          }
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
      } else if (!livekitRoomRef.current && type === 'rtc:offer' && msg.channelId === room.channelId) {
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
      } else if (!livekitRoomRef.current && type === 'rtc:answer' && msg.channelId === room.channelId) {
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
      } else if (!livekitRoomRef.current && type === 'rtc:ice-candidate' && msg.channelId === room.channelId) {
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

    if (livekitRoomRef.current) {
      livekitRoomRef.current.disconnect().catch(() => {});
      livekitRoomRef.current = null;
      livekitPubsRef.current = {};
    }
    setLivekitActive(false);

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
    setSpeakingUids({});
    setActiveRoom(null);
    setMediaError(null);
  }, [sendSignal]);

  const connectLiveKitIfConfigured = useCallback(
    async (roomInfo: { serverId: string; channelId: string }) => {
      if (!uid) return false;
      try {
        const resp = await fetch(`${getApiBaseUrl()}/api/livekit/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid,
            displayName: displayName || 'Participant',
            room: `${roomInfo.serverId}_${roomInfo.channelId}`,
          }),
        });
        if (!resp.ok) return false;
        const data = (await resp.json()) as { enabled?: boolean; url?: string; token?: string };
        if (!data.enabled || !data.url || !data.token) return false;

        const lkRoom = new Room({ adaptiveStream: true, dynacast: true });

        lkRoom.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            const targetUid = participant.identity;
            if (!targetUid || targetUid === uid) return;
            const stream = new MediaStream([track.mediaStreamTrack]);
            if (track.kind === Track.Kind.Audio) {
              setRemoteMedia((prev) => ({
                ...prev,
                [targetUid]: {
                  camStream: prev[targetUid]?.camStream || null,
                  screenStream: prev[targetUid]?.screenStream || null,
                  audioStream: stream,
                },
              }));
            } else if (track.kind === Track.Kind.Video) {
              const isScreen = publication.source === Track.Source.ScreenShare;
              setRemoteMedia((prev) => ({
                ...prev,
                [targetUid]: {
                  camStream: isScreen ? prev[targetUid]?.camStream || null : stream,
                  screenStream: isScreen ? stream : prev[targetUid]?.screenStream || null,
                  audioStream: prev[targetUid]?.audioStream || null,
                },
              }));
            }
          }
        );

        lkRoom.on(
          RoomEvent.TrackUnsubscribed,
          (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            const targetUid = participant.identity;
            if (!targetUid) return;
            setRemoteMedia((prev) => {
              const cur = prev[targetUid];
              if (!cur) return prev;
              const isScreen = publication.source === Track.Source.ScreenShare;
              return {
                ...prev,
                [targetUid]: {
                  camStream: track.kind === Track.Kind.Video && !isScreen ? null : cur.camStream,
                  screenStream: track.kind === Track.Kind.Video && isScreen ? null : cur.screenStream,
                  audioStream: track.kind === Track.Kind.Audio ? null : cur.audioStream,
                },
              };
            });
          }
        );

        lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          const next: Record<string, boolean> = {};
          for (const sp of speakers) {
            next[sp.identity] = true;
          }
          setSpeakingUids(next);
        });

        await lkRoom.connect(data.url, data.token);
        livekitRoomRef.current = lkRoom;
        setLivekitActive(true);

        // Publish already acquired local tracks
        if (micStreamRef.current) {
          const [audioTrack] = micStreamRef.current.getAudioTracks();
          if (audioTrack) {
            livekitPubsRef.current.mic = await lkRoom.localParticipant.publishTrack(audioTrack, {
              source: Track.Source.Microphone,
            });
          }
        }
        if (camStreamRef.current) {
          const [videoTrack] = camStreamRef.current.getVideoTracks();
          if (videoTrack) {
            livekitPubsRef.current.cam = await lkRoom.localParticipant.publishTrack(videoTrack, {
              source: Track.Source.Camera,
            });
          }
        }
        if (screenStreamRef.current) {
          const [screenVid] = screenStreamRef.current.getVideoTracks();
          const [screenAud] = screenStreamRef.current.getAudioTracks();
          if (screenVid) {
            livekitPubsRef.current.screenVideo = await lkRoom.localParticipant.publishTrack(screenVid, {
              source: Track.Source.ScreenShare,
            });
          }
          if (screenAud) {
            livekitPubsRef.current.screenAudio = await lkRoom.localParticipant.publishTrack(screenAud, {
              source: Track.Source.ScreenShareAudio,
            });
          }
        }
        return true;
      } catch {
        return false;
      }
    },
    [uid, displayName]
  );

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
          setMediaError('Microfone bloqueado pelas permissões do navegador (modo ouvinte).');
        } else {
          setMediaError('Microfone indisponível neste dispositivo (modo ouvinte).');
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

      await connectLiveKitIfConfigured(room);

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
    [uid, displayName, avatarDataUrl, leaveRoom, monitorAudioLevel, connectLiveKitIfConfigured, sendSignal]
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
        if (livekitRoomRef.current) {
          const [audioTrack] = stream.getAudioTracks();
          if (audioTrack) {
            livekitPubsRef.current.mic = await livekitRoomRef.current.localParticipant.publishTrack(
              audioTrack,
              { source: Track.Source.Microphone }
            );
          }
        } else {
          await renegotiateAllPeers();
        }
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
      if (livekitRoomRef.current && livekitPubsRef.current.cam?.track) {
        await livekitRoomRef.current.localParticipant.unpublishTrack(livekitPubsRef.current.cam.track);
        livekitPubsRef.current.cam = undefined;
      } else {
        for (const bundle of peerBundlesRef.current.values()) {
          for (const sender of bundle.pc.getSenders()) {
            if (sender.track && camStreamRef.current.getTracks().some((t) => t.id === sender.track?.id)) {
              bundle.pc.removeTrack(sender);
            }
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
      if (livekitRoomRef.current) {
        const [videoTrack] = videoStream.getVideoTracks();
        if (videoTrack) {
          livekitPubsRef.current.cam = await livekitRoomRef.current.localParticipant.publishTrack(
            videoTrack,
            { source: Track.Source.Camera }
          );
        }
      } else {
        await renegotiateAllPeers();
      }
      sendSignal({ type: 'room:state', camEnabled: true });
    } catch {
      setMediaError('Não foi possível acessar a câmera.');
    }
  }, [camEnabled, renegotiateAllPeers, sendSignal]);

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) {
      setScreenSharing(false);
      setScreenHasSystemAudio(false);
      setLocalScreenStream(null);
      return;
    }

    if (livekitRoomRef.current) {
      if (livekitPubsRef.current.screenVideo?.track) {
        await livekitRoomRef.current.localParticipant
          .unpublishTrack(livekitPubsRef.current.screenVideo.track)
          .catch(() => {});
        livekitPubsRef.current.screenVideo = undefined;
      }
      if (livekitPubsRef.current.screenAudio?.track) {
        await livekitRoomRef.current.localParticipant
          .unpublishTrack(livekitPubsRef.current.screenAudio.track)
          .catch(() => {});
        livekitPubsRef.current.screenAudio = undefined;
      }
    } else {
      for (const bundle of peerBundlesRef.current.values()) {
        for (const sender of bundle.pc.getSenders()) {
          if (sender.track && screenStreamRef.current.getTracks().some((t) => t.id === sender.track?.id)) {
            bundle.pc.removeTrack(sender);
          }
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
        setMediaError('getDisplayMedia API unavailable in this browser.');
        return false;
      }

      setMediaError(null);
      setScreenShareBlockedByIframe(false);

      let displayStream: MediaStream | null = null;
      try {
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
            setMediaError('Could not start screen sharing.');
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
            setMediaError('Screen capture blocked in embedded view. Open in a new tab.');
          } else {
            setMediaError('Screen share permission cancelled or blocked.');
          }
          return false;
        } else {
          setMediaError('Could not start screen sharing.');
          return false;
        }
      }

      if (!displayStream) return false;

      if (screenStreamRef.current) {
        stopStream(screenStreamRef.current);
      }

      const [videoTrack] = displayStream.getVideoTracks();
      const [audioTrack] = displayStream.getAudioTracks();
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
        if (livekitRoomRef.current) {
          if (videoTrack) {
            livekitPubsRef.current.screenVideo = await livekitRoomRef.current.localParticipant.publishTrack(
              videoTrack,
              { source: Track.Source.ScreenShare }
            );
          }
          if (audioTrack) {
            livekitPubsRef.current.screenAudio = await livekitRoomRef.current.localParticipant.publishTrack(
              audioTrack,
              { source: Track.Source.ScreenShareAudio }
            );
          }
        } else {
          await renegotiateAllPeers();
        }
        sendSignal({ type: 'room:state', screenSharing: true });
      }

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

  useEffect(() => {
    return () => {
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect().catch(() => {});
      }
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
    livekitActive,
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
