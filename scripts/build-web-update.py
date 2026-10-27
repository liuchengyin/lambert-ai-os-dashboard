"""Build the atomic page update that accompanies each Vercel deployment.
Includes public page assets only, never app data, tooling, secrets, or native code.
"""
from pathlib import Path
import argparse,hashlib,io,json,os,re,time,zipfile
from datetime import datetime, timezone, timedelta
ROOT=Path(__file__).resolve().parents[1]

def build(output,release=None):
    release=release or int(time.time()*1000)
    files={}
    allowed={'.html','.js','.mjs','.css','.json','.svg','.png','.webp','.jpg','.jpeg','.ico','.woff','.woff2'}
    for folder in ['mobile','shared-sync']:
        for file in sorted((ROOT/folder).rglob('*')):
            relative=file.relative_to(ROOT)
            if not file.is_file() or 'tooling' in relative.parts or 'node_modules' in relative.parts or 'updates' in relative.parts or file.suffix not in allowed or file.name in ['sw.js','manifest.webmanifest']:
                continue
            files[str(relative)]=file.read_bytes()
    public_html=files['mobile/index.html'].decode()
    public_html=re.sub(r'<meta name="lambert-page-release" content="[0-9]+">','',public_html)
    public_html=public_html.replace('</head>','<meta name="lambert-page-release" content="'+str(release)+'"></head>')
    html=re.sub(r"<script>if\('serviceWorker'.*?</script>",'',public_html)
    html=html.replace('<link rel="manifest" href="manifest.webmanifest">','')
    files['mobile/index.html']=html.encode()
    version=datetime.fromtimestamp(release/1000,timezone(timedelta(hours=8))).strftime('%Y.%m.%d.%H%M%S')
    files['mobile/release.json']=json.dumps({'release':release,'protocol':1,'version':version}).encode()
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,data in sorted(files.items()):
            info=zipfile.ZipInfo(name,(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            archive.writestr(info,data)
    content=buffer.getvalue();digest=hashlib.sha256(content).hexdigest()
    output=Path(output);
    if output.resolve()==(ROOT/'mobile/updates').resolve():
        (ROOT/'mobile/index.html').write_text(public_html)
        (ROOT/'mobile/release.json').write_bytes(files['mobile/release.json'])
    output.mkdir(parents=True,exist_ok=True)
    (output/(digest+'.zip')).write_bytes(content)
    manifest={'protocol':1,'minNativeVersion':17,'release':release,'sha256':digest,'url':'/mobile/updates/'+digest+'.zip','bytes':len(content),'files':len(files)}
    # Published atomically with the matching immutable ZIP by Vercel.
    (output/'latest.json').write_text(json.dumps(manifest,separators=(',',':')))
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'mobile/updates'));parser.add_argument('--release',type=int);args=parser.parse_args()
    print(json.dumps(build(args.output,args.release)))
