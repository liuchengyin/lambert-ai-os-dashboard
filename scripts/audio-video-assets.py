"""Package the existing video page without maintaining a fork of its engine."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def video_assets():
    names=['english-learning.js','english-learning-v1.css','english-learning-media-v1.css','english-app-lite.css']
    files={'shared-audio/video/'+name:(ROOT/name).read_bytes() for name in names}
    html=(ROOT/'english-app.html').read_text().replace('brand/logo-mark.svg?v=purple-white-1','logo-mark.svg')
    files['shared-audio/video/index.html']=html.encode()
    files['shared-audio/video/logo-mark.svg']=(ROOT/'brand/logo-mark.svg').read_bytes()
    return files
