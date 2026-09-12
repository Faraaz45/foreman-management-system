import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { DbService } from './db.service';

export interface User { username: string; role: 'admin' | 'foreman' }
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex'); // new secret per boot = sessions reset on restart
const sign = (v: string) => v + '.' + createHmac('sha256', SECRET).update(v).digest('hex');
const cookie = (req: any) => { const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([^;]+)/); return m && decodeURIComponent(m[1]); };
/** cookie value = base64(json user).signature */
export const readUser = (req: any): User | null => {
  const tok = cookie(req); if (!tok) return null;
  const [payload] = tok.split('.'); if (tok !== sign(payload)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
};
export const admin = (req: any) => { if (req.user?.role !== 'admin') throw new ForbiddenException('Admin only'); };

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (req.path === '/api/login') return true;
    req.user = readUser(req);
    if (!req.user) throw new UnauthorizedException();
    return true;
  }
}

@Controller()
export class AuthController {
  constructor(private db: DbService) {}
  @Post('login')
  async login(@Body() b: { username?: string; password?: string }, @Res({ passthrough: true }) res: any) {
    const { rows } = await this.db.q('SELECT * FROM users WHERE username=$1', [String(b?.username || '').trim()]);
    if (!rows[0] || !this.db.checkPw(String(b?.password || ''), rows[0].password_hash)) throw new UnauthorizedException('Invalid credentials');
    const user: User = { username: rows[0].username, role: rows[0].role };
    res.cookie('sid', sign(Buffer.from(JSON.stringify(user)).toString('base64url')), { httpOnly: true, sameSite: 'lax', path: '/' });
    return user;
  }
  @Post('logout')
  logout(@Res({ passthrough: true }) res: any) { res.clearCookie('sid', { path: '/' }); return { ok: true }; }
  @Get('me')
  me(@Req() req: any) { return req.user; }
}
