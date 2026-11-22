import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { MAX_UPLOAD_BYTES } from '../../domain/files.js';
import { AppError } from '../../domain/errors.js';
import { requires, type AuthVars } from '../../http/can.js';
import { noStore } from '../../http/etag.js';
import { actorWithIp } from '../../http/helpers.js';
import { intParam } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import { addAttachment, attachmentUrl } from './service.js';

// Badan multipart sedikit lebih besar dari berkas untuk pembatas bagian.
const UPLOAD_LIMIT = MAX_UPLOAD_BYTES + 64 * 1024;

export function attachmentRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.post(
    '/transactions/:id/attachments',
    requires('attachments.upload'),
    bodyLimit({
      maxSize: UPLOAD_LIMIT,
      onError: () => {
        throw new AppError('FILE_TOO_LARGE', 413, 'Berkas melebihi 4 MB.', {
          file: 'Berkas melebihi 4 MB.',
        });
      },
    }),
    async (c) => {
      noStore(c);
      const form = await c.req.formData().catch(() => {
        throw new AppError('VALIDATION', 422, 'Unggahan tidak valid.', {
          file: 'Pilih satu berkas.',
        });
      });
      const file = form.get('file');
      if (!(file instanceof File))
        throw new AppError('VALIDATION', 422, 'Pilih satu berkas.', { file: 'Pilih satu berkas.' });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await addAttachment(deps, actorWithIp(c), intParam(c.req.param('id')), {
        name: file.name,
        bytes,
      });
      return c.json({ data: result }, 201);
    },
  );

  r.get('/attachments/:id', requires('attachments.read'), async (c) => {
    noStore(c);
    return c.redirect(await attachmentUrl(deps, intParam(c.req.param('id'))), 302);
  });

  return r;
}
