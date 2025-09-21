#!/bin/bash

# Script to stop the AI Engine server running on the configured PORT
# This script reads the PORT from environment variables and kills the process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    print_info "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
elif [ -f "env.example" ]; then
    print_warning ".env file not found, using env.example as fallback..."
    export $(grep -v '^#' env.example | xargs)
else
    print_warning "No .env or env.example file found, using default PORT=8010"
fi

# Get PORT from environment, default to 8010 if not set
PORT=${PORT:-8010}

print_info "Attempting to stop application on PORT: $PORT"

# Check if PORT is a valid number
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    print_error "Invalid PORT number: $PORT"
    exit 1
fi

# Find processes using the port
PIDS=$(lsof -ti:$PORT 2>/dev/null || true)

if [ -z "$PIDS" ]; then
    print_warning "No application found running on PORT $PORT"
    exit 0
fi

print_info "Found processes running on PORT $PORT: $PIDS"

# Kill the processes
for PID in $PIDS; do
    if kill -0 $PID 2>/dev/null; then
        print_info "Attempting to gracefully stop process $PID..."
        kill -TERM $PID
        
        # Wait up to 10 seconds for graceful shutdown
        for i in {1..10}; do
            if ! kill -0 $PID 2>/dev/null; then
                print_info "Process $PID stopped gracefully"
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if kill -0 $PID 2>/dev/null; then
            print_warning "Process $PID did not stop gracefully, force killing..."
            kill -KILL $PID
            if ! kill -0 $PID 2>/dev/null; then
                print_info "Process $PID force killed successfully"
            else
                print_error "Failed to kill process $PID"
            fi
        fi
    else
        print_info "Process $PID already stopped"
    fi
done

# Verify no processes are still running on the port
REMAINING_PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -z "$REMAINING_PIDS" ]; then
    print_info "✅ Successfully stopped all applications on PORT $PORT"
else
    print_error "❌ Some processes are still running on PORT $PORT: $REMAINING_PIDS"
    exit 1
fi