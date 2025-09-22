# Server Stop Scripts

This directory contains scripts to stop the AI Engine server running on the configured PORT.

## Files

- **`stop-server.sh`** - Bash script for Unix/Linux/macOS systems
- **`stop-server.ps1`** - PowerShell script for Windows systems  
- **`stop-server.bat`** - Batch file wrapper for Windows (calls the PowerShell script)

## Usage

### Windows

#### Option 1: Double-click the batch file
Simply double-click `stop-server.bat` in File Explorer.

#### Option 2: Run from Command Prompt/PowerShell
```cmd
# Using batch file
stop-server.bat

# Using PowerShell script directly
powershell -ExecutionPolicy Bypass -File stop-server.ps1

# With force flag (immediate kill)
powershell -ExecutionPolicy Bypass -File stop-server.ps1 -Force

# With custom port
powershell -ExecutionPolicy Bypass -File stop-server.ps1 -Port 8001
```

### Unix/Linux/macOS

```bash
# Make executable (if not already)
chmod +x stop-server.sh

# Run the script
./stop-server.sh
```

## How it works

1. **Environment Detection**: The scripts automatically load the PORT from:
   - `.env` file (first priority)
   - `env.example` file (fallback)
   - Default PORT 8010 (if no config found)

2. **Process Discovery**: 
   - **Windows**: Uses `Get-NetTCPConnection` to find processes using the port
   - **Unix/Linux**: Uses `lsof` to find processes using the port

3. **Graceful Shutdown**: 
   - First attempts graceful termination (SIGTERM on Unix, Stop-Process on Windows)
   - Waits up to 10 seconds for graceful shutdown
   - Force kills if process doesn't stop gracefully

4. **Verification**: Confirms that no processes are still running on the port

## Configuration

The scripts read the PORT from environment variables in this order:

1. Command line parameter (PowerShell only): `-Port 8001`
2. Environment variable: `$env:PORT` (Windows) or `$PORT` (Unix)
3. `.env` file in the current directory
4. `env.example` file in the current directory  
5. Default value: 8010

## Examples

### Current Configuration
Based on your `env.example`, the default PORT is **8001**.

### Stop server on default port (8001)
```bash
# Windows
stop-server.bat

# Unix/Linux/macOS  
./stop-server.sh
```

### Force kill (immediate termination)
```powershell
# Windows PowerShell
powershell -File stop-server.ps1 -Force
```

### Stop server on custom port
```powershell
# Windows PowerShell
powershell -File stop-server.ps1 -Port 8080
```

## Error Handling

The scripts include comprehensive error handling:

- **Invalid PORT**: Validates that PORT is a valid number
- **No Process Found**: Gracefully handles when no application is running on the port
- **Permission Issues**: Provides clear error messages for permission problems
- **Network Issues**: Includes fallback methods for process discovery

## Logging

The scripts provide colored output with different log levels:
- **🟢 INFO**: General information and successful operations
- **🟡 WARNING**: Non-critical issues or fallback actions
- **🔴 ERROR**: Critical errors that prevent operation

## Troubleshooting

### "Execution Policy" Error (Windows)
If you get an execution policy error, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "lsof command not found" (Unix/Linux)
Install lsof:
```bash
# Ubuntu/Debian
sudo apt-get install lsof

# CentOS/RHEL
sudo yum install lsof

# macOS (if using Homebrew)
brew install lsof
```

### Permission Denied (Unix/Linux)
Make sure the script is executable:
```bash
chmod +x stop-server.sh
```

### Process Won't Stop
If a process refuses to stop, you can:
1. Use the force flag: `powershell -File stop-server.ps1 -Force`
2. Manually kill using Task Manager (Windows) or `kill -9 <PID>` (Unix/Linux)
3. Check if the process is running as a different user/with elevated privileges