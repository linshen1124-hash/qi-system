#!/bin/bash
# QI SYSTEM 本地开发启动（macOS）
cd "$(dirname "$0")"
echo "QI SYSTEM 启动中 -> http://localhost:8080  (Ctrl+C 停止)"
python3 server.py --host 127.0.0.1 --port 8080
