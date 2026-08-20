//go:build windows

package main

import (
    "archive/zip"
    "crypto/sha256"
    "embed"
    "encoding/hex"
    "errors"
    "fmt"
    "io"
    "io/fs"
    "net/http"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "syscall"
    "time"
    "unsafe"
)

const (
    appVersion      = "1.0.0"
    electronVersion = "43.4.1"
    electronZipName = "electron-v43.4.1-win32-x64.zip"
)

var (
    //go:embed app/**
    appFiles embed.FS

    user32          = syscall.NewLazyDLL("user32.dll")
    messageBoxWProc = user32.NewProc("MessageBoxW")
)

func utf16Ptr(s string) *uint16 {
    p, _ := syscall.UTF16PtrFromString(s)
    return p
}

func messageBox(title, message string, flags uintptr) {
    messageBoxWProc.Call(
        0,
        uintptr(unsafe.Pointer(utf16Ptr(message))),
        uintptr(unsafe.Pointer(utf16Ptr(title))),
        flags,
    )
}

func download(url, destination string) error {
    client := &http.Client{Timeout: 20 * time.Minute}
    req, err := http.NewRequest(http.MethodGet, url, nil)
    if err != nil {
        return err
    }
    req.Header.Set("User-Agent", "DLPocket-Portable/"+appVersion)

    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        return fmt.Errorf("HTTP %d ao baixar %s", resp.StatusCode, url)
    }

    tmp := destination + ".part"
    _ = os.Remove(tmp)
    out, err := os.Create(tmp)
    if err != nil {
        return err
    }
    _, copyErr := io.Copy(out, resp.Body)
    closeErr := out.Close()
    if copyErr != nil {
        _ = os.Remove(tmp)
        return copyErr
    }
    if closeErr != nil {
        _ = os.Remove(tmp)
        return closeErr
    }
    _ = os.Remove(destination)
    return os.Rename(tmp, destination)
}

func downloadText(url string) (string, error) {
    client := &http.Client{Timeout: 2 * time.Minute}
    req, err := http.NewRequest(http.MethodGet, url, nil)
    if err != nil {
        return "", err
    }
    req.Header.Set("User-Agent", "DLPocket-Portable/"+appVersion)
    resp, err := client.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()
    if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        return "", fmt.Errorf("HTTP %d ao obter checksums", resp.StatusCode)
    }
    b, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
    return string(b), err
}

func expectedChecksum(text, filename string) (string, error) {
    for _, line := range strings.Split(text, "\n") {
        fields := strings.Fields(strings.TrimSpace(line))
        if len(fields) < 2 {
            continue
        }
        name := strings.TrimPrefix(fields[len(fields)-1], "*")
        if filepath.Base(name) == filename && len(fields[0]) == 64 {
            return strings.ToLower(fields[0]), nil
        }
    }
    return "", fmt.Errorf("checksum de %s não encontrado", filename)
}

func fileSHA256(path string) (string, error) {
    f, err := os.Open(path)
    if err != nil {
        return "", err
    }
    defer f.Close()
    h := sha256.New()
    if _, err := io.Copy(h, f); err != nil {
        return "", err
    }
    return hex.EncodeToString(h.Sum(nil)), nil
}

func unzip(zipPath, destination string) error {
    r, err := zip.OpenReader(zipPath)
    if err != nil {
        return err
    }
    defer r.Close()

    cleanRoot, err := filepath.Abs(destination)
    if err != nil {
        return err
    }
    if err := os.MkdirAll(cleanRoot, 0o755); err != nil {
        return err
    }

    for _, file := range r.File {
        target := filepath.Join(cleanRoot, file.Name)
        cleanTarget, err := filepath.Abs(target)
        if err != nil {
            return err
        }
        if cleanTarget != cleanRoot && !strings.HasPrefix(cleanTarget, cleanRoot+string(os.PathSeparator)) {
            return errors.New("arquivo ZIP contém caminho inseguro")
        }
        if file.FileInfo().IsDir() {
            if err := os.MkdirAll(cleanTarget, 0o755); err != nil {
                return err
            }
            continue
        }
        if err := os.MkdirAll(filepath.Dir(cleanTarget), 0o755); err != nil {
            return err
        }
        src, err := file.Open()
        if err != nil {
            return err
        }
        dst, err := os.OpenFile(cleanTarget, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
        if err != nil {
            src.Close()
            return err
        }
        _, copyErr := io.Copy(dst, src)
        src.Close()
        dst.Close()
        if copyErr != nil {
            return copyErr
        }
    }
    return nil
}

func writeEmbeddedApp(destination string) error {
    _ = os.RemoveAll(destination)
    if err := os.MkdirAll(destination, 0o755); err != nil {
        return err
    }

    return fs.WalkDir(appFiles, "app", func(path string, entry fs.DirEntry, walkErr error) error {
        if walkErr != nil {
            return walkErr
        }
        if path == "app" {
            return nil
        }
        rel, err := filepath.Rel("app", path)
        if err != nil {
            return err
        }
        target := filepath.Join(destination, filepath.FromSlash(rel))
        if entry.IsDir() {
            return os.MkdirAll(target, 0o755)
        }
        data, err := appFiles.ReadFile(path)
        if err != nil {
            return err
        }
        if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
            return err
        }
        return os.WriteFile(target, data, 0o644)
    })
}

func ensureElectron(runtimeDir, workDir string) error {
    electronExe := filepath.Join(runtimeDir, "electron.exe")
    if _, err := os.Stat(electronExe); err == nil {
        return nil
    }

    messageBox(
        "DLPocket — primeira execução",
        "O DLPocket precisa preparar o Electron oficial uma única vez.\n\nClique em OK e mantenha a internet conectada. O aplicativo abrirá automaticamente quando terminar.",
        0x00000040,
    )

    if err := os.RemoveAll(runtimeDir); err != nil {
        return err
    }
    if err := os.MkdirAll(runtimeDir, 0o755); err != nil {
        return err
    }
    if err := os.MkdirAll(workDir, 0o755); err != nil {
        return err
    }

    baseURL := "https://github.com/electron/electron/releases/download/v" + electronVersion + "/"
    sums, err := downloadText(baseURL + "SHASUMS256.txt")
    if err != nil {
        return err
    }
    expected, err := expectedChecksum(sums, electronZipName)
    if err != nil {
        return err
    }

    zipPath := filepath.Join(workDir, electronZipName)
    if err := download(baseURL+electronZipName, zipPath); err != nil {
        return err
    }
    actual, err := fileSHA256(zipPath)
    if err != nil {
        return err
    }
    if !strings.EqualFold(expected, actual) {
        _ = os.Remove(zipPath)
        return errors.New("a verificação SHA-256 do Electron falhou")
    }
    if err := unzip(zipPath, runtimeDir); err != nil {
        return err
    }
    _ = os.Remove(zipPath)
    if _, err := os.Stat(electronExe); err != nil {
        return errors.New("electron.exe não foi encontrado após a extração")
    }
    return nil
}

func run() error {
    localAppData := os.Getenv("LOCALAPPDATA")
    if localAppData == "" {
        var err error
        localAppData, err = os.UserCacheDir()
        if err != nil {
            return err
        }
    }

    root := filepath.Join(localAppData, "DLPocket", "Portable", appVersion)
    runtimeDir := filepath.Join(root, "runtime")
    appDir := filepath.Join(root, "app")
    workDir := filepath.Join(root, "tmp")

    if err := ensureElectron(runtimeDir, workDir); err != nil {
        return fmt.Errorf("não foi possível preparar o Electron: %w", err)
    }
    if err := writeEmbeddedApp(appDir); err != nil {
        return fmt.Errorf("não foi possível preparar os arquivos do DLPocket: %w", err)
    }

    cmd := exec.Command(filepath.Join(runtimeDir, "electron.exe"), appDir)
    cmd.Dir = runtimeDir
    cmd.Env = append(os.Environ(), "DLPOCKET_PORTABLE=1")
    if err := cmd.Start(); err != nil {
        return fmt.Errorf("não foi possível abrir o DLPocket: %w", err)
    }
    return nil
}

func main() {
    if err := run(); err != nil {
        messageBox(
            "DLPocket — erro",
            "O DLPocket não pôde ser iniciado.\n\n"+err.Error()+"\n\nVerifique sua conexão com a internet e tente novamente.",
            0x00000010,
        )
    }
}
