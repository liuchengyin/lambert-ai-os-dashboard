"""Run only against a fresh, isolated local trial. Never migrates OS data."""
import json
import secrets
import sys
import os
from pathlib import Path
import urllib.error
import urllib.request

base = 'http://localhost:8888'
def request(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)
checkpoint = Path('.smoke-state.json')
if '--verify' in sys.argv:
    saved = json.loads(checkpoint.read_text())
    task = request('GET', f'/api/v2/tasks/{saved["id"]}', token=saved['token'])
    assert task['title'] == saved['title'] and task['project_id'] == saved['project_id']
    print('PASS: project/task persisted across backend restart.')
    sys.exit(0)
info = request('GET', '/api/v2/info')
assert info.get('version'), 'version missing'
username = 'lambert_smoke_' + secrets.token_hex(4)
password = secrets.token_urlsafe(24)
request('POST', '/api/v2/register', {'username': username, 'email': username+'@example.com', 'password': password})
token = request('POST', '/api/v2/login', {'username': username, 'password': password})['token']
project = request('POST', '/api/v2/projects', {'title': '样板 · 求职准备'}, token)
task = request('POST', f'/api/v2/projects/{project["id"]}/tasks', {'title': '测试 · 整理一个履约案例'}, token)
readback = request('GET', f'/api/v2/tasks/{task["id"]}', token=token)
assert readback['title'] == task['title'] and readback['project_id'] == project['id']
with urllib.request.urlopen(base, timeout=15) as response:
    html = response.read().decode()
assert '/lambert/theme.css' in html and '/lambert/launcher.js' in html
with urllib.request.urlopen(base+'/lambert/theme.css', timeout=15) as response:
    assert b'--primary-h' in response.read()
fd = os.open(checkpoint, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as stream:
    json.dump({'id': task['id'], 'title': task['title'], 'project_id': project['id'], 'token': token}, stream)
print('PASS: native API version, registration/login, project/task creation/readback, frontend overlay delivery.')
