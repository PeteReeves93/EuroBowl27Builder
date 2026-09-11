@echo off
REM ── Sync the Prisma schema to your database, then seed default settings ──
cd /d "%~dp0.."
call npx prisma db push
if errorlevel 1 goto :err
call npm run db:seed
goto :eof
:err
echo db push FAILED - check DATABASE_URL in .env
exit /b 1
