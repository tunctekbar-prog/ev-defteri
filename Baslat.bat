@echo off
chcp 65001 >nul
title Butce Dostum
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js bulunamadi.
  echo  https://nodejs.org adresinden "LTS" surumunu indirip kurun,
  echo  sonra bu dosyaya tekrar cift tiklayin.
  echo.
  start "" https://nodejs.org
  pause
  exit /b
)

echo.
echo  Butce Dostum baslatiliyor...
echo  Tarayici birazdan kendiliginden acilacak.
echo  Kapatmak icin bu pencereyi kapatin.
echo.

rem Sunucu hazir olunca tarayiciyi ac
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173"
node server.js
pause
