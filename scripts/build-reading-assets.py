#!/usr/bin/env python3
"""Pinned, integrity-checked PDF.js build; serves assets from our own origin."""
import hashlib, io, pathlib, tarfile, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
VERSION='4.10.38'
SHA256='1011b38553532d7078c59f26b15a471f8dae00f101b60e2add9b8511737a1ce0'
URL=f'https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-{VERSION}.tgz'
def build():
    target=ROOT/'vendor/pdfjs'
    with urllib.request.urlopen(URL,timeout=45) as response: data=response.read()
    if hashlib.sha256(data).hexdigest()!=SHA256: raise RuntimeError('PDF.js archive integrity mismatch')
    target.mkdir(parents=True,exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        for source,name in [('package/build/pdf.mjs','pdf.mjs'),('package/build/pdf.worker.mjs','pdf.worker.mjs'),('package/LICENSE','LICENSE')]:
            (target/name).write_bytes(archive.extractfile(source).read())
    print(f'PDF.js {VERSION}: verified and installed')
if __name__=='__main__': build()
