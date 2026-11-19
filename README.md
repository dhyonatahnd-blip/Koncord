# Vesper — Plataforma de Comunicação em Tempo Real

Aplicação web completa de comunicação com salas de texto, voz, vídeo WebRTC, compartilhamento de tela em modo **Tela Cheia**, comunidades configuráveis, mensagens diretas e **Modo Instantâneo (sem conta e sem banco de dados)**.

## Publicação no GitHub

```bash
git init
git add .
git commit -m "chore: prepare Vesper for GitHub and Netlify"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

## Publicação no Netlify

O repositório já inclui `netlify.toml`, `public/_redirects` e `public/_headers` configurados automaticamente:

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Headers**: inclui `Permissions-Policy: display-capture=*, microphone=*, camera=*, fullscreen=*` para liberar captura de tela, áudio, câmera e tela cheia.

### Passos no Netlify
1. Acesse o painel do Netlify e selecione **Add new site → Import an existing project** conectado ao seu repositório no GitHub (ou faça upload manual da pasta `dist/` após rodar `npm run build`).
2. As configurações de build serão lidas automaticamente de `netlify.toml`.
3. Se usar login com **Google / E-mail (Firebase)**, adicione o domínio gerado pelo Netlify (ex.: `seu-site.netlify.app`) em:
   **Firebase Console → Authentication → Settings → Authorized domains**.

### Comunicação entre múltiplos dispositivos no Modo Instantâneo / WebRTC (Opcional)
Como o Netlify hospeda arquivos estáticos (sem servidor WebSocket persistente), o modo estático ativa automaticamente sincronização local via navegador (`BroadcastChannel`).

Para conectar **vários computadores/dispositivos diferentes** no Modo Instantâneo e na sinalização WebRTC de voz/vídeo/tela usando o site no Netlify:
1. Hospede o arquivo `server.ts` em um serviço Node.js com suporte a WebSocket (ex.: Render, Railway ou Fly.io) usando o comando `npm start`.
2. Nas variáveis de ambiente do Netlify (**Site configuration → Environment variables**), defina:
   `VITE_WS_URL=wss://SEU-SERVIDOR.onrender.com/ws`
3. Faça um novo deploy no Netlify.

## Desenvolvimento Local

```bash
npm install
npm run dev
```

O servidor local iniciará na porta `3000` com interface React + Vite e sinalização WebSocket integrada em `/ws`.
