// Text-only subtitle parsing. No HTML rendering and no inferred timestamps.
function stamp(value){const p=value.trim().replace(',','.').split(':').map(Number);if(p.length<2||p.length>3||p.some(n=>!Number.isFinite(n)||n<0)||p.at(-1)>=60||(p.length===3&&p[1]>=60))return NaN;return p.reduce((n,v)=>n*60+v,0);}
export function parseSubtitles(text,name=''){
 if(typeof text!=='string'||text.length>2*1024*1024)throw Error('subtitle_size');
 const rows=[],input=text.replace(/^\uFEFF/,'').replace(/\r/g,'');
 if(/\.lrc$/i.test(name)){
  for(const line of input.split('\n')){const marks=[...line.matchAll(/\[(\d+:\d+(?:\.\d+)?)\]/g)],value=line.replace(/\[[^\]]*\]/g,'').trim();if(!value)continue;for(const m of marks){const start=stamp(m[1]);if(Number.isFinite(start))rows.push({start,end:null,text:value});}}
 }else{
  for(const block of input.split(/\n\s*\n/)){const lines=block.split('\n'),i=lines.findIndex(l=>l.includes('-->'));if(i<0)continue;const pair=lines[i].split('-->'),start=stamp(pair[0]),end=stamp(pair[1]?.trim().split(/\s+/)[0]||'');const value=lines.slice(i+1).join('\n').replace(/<[^>]*>/g,'').trim();if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&value)rows.push({start,end,text:value});}
 }
 rows.sort((a,b)=>a.start-b.start);if(!rows.length||rows.length>10000||rows.some(r=>r.text.length>8000))throw Error('invalid_subtitles');
 for(let i=0;i<rows.length;i++)if(rows[i].end===null)rows[i].end=rows[i+1]?.start??rows[i].start+10;
 return rows;
}
export function activeCue(rows,seconds){let lo=0,hi=rows.length-1,found=-1;while(lo<=hi){const mid=(lo+hi)>>1;if(rows[mid].start<=seconds){found=mid;lo=mid+1;}else hi=mid-1;}return found>=0&&seconds<rows[found].end?found:-1;}
