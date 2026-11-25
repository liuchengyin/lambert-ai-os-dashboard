import {availability} from './providers.mjs';
import {access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const exists=async p=>{try{await access(p||'');return true;}catch{return false;}};
let sandbox=false;try{execFileSync('bwrap',['--unshare-all','--die-with-parent','--ro-bind','/usr','/usr','--ro-bind','/lib','/lib','--ro-bind','/lib64','/lib64','--','/usr/bin/true'],{stdio:'ignore',timeout:5000});sandbox=true;}catch{}
console.log(JSON.stringify({node:process.version,providers:availability(),accountConfigPresent:['LAMBERT_SUPABASE_URL','LAMBERT_SUPABASE_PUBLISHABLE_KEY','LAMBERT_PUBLIC_SITE_URL','STUDIO_ALLOWED_USER_IDS'].every(k=>Boolean(process.env[k])),githubCredentialPresent:Boolean(process.env.STUDIO_GITHUB_TOKEN),repositoryPresent:await exists(process.env.STUDIO_REPO_DIR),policyPresent:await exists(process.env.STUDIO_POLICY_FILE),sandboxAvailable:sandbox,realModelCallPerformed:false},null,2));
