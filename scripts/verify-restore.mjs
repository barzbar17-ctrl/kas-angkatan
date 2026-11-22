// Membandingkan dua basis data (produksi vs hasil pemulihan): saldo, jumlah transaksi, dan jumlah audit log harus sama.
// Variabel: SOURCE_DATABASE_URL, RESTORED_DATABASE_URL. Keluar 1 bila ada yang berbeda.
import postgres from 'postgres';

async function snapshot(url) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [r] = await sql`
      select
        (select count(*) from transactions)::int as transactions,
        (select count(*) from audit_logs)::int as audit_logs,
        (select count(*) from payments)::int as payments,
        (select count(*) from payment_allocations)::int as allocations,
        (select count(*) from transaction_voids)::int as voids,
        (select count(*) from users)::int as users,
        (select coalesce(sum(opening_balance), 0) from semesters)::bigint
          + (select coalesce(sum(amount) filter (where kind = 'in'), 0) from transactions t where not exists (select 1 from transaction_voids v where v.transaction_id = t.id))::bigint
          - (select coalesce(sum(amount) filter (where kind = 'out'), 0) from transactions t where not exists (select 1 from transaction_voids v where v.transaction_id = t.id))::bigint as balance`;
    const guards =
      await sql`select count(*)::int as n from pg_trigger where tgname like '%_no_mutation' and not tgisinternal`;
    return { ...r, append_only_triggers: guards[0].n };
  } finally {
    await sql.end();
  }
}

const a = await snapshot(process.env.SOURCE_DATABASE_URL);
const b = await snapshot(process.env.RESTORED_DATABASE_URL);
console.table({ sumber: a, pulihan: b });
const diff = Object.keys(a).filter((k) => String(a[k]) !== String(b[k]));
if (diff.length > 0) {
  console.error(`BERBEDA pada: ${diff.join(', ')}`);
  process.exit(1);
}
console.log('Pemulihan cocok: saldo, transaksi, audit log, dan pengaman append-only sama.');
