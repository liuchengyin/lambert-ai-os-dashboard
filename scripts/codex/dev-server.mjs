import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.wav':'audio/wav','.webmanifest':'application/manifest+json'};
const BLOCKED=new Set(['node_modules','android','scripts','tests','docs','review-output','supabase','lib']);
export function publicPath(url){
 let pathname;try{pathname=decodeURIComponent(new URL(url,'http://localhost').pathname);}catch{return null;}
 if(pathname.includes('\\')||pathname.includes('\0'))return null;
 const parts=pathname.split('/').filter(Boolean);
 if(parts.some(p=>p.startsWith('.')||BLOCKED.has(p)))return null;
 return parts.join('/')+(pathname.endsWith('/')?(parts.length?'/index.html':'index.html'):'');
}
export function createDevServer({root=ROOT}={}){
 return http.createServer(async(req,res)=>{
  const send=(status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);};
  if(!['GET','HEAD'].includes(req.method))return send(405,JSON.stringify({error:'local_preview_read_only'}));
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/account-config')return send(200,JSON.stringify({configured:false,localPreview:true}));
  if(pathname.startsWith('/api/'))return send(501,JSON.stringify({error:'backend_not_running',message:'本地预览只提供页面。账号、AI、飞书 API 请在已配置的后端环境验证。'}));
  const name=publicPath(req.url);if(!name)return send(404,'{}');
  try{
   const file=await realpath(path.join(root,name)),base=await realpath(root);
   if(!file.startsWith(base+path.sep)||path.relative(base,file).split(path.sep).some(p=>p.startsWith('.')||BLOCKED.has(p)))return send(404,'{}');
   const info=await stat(file);if(!info.isFile())return send(404,'{}');
   const type=TYPES[path.extname(file).toLowerCase()];if(!type)return send(404,'{}');
   // Range responses allow audio seek without loading the entire file in the browser.
   const range=req.headers.range;
   if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)return send(416,'{}');const start=Number(match[1]),end=match[2]?Number(match[2]):info.size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||end>=info.size)return send(416,'{}');const bytes=await readFile(file);res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));}
   res.writeHead(200,{'Content-Type':type,'Content-Length':info.size,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{send(404,'{}');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT||8765);if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid_port');
 const server=createDevServer();server.on('error',()=>{console.error('Local server failed. Check whether PORT is already occupied.');process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`Web: http://127.0.0.1:${port}/\nApp pages: http://127.0.0.1:${port}/mobile/\nLocal preview uses local data; backend APIs are not connected.`));
}
