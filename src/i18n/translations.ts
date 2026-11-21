import { LanguageCode } from '../types';

export interface TranslationStrings {
  brandName: string;
  brandSubtitle: string;
  entryHeadline: string;
  entryLead: string;
  entryFeature1Title: string;
  entryFeature1Desc: string;
  entryFeature2Title: string;
  entryFeature2Desc: string;
  entryFeature3Title: string;
  entryFeature3Desc: string;
  nicknameLabel: string;
  nicknamePlaceholder: string;
  languageLabel: string;
  avatarLabel: string;
  uploadPhoto: string;
  removePhoto: string;
  presetAvatarsLabel: string;
  inviteOptionalLabel: string;
  inviteOptionalPlaceholder: string;
  enterButton: string;
  entryPrivacyNote: string;
  readPrivacyPolicy: string;
  noAccountRequired: string;

  // Navigation & Sidebars
  directMessages: string;
  publicRooms: string;
  createRoom: string;
  joinByCode: string;
  notifications: string;
  channelsAndRooms: string;
  category: string;
  newCategory: string;
  renameCategory: string;
  deleteCategory: string;
  createChannel: string;
  editChannel: string;
  deleteChannel: string;
  moveUp: string;
  moveDown: string;
  roomSettings: string;
  leaveRoom: string;
  closeRoom: string;
  copyInviteLink: string;
  copyInviteCode: string;
  inviteCopied: string;
  inviteLinkCopied: string;
  connectedInRoom: string;
  sharingScreenBadge: string;
  muteMic: string;
  unmuteMic: string;
  disconnectRoom: string;
  userSettings: string;

  // Presence
  online: string;
  idle: string;
  dnd: string;
  invisible: string;

  // Members
  membersTitle: string;
  onlineCount: string;
  offlineCount: string;
  ownerRole: string;
  adminRole: string;
  memberRole: string;

  // Chat & Files
  chatPlaceholder: string;
  replyingTo: string;
  editedLabel: string;
  replyAction: string;
  editAction: string;
  deleteAction: string;
  saveAction: string;
  cancelAction: string;
  attachFileTitle: string;
  tempFileBanner: string;
  tempFileCountdownPrefix: string;
  tempFileExpiredNotice: string;
  tempFilePreviewPdf: string;
  tempFileHidePreview: string;
  tempFileDownload: string;
  tempFileOpenError: string;
  uploadingFile: string;
  fileTooLarge: string;
  fileNotAllowed: string;
  uploadQuotaExceeded: string;
  typingOne: string;
  typingMany: string;
  emptyChatTitle: string;
  emptyChatSubtitle: string;
  sendMessageTitle: string;

  // Voice, Video & Screen Share
  shareScreenBtn: string;
  stopScreenBtn: string;
  shareGameBtn: string;
  joinAndShareGameBtn: string;
  gameModeBadge: string;
  screenVolumeLabel: string;
  muteStreamBtn: string;
  unmuteStreamBtn: string;
  muteOutgoingScreenAudio: string;
  unmuteOutgoingScreenAudio: string;
  noSystemAudioBadge: string;
  noSystemAudioHint: string;
  screenAudioMutedBadge: string;
  enableScreenAudioBtn: string;
  voiceRoomTitle: string;
  videoRoomTitle: string;
  joinRoomBtn: string;
  joinAndShareBtn: string;
  participantsInRoom: string;
  noParticipantsYet: string;
  openInNewTab: string;
  micOn: string;
  micOff: string;
  camOn: string;
  camOff: string;
  shareScreen: string;
  stopShare: string;
  leaveCall: string;
  fullscreenBtn: string;
  exitFullscreenBtn: string;
  hideControlsBtn: string;
  showControlsBtn: string;
  liveScreenTitle: string;
  withSystemAudio: string;
  escHint: string;
  localYou: string;
  cameraPreview: string;
  speakingNow: string;
  participantVolume: string;
  livekitActive: string;
  webrtcDirect: string;

  // Modals: Room Create / Join / Public / Settings
  createRoomTitle: string;
  createRoomSubtitle: string;
  roomNameLabel: string;
  roomNamePlaceholder: string;
  roomDescLabel: string;
  roomDescPlaceholder: string;
  visibilityLabel: string;
  visibilityPublic: string;
  visibilityPublicDesc: string;
  visibilityPrivate: string;
  visibilityPrivateDesc: string;
  retentionLabel: string;
  retention5m: string;
  retention15m: string;
  retention60m: string;
  retentionUntilClose: string;
  clearOnCloseLabel: string;
  emblemColorLabel: string;
  createRoomSubmit: string;
  creating: string;
  joinRoomTitle: string;
  joinRoomSubtitle: string;
  inviteCodeLabel: string;
  joinRoomSubmit: string;
  joining: string;
  publicRoomsTitle: string;
  publicRoomsSubtitle: string;
  publicRoomsEmpty: string;
  joinBtn: string;
  alreadyMember: string;
  roomSettingsTitle: string;
  inviteFriendsLabel: string;
  inviteBtn: string;
  invitedBtn: string;
  closeRoomConfirmTitle: string;
  closeRoomWarning: string;
  closeRoomBtn: string;

  // Category & Channel Modals
  categoryNameLabel: string;
  channelNameLabel: string;
  channelTopicLabel: string;
  channelTypeLabel: string;
  channelTypeText: string;
  channelTypeVoice: string;
  channelTypeVideo: string;
  channelCategoryLabel: string;

  // Profile & Settings
  accountSettingsTitle: string;
  sessionTagLabel: string;
  displayNameLabel: string;
  usernameLabel: string;
  customStatusLabel: string;
  presenceLabel: string;
  bioLabel: string;
  notificationsToggle: string;
  exitSessionBtn: string;
  saveChangesBtn: string;
  saving: string;

  // GDPR & Consent
  privacyPolicyTitle: string;
  privacyPolicySubtitle: string;
  privacySection1Title: string;
  privacySection1Body: string;
  privacySection2Title: string;
  privacySection2Body: string;
  privacySection3Title: string;
  privacySection3Body: string;
  privacySection4Title: string;
  privacySection4Body: string;
  closeBtn: string;

  mediaConsentTitle: string;
  mediaConsentBody: string;
  mediaConsentNotice: string;
  mediaConsentAccept: string;
  mediaConsentDecline: string;

  // Friends & DMs
  friendsAndDmsTitle: string;
  friendsOnlineTab: string;
  friendsAllTab: string;
  friendsPendingTab: string;
  friendsBlockedTab: string;
  friendsAddTab: string;
  directMessageBtn: string;
  addFriendBtn: string;
  blockBtn: string;
  unblockBtn: string;
  promoteAdminBtn: string;
  removeAdminBtn: string;
  friendRequestSent: string;

  // Empty Workspace
  selectOrCreatePrompt: string;
  explorePublicRoomsBtn: string;

  // Alerts
  alertScreenStartedTitle: string;
  alertScreenStartedBody: string;
  alertScreenStoppedTitle: string;
  alertScreenStoppedBody: string;
  alertPeerJoinedTitle: string;
  alertPeerJoinedBody: string;
  alertFileExpiredTitle: string;
  alertFileExpiredBody: string;
  alertRoomClosedTitle: string;
  alertRoomClosedBody: string;

  // Discovery & Connection
  onlineNowInZone: string;
  inviteToRoomBtn: string;
  inviteSentNotice: string;
  discoverParticipantsTitle: string;
  searchParticipantsPlaceholder: string;
  participantNotFound: string;
  searchRoomsPlaceholder: string;
  localModeBanner: string;
  connectingRealtimeNotice: string;
  backBtn: string;
  contactsTabLabel: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationStrings> = {
  'pt-BR': {
    brandName: 'ZONE',
    brandSubtitle: 'Comunicação Social Temporária',
    entryHeadline: 'Conecte-se em segundos, sem cadastro permanente.',
    entryLead:
      'Salas temporárias de texto, voz, vídeo e compartilhamento de tela em alta definição, pensadas para privacidade e velocidade na Europa.',
    entryFeature1Title: 'Arquivos com autodestruição em 5 minutos',
    entryFeature1Desc:
      'Imagens, vídeos e PDFs são removidos fisicamente do servidor após 5 minutos com contagem regressiva ao vivo.',
    entryFeature2Title: 'Voz, vídeo e tela cheia sem cortes',
    entryFeature2Desc:
      'Transmita tela inteira, janela ou aba com proporção preservada, controles discretos e saída rápida por ESC.',
    entryFeature3Title: 'Privacidade orientada ao GDPR',
    entryFeature3Desc:
      'Sessões anônimas sem e-mail, senha ou telefone, com identificador interno único e retenção configurável.',
    nicknameLabel: 'Seu apelido',
    nicknamePlaceholder: 'Como você quer ser visto',
    languageLabel: 'Idioma da interface',
    avatarLabel: 'Fotografia ou avatar',
    uploadPhoto: 'Enviar foto',
    removePhoto: 'Remover',
    presetAvatarsLabel: 'Ou escolha um avatar pronto',
    inviteOptionalLabel: 'Código ou link da sala (opcional)',
    inviteOptionalPlaceholder: 'Ex: ZONEEU',
    enterButton: 'ENTRAR',
    entryPrivacyNote: 'Sem e-mail, sem senha e sem cadastro tradicional. Identificação temporária por sessão.',
    readPrivacyPolicy: 'Política de Privacidade & GDPR',
    noAccountRequired: 'Sessão temporária instantânea',

    directMessages: 'Mensagens Diretas',
    publicRooms: 'Explorar Salas Públicas',
    createRoom: 'Criar Sala',
    joinByCode: 'Entrar por Código',
    notifications: 'Notificações',
    channelsAndRooms: 'Canais & Salas',
    category: 'Categoria',
    newCategory: 'Nova Categoria',
    renameCategory: 'Renomear Categoria',
    deleteCategory: 'Excluir Categoria',
    createChannel: 'Criar Canal',
    editChannel: 'Editar Canal',
    deleteChannel: 'Excluir Canal',
    moveUp: 'Mover para cima',
    moveDown: 'Mover para baixo',
    roomSettings: 'Configurações da Sala',
    leaveRoom: 'Sair da Sala',
    closeRoom: 'Encerrar Sala',
    copyInviteLink: 'Copiar Link',
    copyInviteCode: 'Copiar Código',
    inviteCopied: 'Convite copiado',
    inviteLinkCopied: 'Link da sala copiado para a área de transferência.',
    connectedInRoom: 'Conectado na chamada',
    sharingScreenBadge: 'Transmitindo tela',
    muteMic: 'Silenciar microfone',
    unmuteMic: 'Ativar microfone',
    disconnectRoom: 'Desconectar',
    userSettings: 'Configurações',

    online: 'Disponível',
    idle: 'Ausente',
    dnd: 'Ocupado',
    invisible: 'Invisível',

    membersTitle: 'Participantes',
    onlineCount: 'Online',
    offlineCount: 'Ausentes',
    ownerRole: 'Criador',
    adminRole: 'Admin',
    memberRole: 'Membro',

    chatPlaceholder: 'Enviar mensagem em',
    replyingTo: 'Respondendo a',
    editedLabel: '(editada)',
    replyAction: 'Responder',
    editAction: 'Editar',
    deleteAction: 'Excluir',
    saveAction: 'Salvar',
    cancelAction: 'Cancelar',
    attachFileTitle: 'Enviar arquivo temporário (expira em 5 min)',
    tempFileBanner: 'Arquivos enviados são excluídos automaticamente do servidor em 5 minutos.',
    tempFileCountdownPrefix: 'Expira em',
    tempFileExpiredNotice: 'Arquivo expirado e excluído do servidor',
    tempFilePreviewPdf: 'Pré-visualizar PDF',
    tempFileHidePreview: 'Ocultar prévia',
    tempFileDownload: 'Baixar',
    tempFileOpenError: 'Não foi possível enviar o arquivo.',
    uploadingFile: 'Enviando arquivo temporário...',
    fileTooLarge: 'Arquivo excede o limite de 10 MB.',
    fileNotAllowed: 'Formato não permitido. Envie JPG, PNG, WEBP, MP4, WEBM, PDF ou documento autorizado.',
    uploadQuotaExceeded: 'Limite temporário de envios atingido. Aguarde a expiração de arquivos anteriores.',
    typingOne: 'está digitando...',
    typingMany: 'pessoas estão digitando...',
    emptyChatTitle: 'Início da conversa em',
    emptyChatSubtitle: 'Mensagens e arquivos seguem a retenção temporária configurada para esta sala.',
    sendMessageTitle: 'Enviar mensagem',

    shareScreenBtn: 'Compartilhar Tela',
    stopScreenBtn: 'Parar Tela',
    shareGameBtn: 'Compartilhar Jogo',
    joinAndShareGameBtn: 'Entrar e Compartilhar Jogo (60 FPS)',
    gameModeBadge: 'Modo Jogo · 60 FPS',
    screenVolumeLabel: 'Volume da tela',
    muteStreamBtn: 'Mutar transmissão',
    unmuteStreamBtn: 'Ativar som da tela',
    muteOutgoingScreenAudio: 'Mutar áudio do jogo/tela',
    unmuteOutgoingScreenAudio: 'Ativar áudio do jogo/tela',
    noSystemAudioBadge: 'Sem áudio do sistema',
    noSystemAudioHint: 'Sem áudio — compartilhe uma Guia ou marque "Compartilhar áudio"',
    screenAudioMutedBadge: 'Áudio da tela mutado',
    enableScreenAudioBtn: 'Ativar som da tela',
    voiceRoomTitle: 'Sala de Voz',
    videoRoomTitle: 'Sala de Vídeo & Tela',
    joinRoomBtn: 'Entrar na Sala',
    joinAndShareBtn: 'Entrar e Compartilhar Tela',
    participantsInRoom: 'participante(s) na sala',
    noParticipantsYet: 'Nenhum participante conectado no momento.',
    openInNewTab: 'Abrir em nova aba',
    micOn: 'Microfone ativo',
    micOff: 'Microfone mudo',
    camOn: 'Câmera ativa',
    camOff: 'Câmera desligada',
    shareScreen: 'Compartilhar Tela',
    stopShare: 'Parar Compartilhamento',
    leaveCall: 'Sair da Chamada',
    fullscreenBtn: 'TELA CHEIA',
    exitFullscreenBtn: 'Sair da Tela Cheia',
    hideControlsBtn: 'Ocultar Controles',
    showControlsBtn: 'Mostrar Controles',
    liveScreenTitle: 'Compartilhamento de tela ao vivo',
    withSystemAudio: 'Com áudio do sistema',
    escHint: 'Pressione ESC ou clique em Sair da Tela Cheia sem interromper a transmissão',
    localYou: 'Você',
    cameraPreview: 'Câmera local',
    speakingNow: 'Falando',
    participantVolume: 'Volume',
    livekitActive: 'LiveKit SFU ativo',
    webrtcDirect: 'WebRTC em tempo real',

    createRoomTitle: 'Criar Sala Temporária',
    createRoomSubtitle: 'Configure visibilidade, retenção de histórico e canais iniciais.',
    roomNameLabel: 'Nome da sala',
    roomNamePlaceholder: 'Ex: Europa Lounge ou Projeto Alpha',
    roomDescLabel: 'Descrição',
    roomDescPlaceholder: 'Tema da conversa ou idioma principal',
    visibilityLabel: 'Visibilidade da sala',
    visibilityPublic: 'Pública',
    visibilityPublicDesc: 'Listada no diretório de salas abertas para qualquer visitante.',
    visibilityPrivate: 'Privada',
    visibilityPrivateDesc: 'Acessível apenas por link de convite ou código.',
    retentionLabel: 'Retenção das mensagens de texto',
    retention5m: '5 minutos',
    retention15m: '15 minutos',
    retention60m: '1 hora',
    retentionUntilClose: 'Até encerrar a sala',
    clearOnCloseLabel: 'Apagar todo o histórico imediatamente quando a sala for encerrada',
    emblemColorLabel: 'Cor do emblema',
    createRoomSubmit: 'Criar Sala',
    creating: 'Criando...',
    joinRoomTitle: 'Entrar com Código ou Link',
    joinRoomSubtitle: 'Cole o código da sala privada ou pública para conectar.',
    inviteCodeLabel: 'Código da sala',
    joinRoomSubmit: 'Entrar na Sala',
    joining: 'Entrando...',
    publicRoomsTitle: 'Salas Públicas Ativas',
    publicRoomsSubtitle: 'Entre diretamente em salas abertas da comunidade.',
    publicRoomsEmpty: 'Nenhuma sala pública disponível no momento.',
    joinBtn: 'Entrar',
    alreadyMember: 'Na sua lista',
    roomSettingsTitle: 'Configurações da Sala',
    inviteFriendsLabel: 'Convidar contatos',
    inviteBtn: 'Convidar',
    invitedBtn: 'Enviado',
    closeRoomConfirmTitle: 'Encerrar Sala',
    closeRoomWarning: 'Encerrar a sala remove canais, desconecta participantes e apaga o histórico temporário.',
    closeRoomBtn: 'Encerrar Sala Agora',

    categoryNameLabel: 'Nome da categoria',
    channelNameLabel: 'Nome do canal',
    channelTopicLabel: 'Tópico / descrição',
    channelTypeLabel: 'Tipo de canal',
    channelTypeText: 'Texto',
    channelTypeVoice: 'Voz',
    channelTypeVideo: 'Vídeo & Tela',
    channelCategoryLabel: 'Categoria',

    accountSettingsTitle: 'Preferências & Sessão',
    sessionTagLabel: 'Identificador interno único',
    displayNameLabel: 'Apelido',
    usernameLabel: 'Identificador (@)',
    customStatusLabel: 'Status rápido',
    presenceLabel: 'Disponibilidade',
    bioLabel: 'Sobre você',
    notificationsToggle: 'Exibir alertas de mensagens e transmissões em tempo real',
    exitSessionBtn: 'Encerrar Sessão',
    saveChangesBtn: 'Salvar alterações',
    saving: 'Salvando...',

    privacyPolicyTitle: 'Privacidade, Retenção & GDPR',
    privacyPolicySubtitle: 'Transparência sobre dados temporários na União Europeia',
    privacySection1Title: '1. Sessões sem cadastro e minimização de dados',
    privacySection1Body:
      'A ZONE funciona sem e-mail, senha, telefone ou perfil permanente. Cada visitante recebe apenas um identificador temporário único para distinguir participantes com apelidos iguais.',
    privacySection2Title: '2. Exclusão obrigatória de arquivos em 5 minutos',
    privacySection2Body:
      'Todos os arquivos enviados (JPG, PNG, WEBP, MP4, WEBM, PDF e documentos permitidos) recebem carimbo de expiração de 5 minutos e são removidos fisicamente do servidor e do índice por rotina automática a cada minuto. Links antigos retornam erro imediato após a expiração.',
    privacySection3Title: '3. Consentimento para câmera, microfone e tela',
    privacySection3Body:
      'O acesso a microfone, câmera e captura de tela só ocorre mediante autorização explícita do participante no navegador, sem gravação automática pelo servidor.',
    privacySection4Title: '4. Limites de anonimato e dados técnicos de rede',
    privacySection4Body:
      'Não prometemos anonimato absoluto na internet: provedores de infraestrutura, servidores WebSocket/WebRTC, LiveKit ou hospedagem podem processar dados técnicos de conexão, como endereço IP e cabeçalhos de rede, estritamente para entrega da comunicação em tempo real.',
    closeBtn: 'Fechar',

    mediaConsentTitle: 'Consentimento de Áudio e Vídeo (GDPR)',
    mediaConsentBody:
      'Ao entrar em uma sala de voz, vídeo ou compartilhar sua tela, o navegador solicitará permissão de mídia para transmissão ao vivo aos participantes da sala.',
    mediaConsentNotice:
      'Seus fluxos de áudio/vídeo são transmitidos em tempo real sem gravação automática no servidor. Serviços de rede (WebRTC/STUN/LiveKit) podem processar seu endereço IP técnico durante a chamada.',
    mediaConsentAccept: 'Concordo e continuar',
    mediaConsentDecline: 'Cancelar',

    friendsAndDmsTitle: 'Contatos & Mensagens Privadas',
    friendsOnlineTab: 'Online',
    friendsAllTab: 'Todos',
    friendsPendingTab: 'Pendentes',
    friendsBlockedTab: 'Bloqueados',
    friendsAddTab: 'Adicionar',
    directMessageBtn: 'Mensagem Direta',
    addFriendBtn: 'Adicionar Contato',
    blockBtn: 'Bloquear',
    unblockBtn: 'Desbloquear',
    promoteAdminBtn: 'Promover a Admin',
    removeAdminBtn: 'Remover Admin',
    friendRequestSent: 'Solicitação enviada.',

    selectOrCreatePrompt: 'Selecione uma sala pública, crie a sua ou entre por código.',
    explorePublicRoomsBtn: 'Explorar Salas Públicas',

    alertScreenStartedTitle: 'Compartilhamento de tela iniciado',
    alertScreenStartedBody: 'começou a transmitir a tela ao vivo.',
    alertScreenStoppedTitle: 'Compartilhamento encerrado',
    alertScreenStoppedBody: 'encerrou a transmissão da tela.',
    alertPeerJoinedTitle: 'Participante na sala',
    alertPeerJoinedBody: 'entrou em',
    alertFileExpiredTitle: 'Arquivo expirado',
    alertFileExpiredBody: 'Um arquivo temporário atingiu 5 minutos e foi excluído do servidor.',
    alertRoomClosedTitle: 'Sala encerrada',
    alertRoomClosedBody: 'Esta sala temporária foi encerrada pelo criador.',

    onlineNowInZone: 'Online na ZONE',
    inviteToRoomBtn: 'Convidar para sala',
    inviteSentNotice: 'Convite enviado para esta sala!',
    discoverParticipantsTitle: 'Participantes online agora',
    searchParticipantsPlaceholder: 'Buscar por apelido, #TAG ou @handle...',
    participantNotFound: 'Participante não encontrado online no momento.',
    searchRoomsPlaceholder: 'Buscar sala pública por nome ou código...',
    localModeBanner:
      'Modo local (apenas este navegador): nenhum servidor WebSocket conectado. Para conectar outras pessoas, configure VITE_WS_URL ou abra a URL com backend ativo.',
    connectingRealtimeNotice: 'Conectando ao servidor em tempo real...',
    backBtn: 'Voltar',
    contactsTabLabel: 'Contatos',
  },

  en: {
    brandName: 'ZONE',
    brandSubtitle: 'Temporary Social Communication',
    entryHeadline: 'Connect in seconds, without permanent registration.',
    entryLead:
      'Temporary text, voice, video, and high-definition screen sharing rooms built for speed and privacy across Europe.',
    entryFeature1Title: '5-minute self-destructing files',
    entryFeature1Desc:
      'Images, videos, and PDFs are physically purged from the server after 5 minutes with a live countdown.',
    entryFeature2Title: 'Voice, video & distortion-free fullscreen',
    entryFeature2Desc:
      'Share your entire screen, window, or browser tab preserving aspect ratio with discreet controls and ESC exit.',
    entryFeature3Title: 'GDPR-conscious temporary design',
    entryFeature3Desc:
      'Anonymous sessions with no email, password, or phone, backed by a unique participant ID and configurable retention.',
    nicknameLabel: 'Your nickname',
    nicknamePlaceholder: 'How others will see you',
    languageLabel: 'Interface language',
    avatarLabel: 'Photo or avatar',
    uploadPhoto: 'Upload photo',
    removePhoto: 'Remove',
    presetAvatarsLabel: 'Or pick a preset avatar',
    inviteOptionalLabel: 'Room code or link (optional)',
    inviteOptionalPlaceholder: 'e.g. ZONEEU',
    enterButton: 'ENTER',
    entryPrivacyNote: 'No email, no password, and no permanent account. Temporary session-only identity.',
    readPrivacyPolicy: 'Privacy Policy & GDPR',
    noAccountRequired: 'Instant temporary session',

    directMessages: 'Direct Messages',
    publicRooms: 'Browse Public Rooms',
    createRoom: 'Create Room',
    joinByCode: 'Join by Code',
    notifications: 'Notifications',
    channelsAndRooms: 'Channels & Rooms',
    category: 'Category',
    newCategory: 'New Category',
    renameCategory: 'Rename Category',
    deleteCategory: 'Delete Category',
    createChannel: 'Create Channel',
    editChannel: 'Edit Channel',
    deleteChannel: 'Delete Channel',
    moveUp: 'Move up',
    moveDown: 'Move down',
    roomSettings: 'Room Settings',
    leaveRoom: 'Leave Room',
    closeRoom: 'Close Room',
    copyInviteLink: 'Copy Link',
    copyInviteCode: 'Copy Code',
    inviteCopied: 'Invite copied',
    inviteLinkCopied: 'Room invite link copied to clipboard.',
    connectedInRoom: 'Connected in call',
    sharingScreenBadge: 'Sharing screen',
    muteMic: 'Mute microphone',
    unmuteMic: 'Unmute microphone',
    disconnectRoom: 'Disconnect',
    userSettings: 'Settings',

    online: 'Online',
    idle: 'Away',
    dnd: 'Busy',
    invisible: 'Invisible',

    membersTitle: 'Participants',
    onlineCount: 'Online',
    offlineCount: 'Away',
    ownerRole: 'Owner',
    adminRole: 'Admin',
    memberRole: 'Member',

    chatPlaceholder: 'Message',
    replyingTo: 'Replying to',
    editedLabel: '(edited)',
    replyAction: 'Reply',
    editAction: 'Edit',
    deleteAction: 'Delete',
    saveAction: 'Save',
    cancelAction: 'Cancel',
    attachFileTitle: 'Send temporary file (expires in 5 min)',
    tempFileBanner: 'Uploaded files are permanently deleted from the server after 5 minutes.',
    tempFileCountdownPrefix: 'Expires in',
    tempFileExpiredNotice: 'File expired and deleted from server',
    tempFilePreviewPdf: 'Preview PDF',
    tempFileHidePreview: 'Hide preview',
    tempFileDownload: 'Download',
    tempFileOpenError: 'Could not upload file.',
    uploadingFile: 'Uploading temporary file...',
    fileTooLarge: 'File exceeds the 10 MB limit.',
    fileNotAllowed: 'File type not allowed. Use JPG, PNG, WEBP, MP4, WEBM, PDF, or an allowed document.',
    uploadQuotaExceeded: 'Temporary upload rate limit reached. Wait for earlier files to expire.',
    typingOne: 'is typing...',
    typingMany: 'people are typing...',
    emptyChatTitle: 'Start of conversation in',
    emptyChatSubtitle: 'Messages and files follow the temporary retention policy configured for this room.',
    sendMessageTitle: 'Send message',

    shareScreenBtn: 'Share Screen',
    stopScreenBtn: 'Stop Screen',
    shareGameBtn: 'Share Game',
    joinAndShareGameBtn: 'Join & Share Game (60 FPS)',
    gameModeBadge: 'Game Mode · 60 FPS',
    screenVolumeLabel: 'Stream volume',
    muteStreamBtn: 'Mute stream',
    unmuteStreamBtn: 'Unmute stream',
    muteOutgoingScreenAudio: 'Mute game/screen audio',
    unmuteOutgoingScreenAudio: 'Unmute game/screen audio',
    noSystemAudioBadge: 'No system audio',
    noSystemAudioHint: 'No audio — share a Tab or check "Share audio"',
    screenAudioMutedBadge: 'Stream audio muted',
    enableScreenAudioBtn: 'Enable stream audio',
    voiceRoomTitle: 'Voice Channel',
    videoRoomTitle: 'Video & Screen Room',
    joinRoomBtn: 'Join Room',
    joinAndShareBtn: 'Join & Share Screen',
    participantsInRoom: 'participant(s) in room',
    noParticipantsYet: 'No participants connected yet.',
    openInNewTab: 'Open in new tab',
    micOn: 'Mic on',
    micOff: 'Mic muted',
    camOn: 'Camera on',
    camOff: 'Camera off',
    shareScreen: 'Share Screen',
    stopShare: 'Stop Sharing',
    leaveCall: 'Leave Call',
    fullscreenBtn: 'FULLSCREEN',
    exitFullscreenBtn: 'Exit Fullscreen',
    hideControlsBtn: 'Hide Controls',
    showControlsBtn: 'Show Controls',
    liveScreenTitle: 'Live screen share',
    withSystemAudio: 'With system audio',
    escHint: 'Press ESC or click Exit Fullscreen without stopping the stream',
    localYou: 'You',
    cameraPreview: 'Local camera',
    speakingNow: 'Speaking',
    participantVolume: 'Volume',
    livekitActive: 'LiveKit SFU active',
    webrtcDirect: 'Real-time WebRTC',

    createRoomTitle: 'Create Temporary Room',
    createRoomSubtitle: 'Configure visibility, message retention, and initial channels.',
    roomNameLabel: 'Room name',
    roomNamePlaceholder: 'e.g. Europe Lounge or Project Alpha',
    roomDescLabel: 'Description',
    roomDescPlaceholder: 'Topic or primary language',
    visibilityLabel: 'Room visibility',
    visibilityPublic: 'Public',
    visibilityPublicDesc: 'Listed in the public room directory for anyone to join.',
    visibilityPrivate: 'Private',
    visibilityPrivateDesc: 'Accessible only via invite link or room code.',
    retentionLabel: 'Text message retention',
    retention5m: '5 minutes',
    retention15m: '15 minutes',
    retention60m: '1 hour',
    retentionUntilClose: 'Until room closes',
    clearOnCloseLabel: 'Immediately erase all chat history when room closes',
    emblemColorLabel: 'Badge color',
    createRoomSubmit: 'Create Room',
    creating: 'Creating...',
    joinRoomTitle: 'Join with Code or Link',
    joinRoomSubtitle: 'Enter a public or private room invite code.',
    inviteCodeLabel: 'Room code',
    joinRoomSubmit: 'Join Room',
    joining: 'Joining...',
    publicRoomsTitle: 'Active Public Rooms',
    publicRoomsSubtitle: 'Join open community spaces right away.',
    publicRoomsEmpty: 'No public rooms available right now.',
    joinBtn: 'Join',
    alreadyMember: 'Joined',
    roomSettingsTitle: 'Room Settings',
    inviteFriendsLabel: 'Invite contacts',
    inviteBtn: 'Invite',
    invitedBtn: 'Sent',
    closeRoomConfirmTitle: 'Close Room',
    closeRoomWarning: 'Closing the room disconnects participants and erases temporary channels and history.',
    closeRoomBtn: 'Close Room Now',

    categoryNameLabel: 'Category name',
    channelNameLabel: 'Channel name',
    channelTopicLabel: 'Topic / description',
    channelTypeLabel: 'Channel type',
    channelTypeText: 'Text',
    channelTypeVoice: 'Voice',
    channelTypeVideo: 'Video & Screen',
    channelCategoryLabel: 'Category',

    accountSettingsTitle: 'Preferences & Session',
    sessionTagLabel: 'Unique internal identifier',
    displayNameLabel: 'Nickname',
    usernameLabel: 'Handle (@)',
    customStatusLabel: 'Quick status',
    presenceLabel: 'Availability',
    bioLabel: 'About you',
    notificationsToggle: 'Show real-time alerts for messages and screen shares',
    exitSessionBtn: 'End Session',
    saveChangesBtn: 'Save changes',
    saving: 'Saving...',

    privacyPolicyTitle: 'Privacy, Retention & GDPR',
    privacyPolicySubtitle: 'Transparency on temporary data handling in Europe',
    privacySection1Title: '1. Registration-free sessions & data minimization',
    privacySection1Body:
      'ZONE works without email, password, phone number, or permanent accounts. Each participant is assigned a unique temporary internal identifier so identical nicknames remain distinct.',
    privacySection2Title: '2. Mandatory 5-minute file deletion',
    privacySection2Body:
      'All uploaded files (JPG, PNG, WEBP, MP4, WEBM, PDF, and allowed documents) expire 5 minutes after upload and are physically deleted from server storage and database records by an automated minute-level cleanup routine. Expired links immediately return an error.',
    privacySection3Title: '3. Camera, microphone & screen share consent',
    privacySection3Body:
      'Microphone, camera, and screen capture are only activated with explicit browser permission and are streamed live without automatic server-side recording.',
    privacySection4Title: '4. Network anonymity limits & technical metadata',
    privacySection4Body:
      'We do not promise absolute anonymity: underlying infrastructure providers, WebSocket relays, WebRTC/TURN, or LiveKit servers may process technical connection metadata including IP addresses strictly to deliver real-time communication.',
    closeBtn: 'Close',

    mediaConsentTitle: 'Audio & Video Consent (GDPR)',
    mediaConsentBody:
      'When joining a voice/video room or sharing your screen, your browser will ask for media permissions to stream live to room participants.',
    mediaConsentNotice:
      'Audio and video streams are transmitted live without automatic server recording. Network relays (WebRTC/STUN/LiveKit) may process your technical IP address during the call.',
    mediaConsentAccept: 'Agree & continue',
    mediaConsentDecline: 'Cancel',

    friendsAndDmsTitle: 'Contacts & Direct Messages',
    friendsOnlineTab: 'Online',
    friendsAllTab: 'All',
    friendsPendingTab: 'Pending',
    friendsBlockedTab: 'Blocked',
    friendsAddTab: 'Add',
    directMessageBtn: 'Direct Message',
    addFriendBtn: 'Add Contact',
    blockBtn: 'Block',
    unblockBtn: 'Unblock',
    promoteAdminBtn: 'Make Admin',
    removeAdminBtn: 'Remove Admin',
    friendRequestSent: 'Request sent.',

    selectOrCreatePrompt: 'Pick a public room, create one, or join using an invite code.',
    explorePublicRoomsBtn: 'Browse Public Rooms',

    alertScreenStartedTitle: 'Screen share started',
    alertScreenStartedBody: 'started sharing their screen live.',
    alertScreenStoppedTitle: 'Screen share ended',
    alertScreenStoppedBody: 'stopped sharing their screen.',
    alertPeerJoinedTitle: 'Joined call',
    alertPeerJoinedBody: 'joined',
    alertFileExpiredTitle: 'File expired',
    alertFileExpiredBody: 'A temporary file reached 5 minutes and was removed from the server.',
    alertRoomClosedTitle: 'Room closed',
    alertRoomClosedBody: 'This temporary room was closed by its owner.',

    onlineNowInZone: 'Online in ZONE',
    inviteToRoomBtn: 'Invite to room',
    inviteSentNotice: 'Room invite sent!',
    discoverParticipantsTitle: 'Participants online now',
    searchParticipantsPlaceholder: 'Search by nickname, #TAG, or @handle...',
    participantNotFound: 'Participant not found online right now.',
    searchRoomsPlaceholder: 'Search public room by name or code...',
    localModeBanner:
      'Local browser-only mode: no WebSocket backend connected. To connect with other people, configure VITE_WS_URL or use a hosted backend URL.',
    connectingRealtimeNotice: 'Connecting to real-time server...',
    backBtn: 'Back',
    contactsTabLabel: 'Contacts',
  },

  ru: {
    brandName: 'ZONE',
    brandSubtitle: 'Временное социальное общение',
    entryHeadline: 'Общайтесь за секунды без постоянной регистрации.',
    entryLead:
      'Временные комнаты для чата, голоса, видео и демонстрации экрана в высоком качестве с упором на приватность в Европе.',
    entryFeature1Title: 'Автоудаление файлов через 5 минут',
    entryFeature1Desc:
      'Изображения, видео и PDF физически удаляются с сервера через 5 минут с обратным отсчётом в реальном времени.',
    entryFeature2Title: 'Голос, видео и полноэкранный режим без обрезки',
    entryFeature2Desc:
      'Делитесь экраном, окном или вкладкой с сохранением пропорций, скрываемой панелью и выходом по ESC.',
    entryFeature3Title: 'Приватность с учётом GDPR',
    entryFeature3Desc:
      'Анонимные сессии без почты, пароля и телефона, с уникальным внутренним ID и настраиваемым сроком хранения.',
    nicknameLabel: 'Ваш никнейм',
    nicknamePlaceholder: 'Как вас будут видеть участники',
    languageLabel: 'Язык интерфейса',
    avatarLabel: 'Фото или аватар',
    uploadPhoto: 'Загрузить фото',
    removePhoto: 'Удалить',
    presetAvatarsLabel: 'Или выберите готовый аватар',
    inviteOptionalLabel: 'Код или ссылка комнаты (необязательно)',
    inviteOptionalPlaceholder: 'Напр.: ZONEEU',
    enterButton: 'ВОЙТИ',
    entryPrivacyNote: 'Без email, пароля и регистрации. Временная сессия только на время общения.',
    readPrivacyPolicy: 'Политика конфиденциальности и GDPR',
    noAccountRequired: 'Мгновенная временная сессия',

    directMessages: 'Личные сообщения',
    publicRooms: 'Публичные комнаты',
    createRoom: 'Создать комнату',
    joinByCode: 'Войти по коду',
    notifications: 'Уведомления',
    channelsAndRooms: 'Каналы и комнаты',
    category: 'Категория',
    newCategory: 'Новая категория',
    renameCategory: 'Переименовать категорию',
    deleteCategory: 'Удалить категорию',
    createChannel: 'Создать канал',
    editChannel: 'Изменить канал',
    deleteChannel: 'Удалить канал',
    moveUp: 'Выше',
    moveDown: 'Ниже',
    roomSettings: 'Настройки комнаты',
    leaveRoom: 'Покинуть комнату',
    closeRoom: 'Закрыть комнату',
    copyInviteLink: 'Копировать ссылку',
    copyInviteCode: 'Копировать код',
    inviteCopied: 'Приглашение скопировано',
    inviteLinkCopied: 'Ссылка-приглашение скопирована в буфер обмена.',
    connectedInRoom: 'В голосовой комнате',
    sharingScreenBadge: 'Демонстрация экрана',
    muteMic: 'Выключить микрофон',
    unmuteMic: 'Включить микрофон',
    disconnectRoom: 'Отключиться',
    userSettings: 'Настройки',

    online: 'В сети',
    idle: 'Отошёл',
    dnd: 'Не беспокоить',
    invisible: 'Невидимый',

    membersTitle: 'Участники',
    onlineCount: 'В сети',
    offlineCount: 'Не в сети',
    ownerRole: 'Создатель',
    adminRole: 'Админ',
    memberRole: 'Участник',

    chatPlaceholder: 'Написать в',
    replyingTo: 'Ответ для',
    editedLabel: '(изм.)',
    replyAction: 'Ответить',
    editAction: 'Изменить',
    deleteAction: 'Удалить',
    saveAction: 'Сохранить',
    cancelAction: 'Отмена',
    attachFileTitle: 'Отправить временный файл (удалится через 5 мин)',
    tempFileBanner: 'Все отправленные файлы автоматически удаляются с сервера через 5 минут.',
    tempFileCountdownPrefix: 'Истекает через',
    tempFileExpiredNotice: 'Файл истёк и удалён с сервера',
    tempFilePreviewPdf: 'Просмотр PDF',
    tempFileHidePreview: 'Скрыть просмотр',
    tempFileDownload: 'Скачать',
    tempFileOpenError: 'Не удалось загрузить файл.',
    uploadingFile: 'Загрузка временного файла...',
    fileTooLarge: 'Размер файла превышает лимит 10 МБ.',
    fileNotAllowed: 'Недопустимый формат. Разрешены JPG, PNG, WEBP, MP4, WEBM, PDF и разрешённые документы.',
    uploadQuotaExceeded: 'Достигнут лимит загрузок. Дождитесь удаления предыдущих файлов.',
    typingOne: 'печатает...',
    typingMany: 'печатают...',
    emptyChatTitle: 'Начало переписки в',
    emptyChatSubtitle: 'Сообщения и файлы хранятся согласно временным правилам этой комнаты.',
    sendMessageTitle: 'Отправить сообщение',

    shareScreenBtn: 'Показать экран',
    stopScreenBtn: 'Остановить показ',
    shareGameBtn: 'Транслировать игру',
    joinAndShareGameBtn: 'Войти и показать игру (60 FPS)',
    gameModeBadge: 'Игровой режим · 60 FPS',
    screenVolumeLabel: 'Громкость экрана',
    muteStreamBtn: 'Заглушить звук экрана',
    unmuteStreamBtn: 'Включить звук экрана',
    muteOutgoingScreenAudio: 'Выкл. звук игры/экрана',
    unmuteOutgoingScreenAudio: 'Вкл. звук игры/экрана',
    noSystemAudioBadge: 'Без системного звука',
    noSystemAudioHint: 'Нет звука — выберите Вкладку или включите «Поделиться аудио»',
    screenAudioMutedBadge: 'Звук экрана выкл.',
    enableScreenAudioBtn: 'Включить звук экрана',
    voiceRoomTitle: 'Голосовой канал',
    videoRoomTitle: 'Видео и экран',
    joinRoomBtn: 'Войти в комнату',
    joinAndShareBtn: 'Войти и показать экран',
    participantsInRoom: 'участник(ов) в комнате',
    noParticipantsYet: 'Пока никого нет в комнате.',
    openInNewTab: 'Открыть в новой вкладке',
    micOn: 'Микрофон вкл.',
    micOff: 'Микрофон выкл.',
    camOn: 'Камера вкл.',
    camOff: 'Камера выкл.',
    shareScreen: 'Показать экран',
    stopShare: 'Остановить экран',
    leaveCall: 'Выйти из звонка',
    fullscreenBtn: 'ПОЛНЫЙ ЭКРАН',
    exitFullscreenBtn: 'Выйти из полного экрана',
    hideControlsBtn: 'Скрыть панель',
    showControlsBtn: 'Показать панель',
    liveScreenTitle: 'Прямая трансляция экрана',
    withSystemAudio: 'Со звуком системы',
    escHint: 'Нажмите ESC или «Выйти из полного экрана», не прерывая трансляцию',
    localYou: 'Вы',
    cameraPreview: 'Ваша камера',
    speakingNow: 'Говорит',
    participantVolume: 'Громкость',
    livekitActive: 'LiveKit SFU активен',
    webrtcDirect: 'WebRTC в реальном времени',

    createRoomTitle: 'Создать временную комнату',
    createRoomSubtitle: 'Настройте приватность, срок хранения сообщений и каналы.',
    roomNameLabel: 'Название комнаты',
    roomNamePlaceholder: 'Напр.: Европа Чат или Проект Альфа',
    roomDescLabel: 'Описание',
    roomDescPlaceholder: 'Тема общения или основной язык',
    visibilityLabel: 'Доступ к комнате',
    visibilityPublic: 'Публичная',
    visibilityPublicDesc: 'Видна в списке открытых комнат для всех посетителей.',
    visibilityPrivate: 'Приватная',
    visibilityPrivateDesc: 'Доступ только по приглашению или коду.',
    retentionLabel: 'Хранение текстовых сообщений',
    retention5m: '5 минут',
    retention15m: '15 минут',
    retention60m: '1 час',
    retentionUntilClose: 'До закрытия комнаты',
    clearOnCloseLabel: 'Стирать всю историю при закрытии комнаты',
    emblemColorLabel: 'Цвет значка',
    createRoomSubmit: 'Создать комнату',
    creating: 'Создание...',
    joinRoomTitle: 'Войти по коду или ссылке',
    joinRoomSubtitle: 'Введите код публичной или приватной комнаты.',
    inviteCodeLabel: 'Код комнаты',
    joinRoomSubmit: 'Войти',
    joining: 'Подключение...',
    publicRoomsTitle: 'Открытые публичные комнаты',
    publicRoomsSubtitle: 'Присоединяйтесь к активным комнатам прямо сейчас.',
    publicRoomsEmpty: 'Сейчас нет доступных публичных комнат.',
    joinBtn: 'Войти',
    alreadyMember: 'Вы в комнате',
    roomSettingsTitle: 'Настройки комнаты',
    inviteFriendsLabel: 'Пригласить контакты',
    inviteBtn: 'Пригласить',
    invitedBtn: 'Отправлено',
    closeRoomConfirmTitle: 'Закрыть комнату',
    closeRoomWarning: 'Закрытие комнаты отключит участников и удалит временные каналы и историю.',
    closeRoomBtn: 'Закрыть комнату сейчас',

    categoryNameLabel: 'Название категории',
    channelNameLabel: 'Название канала',
    channelTopicLabel: 'Тема / описание',
    channelTypeLabel: 'Тип канала',
    channelTypeText: 'Текст',
    channelTypeVoice: 'Голос',
    channelTypeVideo: 'Видео и экран',
    channelCategoryLabel: 'Категория',

    accountSettingsTitle: 'Настройки и сессия',
    sessionTagLabel: 'Уникальный внутренний ID',
    displayNameLabel: 'Никнейм',
    usernameLabel: 'Тег (@)',
    customStatusLabel: 'Быстрый статус',
    presenceLabel: 'Статус сети',
    bioLabel: 'О себе',
    notificationsToggle: 'Показывать уведомления о сообщениях и показах экрана',
    exitSessionBtn: 'Завершить сессию',
    saveChangesBtn: 'Сохранить',
    saving: 'Сохранение...',

    privacyPolicyTitle: 'Конфиденциальность, хранение и GDPR',
    privacyPolicySubtitle: 'Прозрачность обработки временных данных в Европе',
    privacySection1Title: '1. Сессии без регистрации и минимум данных',
    privacySection1Body:
      'ZONE работает без email, пароля, номера телефона и постоянных профилей. Каждый участник получает уникальный временный идентификатор, чтобы пользователи с одинаковыми никнеймами не путались.',
    privacySection2Title: '2. Обязательное удаление файлов через 5 минут',
    privacySection2Body:
      'Все загруженные файлы (JPG, PNG, WEBP, MP4, WEBM, PDF и разрешённые документы) автоматически удаляются физически с сервера и из базы данных через 5 минут. Старые ссылки перестают работать сразу после истечения срока.',
    privacySection3Title: '3. Согласие на камеру, микрофон и экран',
    privacySection3Body:
      'Микрофон, камера и захват экрана включаются только после явного разрешения в браузере и передаются в реальном времени без автоматической записи на сервере.',
    privacySection4Title: '4. Ограничения анонимности и технические данные',
    privacySection4Body:
      'Мы не обещаем абсолютную анонимность: инфраструктурные сервисы (хостинг, WebSocket, WebRTC/TURN или LiveKit) могут обрабатывать технические метаданные соединения, включая IP-адрес, исключительно для передачи связи.',
    closeBtn: 'Закрыть',

    mediaConsentTitle: 'Согласие на аудио и видео (GDPR)',
    mediaConsentBody:
      'При входе в голосовую/видеокомнату или показе экрана браузер запросит разрешение на передачу медиа другим участникам.',
    mediaConsentNotice:
      'Аудио и видео передаются в реальном времени без автоматической записи на сервере. Сетевые узлы (WebRTC/STUN/LiveKit) могут обрабатывать ваш технический IP-адрес во время звонка.',
    mediaConsentAccept: 'Согласиться и продолжить',
    mediaConsentDecline: 'Отмена',

    friendsAndDmsTitle: 'Контакты и личные сообщения',
    friendsOnlineTab: 'В сети',
    friendsAllTab: 'Все',
    friendsPendingTab: 'Запросы',
    friendsBlockedTab: 'Чёрный список',
    friendsAddTab: 'Добавить',
    directMessageBtn: 'Личное сообщение',
    addFriendBtn: 'Добавить контакт',
    blockBtn: 'Заблокировать',
    unblockBtn: 'Разблокировать',
    promoteAdminBtn: 'Назначить админом',
    removeAdminBtn: 'Снять права админа',
    friendRequestSent: 'Запрос отправлен.',

    selectOrCreatePrompt: 'Выберите публичную комнату, создайте свою или войдите по коду.',
    explorePublicRoomsBtn: 'Публичные комнаты',

    alertScreenStartedTitle: 'Демонстрация экрана начата',
    alertScreenStartedBody: 'начал(а) показ экрана в реальном времени.',
    alertScreenStoppedTitle: 'Демонстрация завершена',
    alertScreenStoppedBody: 'остановил(а) показ экрана.',
    alertPeerJoinedTitle: 'Вход в комнату',
    alertPeerJoinedBody: 'вошёл(ла) в',
    alertFileExpiredTitle: 'Файл удалён',
    alertFileExpiredBody: 'Срок действия файла (5 минут) истёк; он удалён с сервера.',
    alertRoomClosedTitle: 'Комната закрыта',
    alertRoomClosedBody: 'Эта временная комната была закрыта создателем.',

    onlineNowInZone: 'Онлайн в ZONE',
    inviteToRoomBtn: 'Пригласить в комнату',
    inviteSentNotice: 'Приглашение отправлено!',
    discoverParticipantsTitle: 'Участники онлайн сейчас',
    searchParticipantsPlaceholder: 'Поиск по никнейму, #TAG или @handle...',
    participantNotFound: 'Участник сейчас не найден в сети.',
    searchRoomsPlaceholder: 'Поиск публичной комнаты по названию или коду...',
    localModeBanner:
      'Локальный режим (только этот браузер): сервер WebSocket не подключён. Чтобы видеть других людей, укажите VITE_WS_URL или используйте активный сервер.',
    connectingRealtimeNotice: 'Подключение к серверу реального времени...',
    backBtn: 'Назад',
    contactsTabLabel: 'Контакты',
  },
};
