# DLPocket v1.0.0

Primeira versão pública do DLPocket, uma interface desktop simples para yt-dlp criada com Electron.

## Destaques

- Cole um link e escolha entre download de vídeo ou extração de áudio.
- Vídeo: MP4, MKV e WebM.
- Áudio: MP3, M4A, WAV, FLAC e Opus.
- Pastas automáticas `Downloads\DLPocket\Vídeo` e `Downloads\DLPocket\Áudio`.
- Progresso, velocidade, ETA, cancelamento e abertura rápida da pasta.
- Preparação automática de yt-dlp, FFmpeg e FFprobe.
- Verificação SHA-256 dos componentes externos baixados.
- Runtime JavaScript do Electron/Node utilizado pelo yt-dlp para suporte atual ao YouTube.
- Renderer isolado com `contextIsolation`, `sandbox` e `nodeIntegration: false`.
- Instalador NSIS automatizado por GitHub Actions em tags `v*`.
- Ícone próprio no aplicativo, atalhos e instalador.
- Instalador com termos em português, inglês e russo.
- Tema claro ou escuro selecionado automaticamente conforme o Windows.

## Windows

A v1.0.0 é voltada para Windows 10/11 x64.

## Aviso

Use o DLPocket apenas para mídias que você tenha direito ou autorização para baixar.
