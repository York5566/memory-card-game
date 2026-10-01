@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "webNodeExe=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "webNodeExe=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo 找不到 Node.js。請先安裝 Node.js 22 或以上，再重新開啟本檔案。
    echo 詳細操作請看 README.md。
    pause
    exit /b 1
  )
)
set "webPreviewPort=4173"
if defined PORT set "webPreviewPort=%PORT%"
echo 本機預覽網址：http://127.0.0.1:%webPreviewPort%/games/memory/
echo 保持此視窗開啟；停止預覽請按 Ctrl+C。
"%webNodeExe%" scripts\serve.mjs
if errorlevel 1 pause
