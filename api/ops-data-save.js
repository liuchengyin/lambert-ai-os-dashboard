import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'method_not_allowed'});
  }

  const configured = process.env.OPS_LINKS_PASSWORD_HASH || '';
  const [salt, hash] = configured.split('$');
  if (!/^[a-f0-9]{16,64}$/i.test(salt || '') || !/^[a-f0-9]{64}$/i.test(hash || '')) {
    return res.status(503).json({error: 'not_configured'});
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || password.length > 256) {
    return res.status(400).json({error: 'invalid_password'});
  }
  const actual = crypto.createHash('sha256').update(salt + password).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(hash, 'hex'))) {
    return res.status(401).json({error: 'wrong_password'});
  }

  const text = typeof req.body?.data === 'string' ? req.body.data : '';
  if (!text || Buffer.byteLength(text) > 2 * 1024 * 1024) {
    return res.status(400).json({error: 'invalid_data'});
  }

  let parsed;
  try { parsed = JSON.parse(text); } catch { return res.status(400).json({error: 'invalid_json'}); }
  if (!Array.isArray(parsed) || parsed.some(r => !r || typeof r !== 'object' || !r.id || !r.name)) {
    return res.status(400).json({error: 'invalid_shape'});
  }

  const target = process.env.OPS_ROLE_DATA_FILE || '/var/www/lambert/role-menu-data.json';
  const tmp = target + '.tmp-' + process.pid + '-' + Date.now();
  try {
    await fs.writeFile(tmp, JSON.stringify({roles: parsed, revision: 1, updatedAt: new Date().toISOString()}, null, 2));
    await fs.rename(tmp, target);
  } catch (error) {
    await fs.unlink(tmp).catch(() => {});
    return res.status(500).json({error: 'write_failed'});
  }

  return res.json({ok: true, roles: parsed.length});
}
