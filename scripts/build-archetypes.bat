@echo off
REM ── Build data\archetypes.json from last year's tourplay export ──
REM Drop tourplay_rosters.json in the repo root first (or pass a path as arg 1).
cd /d "%~dp0.."
node scripts\build-archetypes.mjs %1
