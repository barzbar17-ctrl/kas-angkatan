import type { Sql } from '../../db/client.js';

export type PaymentRow = {
  id: number;
  userId: number;
  amount: number;
  receivedOn: string;
  transactionId: number;
};

export async function findByKey(sql: Sql, key: string): Promise<PaymentRow | undefined> {
  const rows = await sql<
    PaymentRow[]
  >`select id, user_id, amount, received_on, transaction_id from payments where idempotency_key = ${key}`;
  return rows[0];
}

export async function insertPayment(
  sql: Sql,
  p: {
    userId: number;
    amount: number;
    receivedOn: string;
    transactionId: number;
    idempotencyKey: string;
    recordedBy: number;
  },
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into payments (user_id, amount, received_on, transaction_id, idempotency_key, recorded_by)
    values (${p.userId}, ${p.amount}, ${p.receivedOn}, ${p.transactionId}, ${p.idempotencyKey}, ${p.recordedBy})
    returning id`;
  return (rows[0] as { id: number }).id;
}

export async function insertAllocations(
  sql: Sql,
  paymentId: number,
  items: readonly { invoiceId: number; amount: number }[],
): Promise<void> {
  const rows = items.map((i) => ({ paymentId, invoiceId: i.invoiceId, amount: i.amount }));
  await sql`insert into payment_allocations ${sql(rows)}`;
}
