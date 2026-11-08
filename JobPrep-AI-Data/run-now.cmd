@echo off
rem Double-click to process the next part of the books right now (same as the daily task).
cd /d "%~dp0scripts"
node daily-run.mjs
pause
