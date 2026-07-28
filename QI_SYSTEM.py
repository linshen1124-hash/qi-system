#!/usr/bin/env python3
"""QI SYSTEM 桌面启动器 —— 双击启动，自动运行后端 + 打开桌面窗口"""
import subprocess, threading, time, os, sys, signal

BASE = os.path.dirname(os.path.abspath(__file__))
PORT = 8080
URL = f"http://localhost:{PORT}"

def check_server():
    """Returns True if server is already running."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    try:
        s.connect(("127.0.0.1", PORT))
        s.close()
        return True
    except:
        return False

def main():
    started_by_us = False
    server = None

    if not check_server():
        print("Starting QI SYSTEM server...")
        server = subprocess.Popen(
            [sys.executable, "server.py", "--host", "127.0.0.1", "--port", str(PORT)],
            cwd=BASE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        started_by_us = True
        # Wait for server to be ready
        for _ in range(20):
            time.sleep(0.3)
            if check_server():
                break
        print("Server ready.")

    print("Opening QI SYSTEM...")
    chrome = subprocess.Popen([
        "open", "-a", "Google Chrome", "--args",
        f"--app={URL}",
        "--window-size=1280,800"
    ])

    print("QI SYSTEM is running. Close the QI SYSTEM window to stop.")
    try:
        chrome.wait()
    except KeyboardInterrupt:
        pass
    finally:
        if started_by_us and server:
            print("Stopping server...")
            server.terminate()
            server.wait()

if __name__ == "__main__":
    main()
