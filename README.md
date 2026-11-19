# ZONE — Temporary Social Communication

Plataforma de comunicação social temporária em tempo real sem cadastro tradicional (sem e-mail, sem senha e sem telefone), com suporte completo a **Português (pt-BR)**, **English (en)** e **Русский (ru)**, arquivos temporários com exclusão física obrigatória após **5 minutos**, voz, vídeo e compartilhamento de tela em alta definição.

## Principais Recursos

- **Entrada sem cadastro**: Escolha apelido, envie fotografia ou escolha um avatar pronto, defina o idioma e entre imediatamente com identificador interno único (`#XXXX`).
- **Salas Públicas e Privadas**: Crie salas com visibilidade pública ou privada, entre por código ou link compartilhável (`/?room=CODIGO`), configure retenção de texto (`5 min`, `15 min`, `1 hora` ou `até encerrar a sala`) e apague o histórico ao encerrar.
- **Arquivos Temporários (5 minutos)**: Envie `JPG`, `PNG`, `WEBP`, `MP4`, `WEBM`, `PDF` e documentos autorizados (máximo 10 MB). Uma rotina automática no servidor (`server.ts` / Edge Function `cleanup-temp-files`) remove fisicamente o arquivo e o registro após 5 minutos, invalidando links expirados (`410 Gone`).
- **Voz, Vídeo e Tela Cheia**: WebRTC com suporte opcional a LiveKit SFU (`/api/livekit/token`), controle individual de volume, compartilhamento de tela/janela/aba via `getDisplayMedia` e modo **TELA CHEIA** com proporção preservada (`object-contain`), controles ocultáveis e saída por `ESC`.
- **GDPR / Privacidade na Europa**: Consentimento explícito antes de ativar microfone, câmera ou tela, política de privacidade detalhada e aviso transparente sobre metadados técnicos de rede.

## Deploy no GitHub + Netlify + Backend

1. **Frontend no Netlify**:
   - Suba este repositório para o GitHub e conecte ao Netlify.
   - `netlify.toml`, `public/_redirects` e `public/_headers` já estão configurados (`npm run build`, pasta `dist`, SPA redirect e `Permissions-Policy` para `display-capture`).
   - Defina as variáveis de ambiente no Netlify (opcional se conectar a um backend externo):
     - `VITE_API_URL` (ex: `https://seu-backend.fly.dev`)
     - `VITE_WS_URL` (ex: `wss://seu-backend.fly.dev/ws`)
     - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (opcional, projeto em região EU)

2. **Backend WebSocket / Arquivos Temporários / LiveKit Token**:
   - Execute `npm start` (`node server.ts` ou `tsx server.ts`) em qualquer provedor Node na Europa (Fly.io `fra`/`ams`, Railway EU, Render Frankfurt).
   - Opcionalmente configure `LIVEKIT_URL`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` apenas no backend para escalar chamadas SFU.

3. **Supabase EU (Opcional)**:
   - Aplique `supabase/migrations/001_zone_eu.sql` e implante `supabase/functions/cleanup-temp-files/index.ts` com agendamento a cada minuto.
