@echo off
REM ── Run the validation engine tests ──
cd /d "%~dp0.."
call npm run test:validation
