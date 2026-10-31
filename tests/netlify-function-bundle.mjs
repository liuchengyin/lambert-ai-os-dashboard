import {createRequire} from 'node:module';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../shared-sync/tooling/package.json',import.meta.url));
const {build}=require('esbuild'),folder=await mkdtemp(join(tmpdir(),'lambert-config-bundle-'));
try{
 const outfile=join(folder,'account-config.mjs');
 await build({entryPoints:['netlify/functions/account-config.mjs'],bundle:true,platform:'node',format:'esm',outfile});
 const {createHandler,SITE}=await import(pathToFileURL(outfile));
 const response=await createHandler({env:{LAMBERT_SUPABASE_URL:'https://fixture.supabase.co',LAMBERT_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',LAMBERT_PUBLIC_SITE_URL:SITE},fetcher:()=>{throw Error('must_not_fetch');}})(new Request(SITE+'/api/account-config'));
 assert.equal((await response.json()).configured,true);
 const redirects=await readFile('netlify-dist/_redirects','utf8');assert.equal(redirects.split('\n')[0],'/api/account-config /.netlify/functions/account-config 200');
 console.log('PASS isolated Netlify function bundle: reused validator resolves, explicit config works, exact API route precedes 404 fallback');
}finally{await rm(folder,{recursive:true,force:true});}
