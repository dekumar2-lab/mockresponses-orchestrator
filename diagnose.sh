#!/bin/bash
echo "=== Codespace Diagnostic ==="
echo "1. Checking Node processes:"
ps aux | grep node | grep -v grep
echo ""
echo "2. Checking port 5000:"
netstat -tulpn 2>/dev/null | grep 5000 || lsof -i :5000 2>/dev/null || echo "Port 5000 not found"
echo ""
echo "3. Testing backend:"
curl -s http://localhost:5000/api/health || echo "Backend not reachable"
echo ""
echo "4. Current directory:"
pwd
