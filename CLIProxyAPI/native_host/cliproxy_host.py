import sys
import json
import struct
import subprocess
import os

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack('=I', raw_length)[0]
    msg = sys.stdin.buffer.read(length).decode('utf-8')
    return json.loads(msg)

def send_message(msg):
    encoded = json.dumps(msg).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def is_server_running():
    try:
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq cli-proxy-api.exe', '/FO', 'CSV', '/NH'],
            capture_output=True, text=True, timeout=5
        )
        return 'cli-proxy-api.exe' in result.stdout
    except:
        return False

def start_server():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.join(script_dir, '..')
    exe_path = os.path.join(server_dir, 'cli-proxy-api.exe')
    if not os.path.exists(exe_path):
        return {"status": "error", "error": f"cli-proxy-api.exe not found at {exe_path}"}
    try:
        subprocess.Popen(
            [exe_path, 'run'],
            cwd=server_dir,
            creationflags=subprocess.CREATE_NEW_CONSOLE | subprocess.DETACHED_PROCESS,
            close_fds=True
        )
        return {"status": "ok", "message": "Server started"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def stop_server():
    try:
        subprocess.run(['taskkill', '/F', '/IM', 'cli-proxy-api.exe'], capture_output=True, timeout=5)
        return {"status": "ok", "message": "Server stopped"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

if __name__ == '__main__':
    msg = read_message()
    if msg:
        action = msg.get('action', '')
        if action == 'status':
            send_message({"running": is_server_running()})
        elif action == 'start':
            send_message(start_server())
        elif action == 'stop':
            send_message(stop_server())
        else:
            send_message({"status": "error", "error": "Unknown action"})
