from pathlib import Path
import shutil,re
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
p.write_text(s)
