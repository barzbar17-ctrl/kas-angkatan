// Skema validasi bersama frontend dan backend (SEC-07, PRD 8). Pesan ditulis untuk pengguna.
import { z } from 'zod';
import { ROLES } from './roles.js';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.');
const rupiah = z
  .number('Nominal wajib diisi.')
  .int('Nominal harus bilangan bulat.')
  .positive('Nominal harus lebih dari nol.')
  .max(1_000_000_000, 'Nominal terlalu besar.');
const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} wajib diisi.`).max(max, `${label} maksimal ${max} karakter.`);

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,32}$/,
    'Username 3 sampai 32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.',
  );
export const password = z
  .string()
  .min(8, 'Password minimal 8 karakter.')
  .max(128, 'Password maksimal 128 karakter.');
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{7,18}$/, 'Nomor telepon tidak valid.');
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, 'Email terlalu panjang.')
  .email('Email tidak valid.');
const role = z.enum(ROLES, 'Peran tidak valid.');

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Username wajib diisi.').max(64),
  password: z.string().min(1, 'Password wajib diisi.').max(128),
});

export const memberCreateSchema = z.object({
  username,
  name: text('Nama', 80),
  phone,
  email,
  password,
  role,
});
export const memberUpdateSchema = z
  .object({ name: text('Nama', 80), phone, email, role })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada yang diubah.');
export const passwordSetSchema = z.object({ password });
export const roleSetSchema = z.object({ role });

export const semesterCreateSchema = z.object({
  label: text('Label', 60),
  startDate: ymd,
  endDate: ymd,
  openingBalance: z
    .number()
    .int('Saldo awal harus bilangan bulat.')
    .min(0, 'Saldo awal tidak boleh negatif.')
    .max(1_000_000_000),
});
export const semesterUpdateSchema = z
  .object({ label: text('Label', 60), endDate: ymd })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada yang diubah.');

export const periodsGenerateSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  amount: rupiah,
  dryRun: z.boolean().optional(),
});

export const categoryCreateSchema = z.object({
  kind: z.enum(['in', 'out']),
  name: text('Nama kategori', 40),
});
export const categoryUpdateSchema = z
  .object({ name: text('Nama kategori', 40), isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada yang diubah.');

export const paymentPreviewSchema = z.object({
  userId: z.number().int().positive(),
  amount: rupiah,
});
export const paymentCreateSchema = paymentPreviewSchema.extend({ receivedOn: ymd });

export const transactionCreateSchema = z
  .object({
    kind: z.enum(['in', 'out']),
    categoryId: z.number().int().positive('Kategori wajib dipilih.'),
    amount: rupiah,
    occurredOn: ymd,
    description: text('Keterangan', 200),
    urgency: z.string().trim().max(120).optional(),
    replacesId: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'out' && !v.urgency) {
      ctx.addIssue({
        code: 'custom',
        path: ['urgency'],
        message: 'Urgensi wajib diisi untuk pengeluaran.',
      });
    }
  });
export const voidSchema = z.object({ reason: text('Alasan', 200) });

export const reconciliationCreateSchema = z.object({
  cashCounted: z
    .number('Saldo tunai wajib diisi.')
    .int('Harus bilangan bulat.')
    .min(0, 'Tidak boleh negatif.')
    .max(1_000_000_000, 'Nominal terlalu besar.'),
  bankCounted: z
    .number('Saldo rekening wajib diisi.')
    .int('Harus bilangan bulat.')
    .min(0, 'Tidak boleh negatif.')
    .max(1_000_000_000, 'Nominal terlalu besar.'),
  note: z.string().trim().max(300, 'Catatan maksimal 300 karakter.').optional(),
});
export const semesterCloseSchema = z.object({
  label: text('Label', 60),
  startDate: ymd,
  endDate: ymd,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
