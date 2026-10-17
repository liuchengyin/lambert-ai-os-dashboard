import {lookup} from 'node:dns/promises';
import {isIP,BlockList} from 'node:net';
import http from 'node:http';
import https from 'node:https';

const blocked4=new BlockList(),blocked6=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked4.addSubnet(address,prefix,'ipv4');
for(const [address,prefix] of [['::',96],['::ffff:0:0',96],['fc00::',7],['fe80::',10],['ff00::',8],['2001:db8::',32]])blocked6.addSubnet(address,prefix,'ipv6');
export function publicAddress(address){const family=isIP(address);return !!family&&!(family===4?blocked4:blocked6).check(address,family===4?'ipv4':'ipv6')}
export function normalizeUrl(raw){
  if(typeof raw!=='string'||!raw.trim()||raw.length>2048)return null;
  try{const url=new URL(/^https?:\/\//i.test(raw.trim())?raw.trim():'https://'+raw.trim());
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port))return null;
    const hostname=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
    if(hostname==='localhost'||!hostname.includes('.')&&!isIP(hostname)||/\.(localhost|local|internal)$/.test(hostname))return null;
    if(isIP(hostname)&&!publicAddress(hostname))return null;
    url.hash='';return url;
  }catch{return null}
}
export async function resolvePublic(url,resolver=lookup){
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await resolver(hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(x=>!publicAddress(x.address)))throw Error('private_address');
  return addresses[0];
}

function requestPage(url,address,signal){
  return new Promise((resolve,reject)=>{
    const transport=url.protocol==='https:'?https:http;
    // Pin the validated DNS address for this request, including after redirects.
    const req=transport.get(url,{signal,lookup:(_host,options,callback)=>callback(null,options?.all?[address]:address.address,address.family),headers:{'User-Agent':'LambertLinkPreview/1.0','Accept':'text/html,application/xhtml+xml','Accept-Encoding':'identity'}},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({redirect:res.headers.location});return}
      if(res.statusCode<200||res.statusCode>=300||!/text\/html|application\/xhtml\+xml/i.test(res.headers['content-type']||'')){res.resume();reject(Error('page_unavailable'));return}
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>262144){req.destroy();reject(Error('page_too_large'))}else chunks.push(chunk)});
      res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject);
    });req.on('error',reject);
  });
}
const decode=value=>String(value||'').replace(/&#(?:x([\da-f]+)|(\d+));|&(amp|quot|apos|lt|gt|nbsp);/gi,(all,hex,num,name)=>{
  if(name)return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '})[name.toLowerCase()];
  const code=parseInt(hex||num,hex?16:10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
}).replace(/\s+/g,' ').trim();
function attributes(tag){const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))out[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);return out}
export function parseMetadata(html,url){
  // Parse only bounded inert tags; never execute scripts or copy markup into the UI.
  const head=html.slice(0,262144).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
  const meta={};for(const tag of head.match(/<meta\b[^>]*>/gi)||[]){const a=attributes(tag);if(a.property||a.name)meta[(a.property||a.name).toLowerCase()]=a.content||''}
  const title=decode(meta['og:title']||head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||meta['og:site_name']).replace(/<[^>]*>/g,'').slice(0,140);
  const icons=[];for(const tag of head.match(/<link\b[^>]*>/gi)||[]){const a=attributes(tag);if(!a.rel?.split(/\s+/).some(x=>['icon','apple-touch-icon','apple-touch-icon-precomposed'].includes(x.toLowerCase()))||!a.href)continue;
    try{const candidate=normalizeUrl(new URL(a.href,url).href);if(!candidate)continue;const size=Math.max(0,...(a.sizes||'').match(/\d+/g)||[]);icons.push({url:candidate.href,rank:/svg/i.test(a.type||candidate.pathname)?10000:size+(/apple-touch/i.test(a.rel)?180:0)})}catch{}
  }
  return {title,icon:icons.sort((a,b)=>b.rank-a.rank)[0]?.url||new URL('/apple-touch-icon.png',url).href};
}
async function deadline(promise,signal){
  if(signal.aborted)throw Error('timeout');
  let abort;try{return await Promise.race([promise,new Promise((_,reject)=>{abort=()=>reject(Error('timeout'));signal.addEventListener('abort',abort,{once:true})})])}finally{signal.removeEventListener('abort',abort)}
}
export async function recognize(raw,{resolver=lookup,request=requestPage,signal=AbortSignal.timeout(6500)}={}){
  let url=normalizeUrl(raw);if(!url)throw Error('invalid_url');
  for(let redirects=0;redirects<=3;redirects++){
    if(signal.aborted)throw Error('timeout');
    const address=await deadline(resolvePublic(url,resolver),signal);
    const page=await request(url,address,signal);
    if(page.redirect){url=normalizeUrl(new URL(page.redirect,url).href);if(!url)throw Error('invalid_redirect');continue}
    const data=parseMetadata(page.html,url);if(!data.title)throw Error('title_missing');
    // Validate icon hosts too; the browser must not be sent a private-network URL.
    let icon='';try{const candidate=normalizeUrl(data.icon);if(candidate){await deadline(resolvePublic(candidate,resolver),signal);icon=candidate.href}}catch{}
    return {url:url.href,title:data.title,icon};
  }
  throw Error('too_many_redirects');
}
