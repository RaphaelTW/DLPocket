# DLPocket Portable Bootstrapper

Utilitário auxiliar da v1.0.0 para gerar um executável Windows x64 pequeno que prepara o Electron oficial na primeira execução e inicia o DLPocket sem terminal.

O bootstrapper valida o pacote do Electron com `SHASUMS256.txt` antes de extraí-lo em `%LOCALAPPDATA%\DLPocket\Portable\1.0.0`.

Este bootstrapper não substitui o instalador NSIS oficial. O artefato recomendado para releases públicas é `DLPocket-Setup-<versão>.exe`, gerado pelo workflow do GitHub Actions.

Para recompilar o bootstrapper é necessário Go 1.23+ e o conteúdo em `app/` deve refletir a versão do aplicativo que será embutida.
