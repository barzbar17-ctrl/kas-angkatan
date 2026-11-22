import type { Sql } from '../../db/client.js';

export type AttachmentRow = {
  id: number;
  transactionId: number;
  objectPath: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  uploadedBy: number;
};

export async function insertAttachment(
  sql: Sql,
  a: Omit<AttachmentRow, 'id'> & { sha256: string },
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into attachments (transaction_id, object_path, original_name, mime, size_bytes, sha256, uploaded_by)
    values (${a.transactionId}, ${a.objectPath}, ${a.originalName}, ${a.mime}, ${a.sizeBytes}, ${a.sha256}, ${a.uploadedBy})
    returning id`;
  return (rows[0] as { id: number }).id;
}

export async function findAttachment(sql: Sql, id: number): Promise<AttachmentRow | undefined> {
  const rows = await sql<AttachmentRow[]>`
    select id, transaction_id, object_path, original_name, mime, size_bytes, uploaded_by from attachments where id = ${id}`;
  return rows[0];
}

export async function countForTransaction(sql: Sql, transactionId: number): Promise<number> {
  const rows = await sql<
    { n: number }[]
  >`select count(*)::bigint as n from attachments where transaction_id = ${transactionId}`;
  return rows[0]?.n ?? 0;
}
