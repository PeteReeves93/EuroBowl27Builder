@echo off
REM ── One-time: initialise the git repo and make the first commit ──
REM   Personal project => GitHub. After running this, create an empty GitHub
REM   repo and run:  git remote add origin <url>  &&  git push -u origin main
cd /d "%~dp0.."

git rev-parse --is-inside-work-tree >nul 2>&1
if not errorlevel 1 (
  echo Git repo already initialised here.
  goto :eof
)

git init
git branch -M main
git add -A
git commit -m "Initial scaffold: Next.js + Prisma + Discord auth, NAF WC 2027 v2.1 rulepack"
echo(
echo Repo created. Now:
echo   1) Create an empty repo on GitHub (no README/gitignore)
echo   2) git remote add origin https://github.com/^<you^>/EuroBowl27Builder.git
echo   3) git push -u origin main
