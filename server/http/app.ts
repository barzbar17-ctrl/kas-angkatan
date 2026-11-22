// Router tipis (AR-01). Aturan bisnis ada di service, SQL di repository; berkas ini hanya merangkai middleware.
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AppError } from '../domain/errors.js';
import type { Deps } from '../support/deps.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import { originCheck } from './csrf.js';
import { csrfToken, resolveSession } from './auth.js';
import { noStore } from './etag.js';
import { rejectNul } from './validate.js';
import type { AuthVars } from './can.js';
import { authRoutes } from '../modules/auth/routes.js';
import { auditRoutes } from '../modules/audit/routes.js';
import { categoryRoutes } from '../modules/categories/routes.js';
import { duesRoutes } from '../modules/dues/routes.js';
import { memberRoutes } from '../modules/users/routes.js';
import { paymentRoutes } from '../modules/payments/routes.js';
import { semesterRoutes } from '../modules/semesters/routes.js';
import { summaryRoutes } from '../modules/summary/routes.js';
import { transactionRoutes } from '../modules/transactions/routes.js';
import { attachmentRoutes } from '../modules/attachments/routes.js';
import { reconciliationRoutes } from '../modules/reconciliations/routes.js';
import { reportRoutes } from '../modules/reports/routes.js';
import { cronRoutes } from '../modules/cron/routes.js';

const JSON_LIMIT = 64 * 1024; // SX-02
const UPLOAD_PATH = /\/transactions\/\d+\/attachments$/;

export function createApp(deps: Deps): Hono<AuthVars> {
  const app = new Hono<AuthVars>().basePath('/api/v1');

  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.use(originCheck(deps.appOrigin));
  // Batas 64 KB untuk JSON (SX-02); unggahan bukti punya batas 4 MB sendiri di rutenya.
  const jsonLimit = bodyLimit({
    maxSize: JSON_LIMIT,
    onError: () => {
      throw new AppError('BODY_TOO_LARGE', 413, 'Data yang dikirim terlalu besar.');
    },
  });
  app.use((c, next) =>
    c.req.method === 'POST' && UPLOAD_PATH.test(c.req.path) ? next() : jsonLimit(c, next),
  );
  app.use(rejectNul());
  app.use(resolveSession(deps));
  app.use(csrfToken());

  app.get('/health', (c) => {
    noStore(c);
    return c.json({ data: { status: 'ok', time: deps.clock.now().toISOString() } });
  });

  app.route('/auth', authRoutes(deps));
  // Rute dues didaftarkan sebelum /members agar /members/:id/dues tidak tertahan izin members.manage.
  app.route('/', duesRoutes(deps));
  app.route('/', summaryRoutes(deps));
  app.route('/', semesterRoutes(deps));
  app.route('/members', memberRoutes(deps));
  app.route('/transactions', transactionRoutes(deps));
  app.route('/payments', paymentRoutes(deps));
  app.route('/categories', categoryRoutes(deps));
  app.route('/audit-logs', auditRoutes(deps));
  app.route('/', attachmentRoutes(deps));
  app.route('/reconciliations', reconciliationRoutes(deps));
  app.route('/', reportRoutes(deps));
  app.route('/cron', cronRoutes(deps));
  return app;
}
