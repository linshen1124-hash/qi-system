@echo off
chcp 65001 >nul
title QI SYSTEM 后勤管理系统
cd /d "%~dp0"
echo ============================================
echo    QI SYSTEM  正在启动...
echo    启动后请勿关闭本窗口
echo    浏览器访问:  http://localhost:8080
echo    局域网访问:  http://本机IP:8080
echo    停止系统:    关闭本窗口 或按 Ctrl+C
echo ============================================
echo.
python server.py --host 0.0.0.0 --port 8080
pause
