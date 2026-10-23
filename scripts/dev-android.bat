@echo off
setlocal

REM ---------------------------------------------------------------------------
REM Launch the Billion dev servers and open the installed development build on a
REM USB-connected Android phone.
REM
REM Usage:  scripts\dev-android.bat [rebuild]
REM
REM Steps:
REM   1. Checks node, pnpm, adb, and that a device is attached.
REM   2. Warns when the installed development build predates the app version in
REM      apps\expo\app.config.base.json. A stale binary cannot run the current
REM      JS bundle: it launches and then dies with "Cannot find native module"
REM      or an expo-router error. Pass "rebuild" (or run pnpm android) to
REM      replace it.
REM   3. Starts the Next.js API on port 3000 with the webpack compiler. This
REM      checkout cannot use Turbopack for development: its next/font/google
REM      handling fails to resolve the internal font module, which turns every
REM      route - tRPC included - into a 500, so the app loads no data.
REM   4. Starts Metro and opens the development build on the phone.
REM
REM Notes:
REM   - The phone reaches the API over the LAN address Metro reports, because
REM     apps\expo\.env.local keeps EXPO_PUBLIC_API_URL empty for auto-detection.
REM     If the phone cannot reach this machine, use a tunnel instead
REM     (docs/localtunnel.md).
REM   - Building the dev client on Windows also needs ninja 1.12 or newer. The
REM     ninja 1.10 that ships with the Android SDK CMake cannot stat the
REM     >260 character paths pnpm's isolated store produces and fails with
REM     "ninja: error: manifest 'build.ninja' still dirty after 100 tries".
REM ---------------------------------------------------------------------------

cd /d "%~dp0.."
set "ROOT=%CD%"
set "APP_ID=app.billionnews.billion"

echo.
echo === Billion Android dev launcher ===
echo.

REM --- adb -------------------------------------------------------------------
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
where adb >nul 2>&1 && set "ADB=adb"
if not exist "%ADB%" if /i not "%ADB%"=="adb" (
  echo [x] adb not found. Install the Android SDK platform tools or put adb on PATH.
  exit /b 1
)

REM --- toolchain -------------------------------------------------------------
where node >nul 2>&1 || (echo [x] node is not on PATH. & exit /b 1)
where pnpm >nul 2>&1 || (echo [x] pnpm is not on PATH. & exit /b 1)

if not exist "%ROOT%\node_modules\.modules.yaml" (
  echo [*] Workspace dependencies are missing. Running pnpm install ...
  call pnpm install || (echo [x] pnpm install failed. & exit /b 1)
)

REM --- device ----------------------------------------------------------------
set "DEVICE="
for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices') do (
  if "%%e"=="device" set "DEVICE=%%d"
)
if "%DEVICE%"=="" (
  echo [x] No Android device found. Connect the phone over USB, enable USB
  echo     debugging, and accept the debugging prompt on the phone.
  echo     Check with: %ADB% devices
  exit /b 1
)
echo [*] Device: %DEVICE%

REM --- native build freshness ------------------------------------------------
for /f "delims=" %%v in ('node -p "require('./apps/expo/app.config.base.json').version"') do set "EXPECTED=%%v"
REM dumpsys output goes through a file: piping it through for /f mis-parses the
REM nested quoting on Windows.
set "PKG_INFO=%TEMP%\billion-package-%RANDOM%.txt"
"%ADB%" shell dumpsys package %APP_ID% > "%PKG_INFO%" 2>nul
set "INSTALLED="
for /f "tokens=2 delims==" %%v in ('findstr /C:"versionName=" "%PKG_INFO%" 2^>nul') do set "INSTALLED=%%v"
set "INSTALLED=%INSTALLED: =%"
del "%PKG_INFO%" >nul 2>&1

if "%INSTALLED%"=="" (
  echo [warn] %APP_ID% is not installed on the phone.
  set "REBUILD=1"
) else (
  echo "%INSTALLED%" | findstr /C:"%EXPECTED%" >nul || (
    echo [warn] Installed development build is %INSTALLED% but the app version is %EXPECTED%.
    set "REBUILD=1"
  )
)

if /i "%~1"=="rebuild" set "REBUILD=1"

if defined REBUILD (
  echo [warn] A native build is needed before the current JS can run.
  if /i "%~1"=="rebuild" (
    echo [*] Building and installing the development client. This takes a few
    echo     minutes the first time.
    call pnpm android || (echo [x] pnpm android failed. & exit /b 1)
  ) else (
    echo     Re-run as: scripts\dev-android.bat rebuild
    echo     Continuing with the installed binary, which may crash on launch.
  )
)

REM --- API -------------------------------------------------------------------
echo [*] Starting the API on http://localhost:3000
start "billion api" /D "%ROOT%" cmd /k "pnpm --filter @acme/nextjs exec next dev --webpack"

set "API_OK="
where curl >nul 2>&1 && (
  echo [*] Waiting for the API to answer ...
  for /l %%i in (1,1,30) do (
    if not defined API_OK (
      curl -s -o NUL -f --max-time 5 http://127.0.0.1:3000/ >nul 2>&1 && set "API_OK=1"
      if not defined API_OK timeout /t 2 /nobreak >nul
    )
  )
)
if not defined API_OK echo [warn] The API did not answer yet. Check the "billion api" window.

echo [*] Starting Metro and opening the app on %DEVICE%
start "billion metro" /D "%ROOT%" cmd /k "pnpm --filter @acme/expo dev:android"

echo.
echo [ok] API and Metro are starting in their own windows.
echo      Phone: %DEVICE%   API: http://localhost:3000   Metro: http://localhost:8081
echo      Reload JS with "r" in the Metro window; press a=reload, j=debugger.
echo.
endlocal
