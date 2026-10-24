import test from 'node:test';
import assert from 'node:assert/strict';
import { naturalFiles, MAX_FILES, MAX_BYTES, ImportQueue } from '../../shared-audio/import-queue.mjs';

function makeFile(name, size = 16, type = 'audio/mpeg') {
  const bytes = new Uint8Array(size);
  const encoded=new TextEncoder().encode(name);
  for (let i = 0; i < size; i++) bytes[i] = encoded[i%encoded.length];
  return { name, size, type, arrayBuffer: async () => bytes.buffer.slice(0) };
}

function makeStore() {
  const records = new Map();
  const payloads = new Map();
  return {
    records, payloads,
    async list(userId) { return [...records.values()].filter((r) => r.userId === userId).map((r) => ({ ...r })); },
    async stage(job, file) { records.set(job.id, { ...job }); payloads.set(job.id, file); },
    async save(job) { records.set(job.id, { ...job }); },
    async readFile(job) { return payloads.get(job.id) || null; },
  };
}

function makeUpload(log, opts = {}) {
  return async (job, file, progress) => {
    log.push(job.id);
    progress(0.5);
    if (opts.fail) throw { code: 'network_error' };
    return { ready: true, trackId: 't-' + job.id };
  };
}

test('naturalFiles sorts 2 before 10', () => {
  const files = [makeFile('10.mp3'), makeFile('2.mp3'), makeFile('1.mp3')];
  assert.deepEqual(naturalFiles(files).map((f) => f.name), ['1.mp3', '2.mp3', '10.mp3']);
});

test('rejects 201 files before staging', async () => {
  const store = makeStore();
  const q = new ImportQueue({ store, upload: makeUpload([]) });
  const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => makeFile(`${i}.mp3`));
  const res = await q.add(files, { userId: 'u1', collectionId: 'c1', remaining: 1000 });
  assert.equal(res.added, 0);
  assert.equal(store.records.size, 0);
});

test('same-batch dedupe', async () => {
  const store = makeStore();
  const q = new ImportQueue({ store, upload: makeUpload([]) });
  const f = makeFile('a.mp3');
  const res = await q.add([f, makeFile('a.mp3')], { userId: 'u1', collectionId: 'c1', remaining: 10 });
  assert.equal(res.added, 1);
  assert.equal(res.duplicates, 1);
});

test('simultaneous add dedupe', async () => {
  const store = makeStore();
  const q = new ImportQueue({ store, upload: makeUpload([]) });
  const f = makeFile('a.mp3');
  const [r1, r2] = await Promise.all([
    q.add([f], { userId: 'u1', collectionId: 'c1', remaining: 10 }),
    q.add([makeFile('a.mp3')], { userId: 'u1', collectionId: 'c1', remaining: 10 }),
  ]);
  assert.equal(r1.added + r2.added, 1);
  assert.equal(store.records.size, 1);
});

test('retry keeps identity and verifies digest', async () => {
  const store = makeStore();
  const q = new ImportQueue({ store, upload: makeUpload([], { fail: true }) });
  await q.add([makeFile('a.mp3')], { userId: 'u1', collectionId: 'c1', remaining: 10 });
  await q.run();
  const job = q.jobs[0];
  assert.equal(job.status, 'failed');
  const bad = await q.retry(job.id, makeFile('a.mp3', 32));
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'digest_mismatch');
  const good = await q.retry(job.id, makeFile('a.mp3'));
  assert.equal(good.ok, true);
  assert.equal(good.job.id, job.id);
});

test('restore missing file becomes needs_file', async () => {
  const store = makeStore();
  const q = new ImportQueue({ store, upload: makeUpload([]) });
  await q.add([makeFile('a.mp3')], { userId: 'u1', collectionId: 'c1', remaining: 10 });
  const job = q.jobs[0];
  job.status = 'uploading';
  await store.save(job);
  store.payloads.delete(job.id);
  const q2 = new ImportQueue({ store, upload: makeUpload([]) });
  await q2.restore('u1');
  assert.equal(q2.jobs[0].status, 'needs_file');
});

test('owner isolation on restore', async () => {
  const store = makeStore();
  const q = new ImportQueue({ store, upload: makeUpload([]) });
  await q.add([makeFile('a.mp3')], { userId: 'u1', collectionId: 'c1', remaining: 10 });
  await assert.rejects(q.add([makeFile('b.mp3')], { userId: 'u2', collectionId: 'c1', remaining: 10 }),/account_mismatch/);
  const q2 = new ImportQueue({ store, upload: makeUpload([]) });
  await q2.restore('u1');
  assert.equal(q2.jobs.length, 1);
  assert.equal(q2.jobs[0].userId, 'u1');
});

test('sequential uploads and failure preservation', async () => {
  const store = makeStore();
  const log = [];
  let calls = 0;
  const upload = async (job, file, progress) => {
    log.push(job.id);
    progress(0.5);
    calls++;
    if (calls === 2) throw { code: 'boom' };
    return { ready: true, trackId: 't-' + job.id };
  };
  const q = new ImportQueue({ store, upload });
  await q.add([makeFile('1.mp3'), makeFile('2.mp3'), makeFile('3.mp3')], { userId: 'u1', collectionId: 'c1', remaining: 10 });
  await q.run();
  assert.equal(log.length, 3);
  assert.equal(new Set(log).size, 3);
  const failed = q.jobs.find((j) => j.status === 'failed');
  assert.ok(failed);
  assert.equal(failed.error, 'boom');
  assert.ok(store.payloads.get(failed.id));
  assert.equal(q.jobs.filter((j) => j.status === 'completed').length, 2);
});

test('MAX_BYTES exported', () => {
  assert.equal(MAX_BYTES, 25 * 1024 * 1024);
});
