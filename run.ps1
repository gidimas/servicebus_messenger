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
Write-Host "Proxy will run on http://localhost:3001" -ForegroundColor Yellow
Write-Host ""

# Check if proxy-server.js exists
if (-not (Test-Path "proxy-server.js")) {
    Show-MessageBox -Message "Error: proxy-server.js not found!`n`nThis file is required for the application to work.`nPlease re-download the complete release package." -Title "Missing File" -Icon Error
    exit
}

# Start the proxy server in background
Write-Host "Starting proxy server..." -ForegroundColor Yellow

# Start proxy server as a job but redirect output to console
$proxyJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    node proxy-server.js
}

# Wait and verify proxy started
Start-Sleep -Seconds 2

# Verify proxy is actually listening on port 3001
try {
    $testConnection = Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue -InformationLevel Quiet -ErrorAction SilentlyContinue | Out-Null
    $testResult = $?
    if (-not $testResult) {
        throw "Proxy server is not responding on port 3001"
    }
    Write-Host "[OK] Proxy server started successfully" -ForegroundColor Green
}
catch {
    Show-MessageBox -Message "Proxy server failed to start or is not listening on port 3001.`n`nPlease check if another application is using this port." -Title "Proxy Server Error" -Icon Error
    Stop-Job -Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job -Job $proxyJob -ErrorAction SilentlyContinue
    exit
}

# Start the web server in background
Write-Host "Starting web server..." -ForegroundColor Yellow
$serverJob = Start-Job -ScriptBlock {
    param($portNum)
    Set-Location $using:PWD
    npx -y serve -s . -p $portNum
} -ArgumentList $port

# Wait a moment for server to start
Start-Sleep -Seconds 3

# Check if web server job failed to start
if ($serverJob.State -eq 'Failed') {
    $serverError = Receive-Job -Job $serverJob 2>&1
    Show-MessageBox -Message "Failed to start web server!`n`nError: $serverError" -Title "Web Server Error" -Icon Error
    Stop-Job -Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job -Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
    exit
}

Write-Host "[OK] Web server started successfully" -ForegroundColor Green

# Now open the browser
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:$port"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servers are running!" -ForegroundColor Green
Write-Host "  Proxy server logs will appear below" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Wait for the jobs to complete (or Ctrl+C)
try {
    # Monitor both servers and display proxy logs
    $lastProxyOutput = ""
    while ($true) {
        # Get and display proxy server output
        $proxyOutput = Receive-Job -Job $proxyJob 2>&1 | Out-String
        if ($proxyOutput -and $proxyOutput -ne $lastProxyOutput) {
            Write-Host $proxyOutput.Trim() -ForegroundColor Cyan
            $lastProxyOutput = $proxyOutput
        }

        Start-Sleep -Milliseconds 500

        # Check if proxy job failed
        if ($proxyJob.State -eq 'Failed') {
            throw "Proxy server failed"
        }

        # Check if web server job failed
        if ($serverJob.State -eq 'Failed') {
            throw "Web server failed"
        }
    }
}
catch {
    if ($_ -notmatch "terminate the pipeline") {
        Write-Host "`n[ERROR] $_" -ForegroundColor Red
    }
}
finally {
    Write-Host "`nStopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job -Job $proxyJob -ErrorAction SilentlyContinue
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
}
