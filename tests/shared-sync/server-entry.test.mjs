import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import handler from '../../api/feishu-review.js';
const require=createRequire(import.meta.url);
test('服务端 SDK 可以由 CommonJS 加载，归档入口未登录返回401',async()=>{const sdk=require('../../lib/vendor/supabase-2.118.0.cjs');assert.equal(typeof sdk.createClient,'function');const r={setHeader(){},status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};await handler({method:'POST',headers:{},body:{}},r);assert.equal(r.statusCode,401);assert.equal(r.body.code,'LOGIN_REQUIRED');});
