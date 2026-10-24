import {execFileSync} from 'node:child_process';
import {existsSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {ROOT} from './dev-server.mjs';
if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22 or newer is required');
if(process.argv.slice(2).some(x=>x!=='--browser'))throw Error('Usage: npm run setup -- [--browser]');
process.chdir(ROOT);
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--prefix','shared-sync/tooling','--no-audit','--no-fund'],{stdio:'inherit'});
const local=path.join(ROOT,'node_modules');
if(!existsSync(local))symlinkSync(path.join(ROOT,'shared-sync/tooling/node_modules'),local,process.platform==='win32'?'junction':'dir');
try{await import('playwright');}catch{throw Error('Root node_modules exists but Playwright is unavailable. Resolve its dependency layout before testing.');}
if(process.argv.includes('--browser'))execFileSync(process.execPath,[path.join(ROOT,'shared-sync/tooling/node_modules/playwright/cli.js'),'install','chromium'],{stdio:'inherit'});
console.log('Setup complete. Run npm run dev; run npm run check for tool checks. Browser tests require Chromium.');
