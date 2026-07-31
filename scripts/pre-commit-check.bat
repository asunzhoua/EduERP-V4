@echo off
rem ================================================================
rem pre-commit-check.bat - EduERP-V4 pre-commit security check (Windows)
rem
rem Usage:
rem   scripts\pre-commit-check.bat            check staged files (default)
rem   scripts\pre-commit-check.bat --All      check whole working tree
rem   scripts\pre-commit-check.bat <path...>  check specific files/dirs
rem
rem Exit code: 0 = PASS / 1 = FAIL / 2 = usage error
rem Core logic lives in scripts\pre-commit-check.ps1
rem ================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pre-commit-check.ps1" %*
exit /b %ERRORLEVEL%
