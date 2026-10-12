@echo off
cd /d "%~dp0"
if not exist "cloudflare\node_modules\miniflare" (
  echo Installing local Cloudflare preview dependencies...
  pushd cloudflare
  call npm ci
  if errorlevel 1 (popd & pause & exit /b 1)
  popd
)
node scripts\pk-preview.mjs
pause
