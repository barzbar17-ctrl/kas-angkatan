// Mendaftar seluruh objek pada bucket Supabase Storage secara rekursif dan berhalaman.
// Entri folder memiliki id null; entri berkas memiliki id.
const PAGE = 100;

export async function listAllObjects(bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error('Gagal mendaftar objek');
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) out.push(...(await listAllObjects(bucket, path)));
      else out.push(path);
    }
    if (data.length < PAGE) return out;
  }
}
