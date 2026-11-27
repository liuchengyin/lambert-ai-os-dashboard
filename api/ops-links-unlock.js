import crypto from 'node:crypto';

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
  const ok = crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(hash, 'hex'));
  if (!ok) {
    return res.status(401).json({error: 'wrong_password'});
  }

  return res.json({ok: true});
}
