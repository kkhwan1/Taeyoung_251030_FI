# Server Management Script
param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Status,
    [switch]$CleanAll
)

$PORT = 5000

function Get-ServerProcess {
    # Use netstat to find process using the port
    $netstatOutput = netstat -ano | Select-String ":$PORT\s+"
    if ($netstatOutput) {
        foreach ($line in $netstatOutput) {
            # Extract PID from the end of the line
            if ($line -match '\s+(\d+)\s*$') {
                $processId = $Matches[1]
                # Verify it's a real process
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    return $processId
                }
            }
        }
    }
    return $null
}

function Stop-Server {
    $processId = Get-ServerProcess
    if ($processId) {
        Write-Host "[INFO] Stopping process on port $PORT (PID: $processId)..."
        taskkill /F /PID $processId 2>$null
        Start-Sleep -Seconds 2
        Write-Host "[SUCCESS] Server stopped."
    } else {
        Write-Host "[INFO] No server running on port $PORT."
    }
}

function Stop-AllNodeProcesses {
    Write-Host "[INFO] Stopping all node.exe processes..."
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "[SUCCESS] All node processes stopped."
}

function Start-Server {
    # Check if port is already in use
    $processId = Get-ServerProcess
    if ($processId) {
        Write-Host "[WARNING] Port $PORT is already in use (PID: $processId)"
        Write-Host "[ACTION] Stopping existing process..."
        Stop-Server
        Start-Sleep -Seconds 2
    }
    
    Write-Host "[INFO] Starting development server on port $PORT..."
    Write-Host ""
    npm run dev
}

function Get-ServerStatus {
    $processId = Get-ServerProcess
    if ($processId) {
        Write-Host "[SUCCESS] Server is running (PID: $processId, PORT: $PORT)"
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "   Process Name: $($process.ProcessName)"
            Write-Host "   Memory Usage: $([math]::Round($process.WorkingSet64/1MB, 2)) MB"
            Write-Host "   Start Time: $($process.StartTime)"
        }
    } else {
        Write-Host "[INFO] Server is not running on port $PORT."
    }
}

# Execute command
if ($Stop) {
    Stop-Server
} elseif ($Restart) {
    Write-Host "[ACTION] Restarting server..."
    Stop-Server
    Start-Sleep -Seconds 2
    Start-Server
} elseif ($Status) {
    Get-ServerStatus
} elseif ($CleanAll) {
    Write-Host "[ACTION] Cleaning all node processes..."
    Stop-AllNodeProcesses
} else {
    Start-Server
}
