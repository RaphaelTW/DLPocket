# DLPocket

> Uma interface desktop simples para o **yt-dlp**, feita em Electron, pensada para quem quer baixar vídeo ou extrair áudio sem usar terminal.

DLPocket transforma o fluxo tradicional de comandos do `yt-dlp` em uma interface gráfica direta: cole um link, escolha **Vídeo** ou **Áudio**, selecione o formato e inicie o download.

## ✨ Principais recursos

- Interface limpa, simples e responsiva.
- Download de vídeo em **MP4**, **MKV**, **WebM**, **MOV**, **AVI** e **FLV**.
- Extração de áudio em **MP3**, **M4A**, **WAV**, **FLAC**, **Opus**, **AAC**, **ALAC** e **Vorbis/OGG**.
- Preparação automática do **yt-dlp** e **FFmpeg** no primeiro uso.
- Verificação **SHA-256** dos binários baixados antes da utilização.
- Não exige que o usuário final rode `winget`, PowerShell ou Prompt de Comando.
- Progresso do download em tempo real.
- Velocidade e ETA quando fornecidos pelo yt-dlp.
- Cancelamento de download em andamento.
- Botão para abrir rapidamente a pasta de destino.
- Renderer Electron isolado, sem acesso direto ao Node.js.
- Verificação e download seguro de novas versões com validação SHA-256.
- Pré-visualização com título, thumbnail, duração e tamanho estimado.
- Qualidade automática, 720p, 1080p, 1440p ou 4K, com seleção de FPS e codec.
- Progresso geral dividido entre vídeo, áudio, mesclagem e conversão.
- Atualização automática ou manual do yt-dlp com validação SHA-256.
- Configurações persistentes de tema, idioma, qualidade, formato e comportamento final.
- Interface em português, inglês, russo e espanhol.
- Histórico persistente com opção para limpar downloads concluídos.
- Tema claro inspirado no GNOME/Adwaita, com contraste consistente mesmo quando o Windows está no modo escuro.
- Downloads organizados automaticamente em:

```text
Downloads/
└── DLPocket/
    ├── Vídeo/
    └── Áudio/
```

## 🖥️ Plataforma da v1.0.0

- Windows 10/11
- Arquitetura x64

A arquitetura do projeto permite expansão futura para Linux e macOS, mas a preparação automática dos binários na v1.0.0 foi desenhada para Windows x64.

## 🚀 Como usar

1. Abra o DLPocket.
2. Cole o link da mídia.
3. Escolha **Vídeo** ou **Áudio**.
4. Escolha o formato desejado.
5. Clique em **Baixar vídeo** ou **Baixar áudio**.
6. Na primeira utilização, o DLPocket prepara automaticamente os componentes necessários.
7. O arquivo final será salvo em `Downloads\\DLPocket\\Vídeo` ou `Downloads\\DLPocket\\Áudio`.

> Use o aplicativo somente para conteúdo que você tenha direito ou autorização para baixar. Respeite direitos autorais, termos de serviço e legislação aplicável.

## 🧩 Como funciona

O DLPocket não implementa um downloader próprio. Ele fornece uma camada gráfica segura sobre o `yt-dlp`.

Projeto oficial utilizado: [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp).

O processo principal do Electron:

1. valida o link recebido da interface;
2. garante que yt-dlp, FFmpeg e FFprobe estejam disponíveis;
3. monta os argumentos usando uma lista permitida de formatos;
4. executa o yt-dlp por `spawn`, sem concatenar comandos fornecidos pelo usuário;
5. envia progresso e resultado para o renderer através de IPC controlado.

Para suporte atual do YouTube, o yt-dlp também precisa de um runtime JavaScript externo. O DLPocket reutiliza o runtime Node incluído no próprio Electron ao chamar o yt-dlp.

## 🔐 Segurança do Electron

A janela principal utiliza:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Content Security Policy restritiva
- bloqueio de novas janelas
- bloqueio de navegação remota
- IPC com API limitada via `contextBridge`
- validação de URL HTTP/HTTPS
- formatos definidos por allowlist
- execução do yt-dlp com argumentos separados, sem shell de usuário

## 📦 Componentes externos

Na primeira utilização, o programa baixa:

- `yt-dlp.exe` do repositório oficial `yt-dlp/yt-dlp`;
- FFmpeg/FFprobe dos releases `BtbN/FFmpeg-Builds`.

Eles são armazenados dentro da pasta de dados do aplicativo, e não dentro da pasta de Downloads. Antes do uso, o DLPocket compara o SHA-256 dos downloads com os arquivos de checksum publicados oficialmente por cada projeto.

Consulte [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) para informações de licenciamento.

## 🛠️ Desenvolvimento

### Requisitos

- Node.js 22 ou superior
- npm
- Windows 10/11 para testar a preparação automática completa e gerar o instalador Windows

### Instalar dependências

```powershell
npm install
```

### Executar em desenvolvimento

```powershell
npm start
```

### Validar JavaScript

```powershell
npm run check
```

### Gerar a pasta empacotada do Windows

```powershell
npm run pack:win
```

### Executável portátil de teste

A release v1.0.0 também pode ser distribuída como `DLPocket-Portable-1.0.0.exe`. Esse executável é um bootstrapper Windows x64: no primeiro uso ele baixa o runtime oficial do Electron 43.4.1, valida o `SHASUMS256.txt` e abre a aplicação sem exigir terminal.

> Para distribuição pública, prefira o instalador NSIS gerado pelo `electron-builder` e considere assinatura de código (Authenticode) para reduzir alertas do Windows SmartScreen.

### Gerar o instalador `.exe`

```powershell
npm run dist:win
```

O instalador será criado em:

```text
dist/DLPocket-Setup-1.0.0.exe
```

O instalador usa o ícone oficial do DLPocket, permite escolher a pasta de instalação
e apresenta a licença MIT em português, inglês ou russo. A interface acompanha
automaticamente o tema claro ou escuro configurado no Windows.

Desde a v1.1.0, o DLPocket também verifica novas versões no GitHub. Quando uma
atualização está disponível, o aplicativo pede confirmação, mostra o progresso do
download e valida o SHA-256 antes de abrir o instalador salvo em
`Downloads\DLPocket\Atualizações`.

## 📌 Versões fixadas na v1.0.0

- Electron: `43.4.1`
- electron-builder: `26.15.7`
- Node.js para desenvolvimento/CI: `22+`

## 🏷️ Tag e Release

### Opção recomendada — GitHub Actions

Depois de commitar a versão:

```powershell
git tag -a v1.0.0 -m "DLPocket v1.0.0"
git push origin v1.0.0
```

O workflow `.github/workflows/release.yml` irá:

1. instalar as dependências;
2. validar o JavaScript;
3. gerar `DLPocket-Setup-1.0.0.exe` em um runner Windows;
4. criar ou atualizar a Release `v1.0.0`;
5. anexar o `.exe` automaticamente.

### Script local

Também existe:

```powershell
.\scripts\release.ps1 -Version "1.0.0"
```

### Release manual com GitHub CLI

```powershell
npm install
npm run dist:win

git tag -a v1.0.0 -m "DLPocket v1.0.0"
git push origin v1.0.0

gh release create v1.0.0 `
  "dist/DLPocket-Setup-1.0.0.exe" `
  --title "DLPocket v1.0.0" `
  --generate-notes
```

## 🗂️ Estrutura do projeto

```text
DLPocket/
├── .github/
│   └── workflows/
│       └── release.yml
├── assets/
│   ├── icon.ico
│   └── icon.svg
├── scripts/
│   └── release.ps1
├── tools/
│   └── portable-bootstrap/
│       ├── app/
│       ├── build.ps1
│       ├── go.mod
│       ├── main_windows.go
│       └── README.md
├── src/
│   ├── main.js
│   ├── preload.js
│   └── renderer/
│       ├── index.html
│       ├── renderer.js
│       └── styles.css
├── .gitignore
├── LICENSE
├── package.json
├── README.md
└── THIRD_PARTY_NOTICES.md
```

## 📄 Licença

O código-fonte do **DLPocket** é disponibilizado sob a **MIT License**.

Essa licença se aplica ao código do DLPocket. `yt-dlp`, FFmpeg, Electron e demais componentes externos continuam sujeitos às próprias licenças.

## ⚠️ Aviso legal

DLPocket é uma interface independente e não é afiliado ao YouTube, Google, yt-dlp, FFmpeg ou Electron.

O usuário é responsável por verificar se possui permissão para baixar e armazenar o conteúdo desejado.
