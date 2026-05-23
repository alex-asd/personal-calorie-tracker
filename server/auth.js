import crypto from 'node:crypto';

export function basicAuth(req, res, next) {
  const expected = process.env.TRACKER_PASSWORD;
  if (!expected) return next();

  const header = req.headers.authorization;
  if (header?.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    if (colon !== -1) {
      const supplied = decoded.slice(colon + 1);
      if (timingSafeEqual(supplied, expected)) return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="calorie-tracker"');
  res.status(401).end();
}

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
