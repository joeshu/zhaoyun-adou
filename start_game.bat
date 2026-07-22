@echo off
cd /d %~dp0
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js not found. Please install Node.js and add it to PATH.
  pause
  exit /b 1
)
netstat -ano | findstr ":8384" >nul 2>nul
if %errorlevel%==0 (
  echo Server already running on port 8384, opening browser...
) else (
  echo Starting Zhao Yun local server...
  start "" node server.js
  timeout /t 2 >nul
)
start "" http://localhost:8384/
