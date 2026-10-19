import assert from 'node:assert/strict';
import {
  AUTH_COOKIE,STATE_COOKIE,random,stateToken,readState,sessionToken,readSession,
  cookie,clearCookie,config
} from '../lib/auth-session.js';

process.env.AUTH_SESSION_SECRET='test-session-secret-longer-than-thirty-two-characters';
process.env.AUTH_BASE_URL='https://example.vercel.app';
process.env.GOOGLE_CLIENT_ID='fake-google-client-id';
process.env.GOOGLE_CLIENT_SECRET='fake-secret';
const c=config();
assert.equal(c.redirect,'https://example.vercel.app/api/auth/callback');
const state=random(),nonce=random(),signed=stateToken(state,nonce);
assert.deepEqual(readState({headers:{cookie:STATE_COOKIE+'='+encodeURIComponent(signed)}}).state,state);
assert.equal(readState({headers:{cookie:STATE_COOKIE+'='+encodeURIComponent(signed.slice(0,-2)+'xx')}}),null);
const token=sessionToken({sub:'1234',name:'Lambert'});
const request={headers:{cookie:AUTH_COOKIE+'='+encodeURIComponent(token)}};
assert.equal(readSession(request).id,'google:1234');
assert.equal(readSession({headers:{cookie:AUTH_COOKIE+'='+encodeURIComponent(token+'bad')}}),null);
assert.equal(readSession({headers:{cookie:''}}),null);
assert.ok(cookie(AUTH_COOKIE,'value',100).includes('HttpOnly; Secure; SameSite=Lax'));
assert.ok(clearCookie(AUTH_COOKIE).includes('Max-Age=0'));
assert.equal(readSession({headers:{cookie:AUTH_COOKIE+'='+encodeURIComponent(token.split('.')[0]+'.wrong')}}),null);
console.log('Authentication session/security tests passed.');
