"""Prepare a local-only trial without overwriting secrets or existing data."""
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent
uid = os.getuid() if hasattr(os, 'getuid') else 1000
gid = os.getgid() if hasattr(os, 'getgid') else 1000
if uid == 0:
    uid = gid = 1000
for name in ('db', 'files'):
    directory = root / 'data' / name
    directory.mkdir(parents=True, exist_ok=True)
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        os.chown(directory, uid, gid)
env = root / '.env'
try:
    fd = os.open(env, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    print('Kept existing .env and data.')
else:
    with os.fdopen(fd, 'w') as stream:
        stream.write(f'VIKUNJA_SERVICE_SECRET={secrets.token_hex(32)}\nVIKUNJA_UID={uid}\nVIKUNJA_GID={gid}\n')
    print('Prepared local configuration. Secret is stored only in ignored .env.')
print('Next: docker compose up -d; open http://localhost:8888/')
