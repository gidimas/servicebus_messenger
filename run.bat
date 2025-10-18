@echo off
title Azure Service Bus Messenger
color 0A

echo ========================================
echo   Azure Service Bus Messenger
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo This application requires Node.js to run.
    echo.

    REM Check if winget is available
    where winget >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Would you like to:
        echo   1. Install Node.js using winget (automatic)
        echo   2. Download manually from nodejs.org
        echo   3. Exit
        echo.
        choice /C 123 /N /M "Enter your choice (1, 2, or 3): "
        if errorlevel 3 goto :eof
        if errorlevel 2 (
            echo.
            echo Opening Node.js download page...
            start https://nodejs.org/
            echo.
            echo Please install Node.js and run this script again.
            pause
            goto :eof
        )
        if errorlevel 1 (
            echo.
            echo Installing Node.js via winget...
            echo This may take a few minutes...
            echo.
            winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
            if %ERRORLEVEL% EQU 0 (
                echo.
                echo [SUCCESS] Node.js installed successfully!
                echo.
                echo Restarting application...
                timeout /t 2 /nobreak >nul
                start "" "%~f0"
                exit
            ) else (
                echo.
                echo [ERROR] Installation failed. Please try manual installation.
                start https://nodejs.org/
                pause
                goto :eof
            )
        )
    ) else (
        echo Winget is not available on this system.
        echo Would you like to:
        echo   1. Download and install Node.js manually
        echo   2. Exit
        echo.
        choice /C 12 /N /M "Enter your choice (1 or 2): "
        if errorlevel 2 goto :eof
        if errorlevel 1 (
            echo.
            echo Opening Node.js download page...
            start https://nodejs.org/
            echo.
            echo Please install Node.js and run this script again.
            pause
            goto :eof
        )
    )
)

echo [OK] Node.js is installed
echo.

REM Check if npm is available
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found!
    echo Please reinstall Node.js from https://nodejs.org/
    pause
    goto :eof
)

echo [OK] npm is installed
echo.
echo Starting server...
echo Opening browser at http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start server from current directory
start http://localhost:5000
npx -y serve -s . -p 5000

pause
