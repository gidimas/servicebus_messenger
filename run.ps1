# Azure Service Bus Messenger Launcher
# Run with: powershell -ExecutionPolicy Bypass -File run.ps1

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$host.UI.RawUI.WindowTitle = "Azure Service Bus Messenger"

function Show-MessageBox {
    param(
        [string]$Message,
        [string]$Title,
        [System.Windows.Forms.MessageBoxButtons]$Buttons = [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]$Icon = [System.Windows.Forms.MessageBoxIcon]::Information
    )
    return [System.Windows.Forms.MessageBox]::Show($Message, $Title, $Buttons, $Icon)
}

function Test-NodeInstalled {
    try {
        $null = Get-Command node -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Test-NpmInstalled {
    try {
        $null = Get-Command npm -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Test-WingetInstalled {
    try {
        $null = Get-Command winget -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Install-NodeJS {
    if (Test-WingetInstalled) {
        $result = Show-MessageBox -Message "Node.js is required to run this application.`n`nWould you like to install it automatically using winget?" -Title "Node.js Required" -Buttons YesNo -Icon Question

        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            Write-Host "Installing Node.js via winget..." -ForegroundColor Yellow
            Write-Host "This may take a few minutes..." -ForegroundColor Yellow

            try {
                winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements

                if ($LASTEXITCODE -eq 0) {
                    Show-MessageBox -Message "Node.js installed successfully!`n`nRestarting application..." -Title "Success" -Icon Information
                    Start-Sleep -Seconds 2

                    # Restart the script
                    $scriptPath = $MyInvocation.PSCommandPath
                    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
                    exit
                }
                else {
                    throw "Installation failed"
                }
            }
            catch {
                $manualResult = Show-MessageBox -Message "Automatic installation failed.`n`nWould you like to download Node.js manually?" -Title "Installation Failed" -Buttons YesNo -Icon Error

                if ($manualResult -eq [System.Windows.Forms.DialogResult]::Yes) {
                    Start-Process "https://nodejs.org/"
                }
                exit
            }
        }
        else {
            exit
        }
    }
    else {
        $result = Show-MessageBox -Message "Node.js is required to run this application.`n`nWinget is not available on your system.`nWould you like to download Node.js manually?" -Title "Node.js Required" -Buttons YesNo -Icon Warning

        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            Start-Process "https://nodejs.org/"
        }
        exit
    }
}

# Main execution
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Azure Service Bus Messenger" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for Node.js
if (-not (Test-NodeInstalled)) {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Install-NodeJS
}

Write-Host "[OK] Node.js is installed" -ForegroundColor Green

# Check for npm
if (-not (Test-NpmInstalled)) {
    Show-MessageBox -Message "npm is not found!`n`nPlease reinstall Node.js from https://nodejs.org/" -Title "Error" -Icon Error
    Start-Process "https://nodejs.org/"
    exit
}

Write-Host "[OK] npm is installed" -ForegroundColor Green
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find an available port
$port = 5000
$maxAttempts = 10
for ($i = 0; $i -lt $maxAttempts; $i++) {
    $testPort = $port + $i
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $testPort)
        $listener.Start()
        $listener.Stop()
        $port = $testPort
        break
    }
    catch {
        continue
    }
    finally {
        if ($listener) {
            $listener.Stop()
        }
    }
}

Write-Host "Server will run on http://localhost:$port" -ForegroundColor Yellow
Write-Host ""

# Start the server in background
$serverJob = Start-Job -ScriptBlock {
    param($portNum)
    Set-Location $using:PWD
    npx -y serve -s . -p $portNum
} -ArgumentList $port

# Wait a moment for server to start
Start-Sleep -Seconds 3

# Now open the browser
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:$port"

# Wait for the job to complete (or Ctrl+C)
try {
    Receive-Job -Job $serverJob -Wait
}
catch {
    Show-MessageBox -Message "Failed to start server.`n`nError: $_" -Title "Error" -Icon Error
}
finally {
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
}
