# DLPocket v1.4.0

Uma grande atualização de controle, confiabilidade, diagnóstico e segurança da cadeia de distribuição.

## Qualidade real e playlists

- O seletor passa a usar somente resoluções encontradas no vídeo.
- Cada alternativa informa resolução, FPS, codec e tamanho aproximado quando disponível.
- Aviso de uso elevado de CPU para formatos que exigem conversão.
- Detecção de playlists, seleção individual, seleção total e reordenação.
- Limite configurável de 1 a 4 downloads simultâneos.
- Pausa encerra o processo preservando o arquivo parcial; continuar reutiliza o `.part` do yt-dlp.
- Ações para cancelar todos e tentar novamente.

## Autenticação, áudio e legendas

- Cookies opcionais de Chrome, Edge ou Firefox por `--cookies-from-browser`; senhas não são copiadas.
- A opção “Não usar” remove a autorização de leitura de cookies.
- Bitrate de áudio em 128, 192, 256 ou 320 kbps.
- Frequência de 44,1 ou 48 kHz, mono ou estéreo e normalização opcional.
- Capa, metadados e capítulos opcionais.
- Legendas incorporadas ou separadas em SRT/VTT, com seleção de idioma.

## Histórico e diagnóstico

- Busca e filtros por mídia e estado.
- Abrir arquivo, copiar link, baixar novamente e remover registro ou arquivo.
- Quantidade de registros e espaço utilizado.
- Diagnóstico com versões, espaço livre, diretórios e teste de conexão com GitHub.
- Exportação JSON sem senhas, cookies ou links do histórico.
- Reparo de yt-dlp, FFmpeg e FFprobe.
- Logs com rotação automática.

## Atualização e segurança

- Canais estável e beta, download em segundo plano e opção de ignorar uma versão.
- Botão “Reiniciar e atualizar”, cache validado e recuperação pela oferta da atualização caso a instalação não conclua.
- Testes automatizados de filtros, codecs, progresso, temas, responsividade e controles.
- Auditoria de dependências sem vulnerabilidades conhecidas no momento do build.
- SBOM CycloneDX, SHA-256 e atestação criptográfica de proveniência do GitHub.
- GitHub Actions oficiais fixadas por SHA.
- Build preparado para Authenticode por `CSC_LINK` e `CSC_KEY_PASSWORD`.

## Assinatura Authenticode

Esta Release somente será assinada com Authenticode quando um certificado válido for configurado nos secrets `CSC_LINK` e `CSC_KEY_PASSWORD`. Sem essas credenciais, o instalador permanece sem assinatura e o SmartScreen pode exibir um aviso.
