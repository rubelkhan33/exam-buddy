@echo off
rem Double-click once to make Windows run the book pipeline every day at 2:30 PM
rem (after Google's free Gemini quota resets). Remove later with:  schtasks /Delete /TN "JobPrep AI daily OCR" /F
setlocal
set "SCRIPTS=%~dp0scripts"
for /f "delims=" %%i in ('where node') do if not defined NODE set "NODE=%%i"
if not defined NODE (
  echo Node.js not found. Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
schtasks /Create /SC DAILY /ST 14:30 /TN "JobPrep AI daily OCR" /TR "cmd /c cd /d \"%SCRIPTS%\" && \"%NODE%\" daily-run.mjs >> ..\daily-run.out.txt 2>&1" /F
if errorlevel 1 (
  echo Could not create the task.
) else (
  echo.
  echo Done. Every day at 2:30 PM the next part of the books is processed and pushed to GitHub.
  echo Progress is written to JobPrep-AI-Data\daily-run.log
)
pause
