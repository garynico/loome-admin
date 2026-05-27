import { SignJWT, jwtVerify } from 'jose'

const ADMIN_USERNAME = 'loome'
const ADMIN_PASSWORD = 'hairremoval'
const COOKIE_NAME = 'loome-admin-token'

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET env var is not set')
  return new TextEncoder().encode(secret)
}

export function checkCredentials(username: string, password: string) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

export async function signToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.admin === true
  } catch {
    return false
  }
}

export { COOKIE_NAME }
