@echo off
REM Batch file to stop the AI Engine server
REM This calls the PowerShell script to stop the application

echo Stopping AI Engine server...

REM Check if PowerShell is available
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: PowerShell is not available on this system
    pause
    exit /b 1
)

REM Execute the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0stop-server.ps1"

REM Check if the script executed successfully
if %errorlevel% equ 0 (
    echo Server stopped successfully!
) else (
    echo Failed to stop server. Exit code: %errorlevel%
)

pause