import crypto from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'method_not_allowed'});
  }

  const hash = process.env.LINKS_VIEW_PASSWORD_HASH;
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return res.status(503).json({error: 'not_configured'});
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || password.length > 256) {
    return res.status(400).json({error: 'invalid_password'});
  }

  const actual = crypto.createHash('sha256').update(password).digest();
  const expected = Buffer.from(hash, 'hex');
  const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  if (!ok) {
    return res.status(401).json({error: 'wrong_password'});
  }

  return res.json({ok: true});
}
