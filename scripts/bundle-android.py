from pathlib import Path
import shutil,re,json,time
assets=Path('android/app/src/main/assets')
for source in Path('mobile').iterdir():
    if source.is_file() and source.name not in ['sw.js','manifest.webmanifest']:
        target=assets/'mobile'/source.name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,target)
for source in Path('shared-sync').rglob('*'):
    if source.is_file() and 'tooling' not in source.parts:
        target=assets/source
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,target)
p=assets/'mobile/index.html'
s=p.read_text()
s=re.sub(r"<script>if\('serviceWorker'.*?</script>",'',s)
s=s.replace('<link rel="manifest" href="manifest.webmanifest">','')
release=int(time.time()*1000)
s=re.sub(r'<meta name="lambert-page-release" content="[0-9]+">','',s)
s=s.replace('</head>','<meta name="lambert-page-release" content="'+str(release)+'"></head>')
p.write_text(s)
(assets/'mobile/release.json').write_text(json.dumps({'release':release,'protocol':1}))
