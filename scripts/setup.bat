@echo off
REM ── First-time setup: installs deps, creates .env, generates Prisma client ──
cd /d "%~dp0.."

echo(
echo === Installing dependencies (npm install) ===
call npm install
if errorlevel 1 goto :err

if not exist ".env" (
  echo(
  echo === Creating .env from .env.example ===
  copy ".env.example" ".env" >nul
  echo Created .env  ^-  now open it and fill in your values.
)

echo(
echo === Generating Prisma client ===
call npx prisma generate
if errorlevel 1 goto :err

if not exist "public" mkdir "public"
if exist "TE_LionStandalone.png" (
  copy /y "TE_LionStandalone.png" "public\logo.png" >nul
  echo Copied logo to public\logo.png
)

echo(
echo Setup complete.
echo Next: 1) edit .env   2) run scripts\db-push.bat   3) run scripts\dev.bat
goto :eof

:err
echo(
echo Setup FAILED - see the error above.
exit /b 1
