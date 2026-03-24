#!/bin/bash

# Ollama Real Estate AI - Startup Script
# This script starts both backend and frontend servers

set -e  # Exit on error

echo "🚀 Starting Ollama Real Estate AI Platform..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Ollama is running
echo -e "${BLUE}Checking Ollama...${NC}"
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama not found. Please install Ollama first.${NC}"
    echo "Visit: https://ollama.com/download"
    exit 1
fi

if ! ollama list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama service not running. Starting...${NC}"
    ollama serve &
    sleep 3
fi

# Check if models are available
echo -e "${BLUE}Checking AI models...${NC}"
if ! ollama list | grep -q "llama3.1:8b"; then
    echo -e "${YELLOW}⚠️  llama3.1:8b not found. Pulling model...${NC}"
    ollama pull llama3.1:8b
fi

echo -e "${GREEN}✓ Ollama ready${NC}"
echo ""

# Start Backend
echo -e "${BLUE}Starting Backend (FastAPI)...${NC}"
cd "$SCRIPT_DIR/backend"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate venv and install dependencies
source venv/bin/activate
if ! pip show fastapi &> /dev/null; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    pip install -r requirements.txt
fi

# Start backend in background
echo -e "${GREEN}✓ Backend starting on http://localhost:8000${NC}"
python server.py &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Start Frontend
echo -e "${BLUE}Starting Frontend (React + Vite)...${NC}"
cd "$SCRIPT_DIR/frontend"

# Load nvm for WSL2 users
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    nvm use node &> /dev/null || nvm use --lts &> /dev/null
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend
echo -e "${GREEN}✓ Frontend starting on http://localhost:5173${NC}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Application Started Successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Backend API:${NC}      http://localhost:8000"
echo -e "${BLUE}🌐 Frontend App:${NC}     http://localhost:5173"
echo -e "${BLUE}📚 API Docs:${NC}         http://localhost:8000/docs"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌐 MCP Server (Live Real Estate Data):${NC}"
echo -e "${YELLOW}   Fetches live Abu Dhabi property listings & rental prices${NC}"
echo -e "${YELLOW}   from PropertyFinder.ae and Numbeo — no API key needed.${NC}"
echo ""
echo -e "${BLUE}   Setup (one-time):${NC}"
echo -e "   cd ../mcp-server"
echo -e "   python3 -m venv venv && source venv/bin/activate"
echo -e "   pip install -r requirements.txt"
echo ""
echo -e "${BLUE}   Connect to Claude Desktop — add to claude_desktop_config.json:${NC}"
echo -e "   {\"mcpServers\":{\"real-estate\":{\"command\":\"$(cd $SCRIPT_DIR/../mcp-server && pwd)/venv/bin/python3\","
echo -e "     \"args\":[\"$(cd $SCRIPT_DIR/../mcp-server && pwd)/server.py\"]}}}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Wait for both processes
wait
