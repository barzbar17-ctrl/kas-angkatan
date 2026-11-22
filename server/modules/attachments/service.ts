import { createHash, randomUUID } from 'node:crypto';
import {
  MAX_ATTACHMENTS_PER_TRANSACTION,
  MAX_UPLOAD_BYTES,
  detectFile,
  sanitizeName,
} from '../../domain/files.js';
import { AppError } from '../../domain/errors.js';
import { withTransaction } from '../../db/withTransaction.js';
import type { Actor } from '../../support/actor.js';
import type { Deps } from '../../support/deps.js';
import { insertAudit } from '../audit/repository.js';
import { findById as findSemester } from '../semesters/repository.js';
import { findDetail } from '../transactions/repository.js';
import * as repo from './repository.js';

const SIGNED_URL_SECONDS = 60;

function storageOf(deps: Deps) {
  if (!deps.storage)
    throw new AppError('STORAGE_UNAVAILABLE', 503, 'Penyimpanan bukti belum dikonfigurasi.');
  return deps.storage;
}

async function assertCanAttach(deps: Deps, transactionId: number): Promise<void> {
  const t = await findDetail(deps.sql, transactionId);
  if (!t) throw new AppError('NOT_FOUND', 404, 'Transaksi tidak ditemukan.');
  if (t.kind !== 'out' || t.paymentId !== null)
    throw new AppError('NOT_ATTACHABLE', 409, 'Bukti hanya untuk pengeluaran.');
  if (t.voided) throw new AppError('TRANSACTION_VOIDED', 409, 'Transaksi ini sudah dibatalkan.');
  if ((await findSemester(deps.sql, t.semesterId))?.status !== 'active') {
    throw new AppError('SEMESTER_CLOSED', 409, 'Semester ini sudah ditutup.');
  }
  if (
    (await repo.countForTransaction(deps.sql, transactionId)) >= MAX_ATTACHMENTS_PER_TRANSACTION
  ) {
    throw new AppError(
      'TOO_MANY_ATTACHMENTS',
      409,
      `Maksimal ${MAX_ATTACHMENTS_PER_TRANSACTION} bukti per transaksi.`,
    );
  }
}

/** TRX-03, SEC-12: tipe dari magic bytes, batas 4 MB, nama objek acak, bucket privat. */
export async function addAttachment(
  deps: Deps,
  actor: Actor,
  transactionId: number,
  file: { name: string; bytes: Uint8Array },
): Promise<{ id: number; mime: string }> {
  const storage = storageOf(deps);
  if (file.bytes.byteLength === 0)
    throw new AppError('VALIDATION', 422, 'Berkas kosong.', { file: 'Berkas kosong.' });
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES)
    throw new AppError('FILE_TOO_LARGE', 413, 'Berkas melebihi 4 MB.', {
      file: 'Berkas melebihi 4 MB.',
    });
  const detected = detectFile(file.bytes);
  if (!detected) {
    throw new AppError('UNSUPPORTED_FILE', 422, 'Hanya foto (JPG, PNG, WebP) atau PDF.', {
      file: 'Hanya foto (JPG, PNG, WebP) atau PDF.',
    });
  }
  await assertCanAttach(deps, transactionId);
  const objectPath = `transactions/${transactionId}/${randomUUID()}.${detected.ext}`;
  await storage.put(objectPath, file.bytes, detected.mime);
  const sha256 = createHash('sha256').update(file.bytes).digest('hex');
  const name = sanitizeName(file.name);
  const id = await withTransaction(deps.sql, async (tx) => {
    const newId = await repo.insertAttachment(tx, {
      transactionId,
      objectPath,
      originalName: name,
      mime: detected.mime,
      sizeBytes: file.bytes.byteLength,
      sha256,
      uploadedBy: actor.id,
    });
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'attachment.add',
      entityType: 'transaction',
      entityId: transactionId,
      after: { attachmentId: newId, mime: detected.mime, size: file.bytes.byteLength, name },
      ip: actor.ip,
    });
    return newId;
  });
  return { id, mime: detected.mime };
}

/** CCH-14: pengalihan ke URL bertanda tangan berumur 60 detik; berkas tidak lewat fungsi. */
export async function attachmentUrl(deps: Deps, id: number): Promise<string> {
  const a = await repo.findAttachment(deps.sql, id);
  if (!a) throw new AppError('NOT_FOUND', 404, 'Bukti tidak ditemukan.');
  return storageOf(deps).signedUrl(a.objectPath, SIGNED_URL_SECONDS);
}
