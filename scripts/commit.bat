@echo off
REM ── Stage everything and commit. Usage:  scripts\commit.bat "your message" ──
cd /d "%~dp0.."
if "%~1"=="" (
  echo Usage: scripts\commit.bat "commit message"
  exit /b 1
)
git add -A
git commit -m "%~1"
