@echo off
setlocal
cd /d "%~dp0"
title Jungle Digits - React Website
echo Open http://127.0.0.1:5173 in your browser.
call npm.cmd run dev -- --port 5173
pause