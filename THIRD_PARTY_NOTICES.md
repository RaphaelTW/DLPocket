# Third-party notices

DLPocket is an independent graphical interface. The DLPocket source code is licensed under the MIT License.

## yt-dlp

DLPocket downloads the official Windows executable of yt-dlp on first use from:

- https://github.com/yt-dlp/yt-dlp

The yt-dlp source project is published under The Unlicense. Official PyInstaller release executables include third-party components under additional licenses, including GPL-3.0-or-later components. See the yt-dlp repository and the `THIRD_PARTY_LICENSES.txt` shipped by that project for the authoritative notices.

DLPocket does not modify yt-dlp and does not include the yt-dlp executable in this source repository. The app verifies the downloaded executable against the official `SHA2-256SUMS` file before use.

## FFmpeg

DLPocket downloads a Windows FFmpeg build on first use from the BtbN/FFmpeg-Builds releases used/recommended in the yt-dlp ecosystem:

- https://github.com/BtbN/FFmpeg-Builds
- https://ffmpeg.org/

FFmpeg licensing depends on the selected build and enabled components. DLPocket currently downloads a GPL build. Refer to the FFmpeg project and the downloaded build for the authoritative license terms.

DLPocket does not include FFmpeg binaries in this source repository. The app verifies the downloaded archive against the official `checksums.sha256` file before extraction.

## Electron

Electron is licensed under the MIT License:

- https://github.com/electron/electron

## Important

Third-party names and trademarks belong to their respective owners. DLPocket is not affiliated with YouTube, Google, yt-dlp, FFmpeg, Electron, or their maintainers.
