// DeepSeek Flash draft, reviewed and corrected for explicit validation and owner scope.
const MAX_FILES = 200;
const MAX_BYTES = 25 * 1024 * 1024;
const VALID_EXT = new Set(['mp3', 'm4a', 'wav']);
const VALID_MIME = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'audio/wav', 'audio/x-wav', 'audio/wave',
]);

function extOf(name) {
  const i = String(name || '').lastIndexOf('.');
  return i < 0 ? '' : String(name).slice(i + 1).toLowerCase();
}

function naturalCompare(a, b) {
  const ax = String(a).match(/(\d+|\D+)/g) || [];
  const bx = String(b).match(/(\d+|\D+)/g) || [];
  const n = Math.min(ax.length, bx.length);
  for (let i = 0; i < n; i++) {
    const x = ax[i], y = bx[i];
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) {
      const xx=x.replace(/^0+/,'')||'0',yy=y.replace(/^0+/,'')||'0';
      if(xx.length!==yy.length)return xx.length-yy.length;
      if(xx!==yy)return xx<yy?-1:1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return ax.length - bx.length;
}

function naturalFiles(files) {
  return Array.from(files || []).sort((a, b) => naturalCompare(a && a.name, b && b.name));
}

function uuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

async function sha256(file) {
  const buf = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
}

function validateFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return 'invalid_file';
  if (!VALID_EXT.has(extOf(file.name))) return 'invalid_type';
  if (file.type && !VALID_MIME.has(String(file.type).toLowerCase())) return 'invalid_type';
  if (!(file.size > 0)) return 'empty_file';
  if (file.size > MAX_BYTES) return 'too_large';
  return null;
}

function safeError(err) {
  const code = err && (typeof err.code==='string'?err.code:typeof err.message==='string'?err.message:'upload_failed');
  return /^[a-z0-9_]{1,64}$/.test(code) ? code : 'upload_failed';
}

class ImportQueue {
  constructor({ store, upload, onChange = () => {} } = {}) {
    if (!store) throw new Error('store_required');
    if (typeof upload !== 'function') throw new Error('upload_required');
    this.store = store;
    this.upload = upload;
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    this.jobs = [];
    this.running = false;
    this._paused = false;
    this._addChain = Promise.resolve();
    this._runChain = Promise.resolve();
  }

  _emit() {
    try { this.onChange(this.jobs); } catch { /* callback errors must not corrupt queue */ }
  }

  _find(jobId) { return this.jobs.find((j) => j.id === jobId); }

  _pendingCount(userId, collectionId) {
    return this.jobs.filter((j) =>
      j.userId === userId && j.collectionId === collectionId && !j.reserved &&
      (j.status === 'queued' || j.status === 'failed' || j.status === 'uploading' || j.status === 'needs_file')
    ).length;
  }

  _dedupeKey(j) { return `${j.userId}\u0000${j.collectionId}\u0000${j.hash}`; }

  async restore(userId) {
    const list = await this.store.list(userId);
    const restored = [];
    for (const rec of list || []) {
      if (!rec || rec.userId !== userId) continue;
      const job = { ...rec };
      if (['uploading','queued','failed'].includes(job.status)) {
        let hasPayload = false;
        try { hasPayload = !!(await this.store.readFile(job)); } catch { hasPayload = false; }
        job.status = hasPayload ? (job.status==='uploading'?'queued':job.status) : 'needs_file';
        job.progress = 0;
        await this.store.save(job);
      }
      restored.push(job);
    }
    this.jobs = restored;
    this.userId=userId;
    this._emit();
    return restored;
  }

  add(files, { userId, collectionId, remaining = Infinity } = {}) {
    const run = async () => {
      const list = naturalFiles(files);
      if(!userId||!collectionId||(this.userId&&this.userId!==userId))throw Error('account_mismatch');
      this.userId=userId;
      const seen = new Set();
      const candidates = [];
      let duplicates = 0;
      const existing = new Set(this.jobs.map((j) => this._dedupeKey(j)));
      for (const file of list) {
        const err = validateFile(file);
        if (err) throw Object.assign(Error(err),{code:err});
        const hash = await sha256(file);
        const key = `${userId}\u0000${collectionId}\u0000${hash}`;
        if (seen.has(key) || existing.has(key)) { duplicates++; continue; }
        seen.add(key);
        candidates.push({ file, hash });
      }
      const pending = this._pendingCount(userId, collectionId);
      const room = Math.max(0, Math.min(MAX_FILES - pending, Number(remaining) - pending));
      if (candidates.length > room) {
        return { added: 0, duplicates, rejected: 'capacity' };
      }
      const added = [];
      for (const { file, hash } of candidates) {
        const job = {
          id: uuid(), userId, collectionId, hash,
          name: file.name, size: file.size, type: file.type || '',
          status: 'queued', progress: 0, trackId: null, error: null,
        };
        await this.store.stage(job, file);
        this.jobs.push(job);
        added.push(job);
        this._emit();
      }
      this._emit();
      return { added: added.length, duplicates };
    };
    const p = this._addChain.then(run, run);
    this._addChain = p.then(() => {}, () => {});
    return p;
  }

  async retry(jobId, file) {
    const job = this._find(jobId);
    if (!job) return { ok: false, error: 'not_found' };
    if (file) {
      const err = validateFile(file);
      if (err) return { ok: false, error: err };
      const hash = await sha256(file);
      if (hash !== job.hash) return { ok: false, error: 'digest_mismatch' };
      await this.store.stage(job, file);
    } else {
      let has = false;
      try { has = !!(await this.store.readFile(job)); } catch { has = false; }
      if (!has) return { ok: false, error: 'needs_file' };
    }
    job.status = 'queued';
    job.progress = 0;
    job.error = null;
    await this.store.save(job);
    this._emit();
    return { ok: true, job };
  }

  pause() { this._paused = true; this._emit(); }

  run() {
    const exec = async () => {
      if (this.running) return;
      this.running = true;
      this._paused = false;
      this._emit();
      try {
        for (;;) {
          if (this._paused) break;
          const job = this.jobs.find((j) => j.status === 'queued');
          if (!job) break;
          let file;
          try { file = await this.store.readFile(job); } catch { file = null; }
          if (!file) {
            job.status = 'needs_file';
            await this.store.save(job);
            this._emit();
            continue;
          }
          job.status = 'uploading';
          job.progress = 0;
          await this.store.save(job);
          this._emit();
          let last = 0;
          const onProgress = (p) => {
            const v = Math.max(last, Math.min(1, Number(p) || 0));
            if (v > last) { last = v; job.progress = v; this._emit(); }
          };
          try {
            const res = await this.upload(job, file, onProgress);
            if (!res || res.ready !== true || !res.trackId) throw { code: 'not_confirmed' };
            job.status = 'completed';
            job.trackId = res.trackId;
            job.progress = 1;
            job.error = null;
            await this.store.save(job);
          } catch (err) {
            job.status = 'failed';
            job.error = safeError(err);
            await this.store.save(job);
          }
          this._emit();
        }
      } finally {
        this.running = false;
        this._emit();
      }
    };
    const p = this._runChain.then(exec, exec);
    this._runChain = p.then(() => {}, () => {});
    return p;
  }
}

export { naturalFiles, MAX_FILES, MAX_BYTES, ImportQueue };
export default ImportQueue;
