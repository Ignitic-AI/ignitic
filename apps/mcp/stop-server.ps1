# PowerShell script to stop the AI Engine server running on the configured PORT
# This script reads the PORT from environment variables and kills the process

param(
    [switch]$Force = $false,
    [int]$Port = 0
)

# Function to print colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Write-Info "Loading environment variables from .env file..."
    Get-Content ".env" | ForEach-Object {
        if ($_ -and !$_.StartsWith("#")) {
            $name, $value = $_.Split("=", 2)
            if ($name -and $value) {
                [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
            }
        }
    }
} elseif (Test-Path "env.example") {
    Write-Warning ".env file not found, using env.example as fallback..."
    Get-Content "env.example" | ForEach-Object {
        if ($_ -and !$_.StartsWith("#")) {
            $name, $value = $_.Split("=", 2)
            if ($name -and $value) {
                [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
            }
        }
    }
} else {
    Write-Warning "No .env or env.example file found, using default PORT=8010"
}

# Get PORT from parameter, environment, or default
if ($Port -eq 0) {
    $Port = [Environment]::GetEnvironmentVariable("PORT")
    if (!$Port) {
        $Port = 8010
    }
}

# Convert to integer
try {
    $Port = [int]$Port
} catch {
    Write-Error "Invalid PORT number: ${Port}"
    exit 1
}

Write-Info "Attempting to stop application on PORT: ${Port}"

# Find processes using the port
try {
    $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
                 Select-Object -ExpandProperty OwningProcess -Unique |
                 ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
    
    if (!$processes) {
        Write-Warning "No application found running on PORT ${Port}"
        exit 0
    }

    Write-Info "Found processes running on PORT ${Port}:"
    $processes | ForEach-Object {
        Write-Info "  - PID: $($_.Id), Name: $($_.ProcessName), Path: $($_.Path)"
    }

    # Stop the processes
    foreach ($process in $processes) {
        try {
            Write-Info "Attempting to stop process $($process.Id) ($($process.ProcessName))..."
            
            if ($Force) {
                # Force kill immediately
                $process | Stop-Process -Force
                Write-Info "Process $($process.Id) force killed successfully"
            } else {
                # Try graceful shutdown first
                $process | Stop-Process
                
                # Wait up to 10 seconds for graceful shutdown
                $timeout = 10
                $stopped = $false
                
                for ($i = 1; $i -le $timeout; $i++) {
                    try {
                        Get-Process -Id $process.Id -ErrorAction Stop | Out-Null
                        Start-Sleep 1
                    } catch {
                        Write-Info "Process $($process.Id) stopped gracefully"
                        $stopped = $true
                        break
                    }
                }
                
                # Force kill if still running
                if (!$stopped) {
                    try {
                        Get-Process -Id $process.Id -ErrorAction Stop | Stop-Process -Force
                        Write-Warning "Process $($process.Id) did not stop gracefully, force killed"
                    } catch {
                        Write-Info "Process $($process.Id) already stopped"
                    }
                }
            }
        } catch {
            Write-Error "Failed to stop process $($process.Id): $($_.Exception.Message)"
        }
    }

    # Verify no processes are still running on the port
    $remainingProcesses = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    
    if (!$remainingProcesses) {
        Write-Info "✅ Successfully stopped all applications on PORT ${Port}"
    } else {
        Write-Error "❌ Some processes are still running on PORT ${Port}"
        $remainingProcesses | ForEach-Object {
            $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Error "  - PID: $($proc.Id), Name: $($proc.ProcessName)"
            }
        }
        exit 1
    }

} catch {
    Write-Error "Error occurred while trying to stop processes: $($_.Exception.Message)"
    
    # Fallback: try using netstat and taskkill
    Write-Info "Trying alternative method..."
    
    try {
        $netstatOutput = netstat -ano | Select-String ":${Port}\s"
        
        if ($netstatOutput) {
            $pids = $netstatOutput | ForEach-Object {
                if ($_ -match "\s+(\d+)$") {
                    $matches[1]
                }
            } | Sort-Object -Unique
            
            foreach ($pid in $pids) {
                Write-Info "Killing process with PID: $pid"
                if ($Force) {
                    taskkill /F /PID $pid 2>$null
                } else {
                    taskkill /PID $pid 2>$null
                }
            }
            
            Write-Info "✅ Alternative method completed"
        } else {
            Write-Warning "No processes found on PORT ${Port} using alternative method"
        }
    } catch {
        Write-Error "Alternative method also failed: $($_.Exception.Message)"
        exit 1
    }
}