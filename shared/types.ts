// Bentuk respons API yang dipakai bersama (FLX-04). Uang selalu integer rupiah, tanggal bisnis YYYY-MM-DD.
import type { Permission } from './permissions.js';
import type { Role } from './roles.js';

export type Me = {
  user: { id: number; username: string; name: string; phone: string; email: string; role: Role };
  csrfToken: string;
  permissions: Permission[];
};

export type SemesterInfo = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  status: 'active' | 'closed';
};

export type LastReconciliation = {
  id: number;
  createdAt: string;
  systemBalance: number;
  actual: number;
  difference: number;
  note: string | null;
};

export type Summary = {
  semester: SemesterInfo | null;
  balance: number;
  totalIn: number;
  totalOut: number;
  delinquentMembers?: number;
  lastReconciliation: LastReconciliation | null;
  /** Pengeluaran aktif tanpa lampiran (TRX-07); hanya untuk ketua dan bendahara. */
  expensesWithoutProof?: number;
};

export type DueTiming = 'belum_jatuh_tempo' | 'jatuh_tempo' | 'menunggak' | 'selesai';
export type DueInvoice = {
  id: number;
  weekNo: number;
  label: string;
  dueDate: string;
  amountDue: number;
  paid: number;
  remaining: number;
  status: 'lunas' | 'belum_bayar';
  timing: DueTiming;
};
export type DuesSummaryDto = {
  totalWeeks: number;
  lunasWeeks: number;
  overdueWeeks: number;
  overdueAmount: number;
  paidThroughWeek: number | null;
  status: 'lunas' | 'menunggak';
};
export type PaymentHistoryItem = {
  id: number;
  transactionId: number;
  receivedOn: string;
  amount: number;
  weeks: string;
  voided: boolean;
};
export type DuesView = {
  member: { id: number; name: string };
  semester: SemesterInfo | null;
  summary: DuesSummaryDto;
  invoices: DueInvoice[];
  payments: PaymentHistoryItem[];
  treasurer: { name: string; phone: string } | null;
};

export type DuesOverviewItem = {
  id: number;
  name: string;
  username: string;
  role: Role;
  summary: DuesSummaryDto;
};

export type TxRow = {
  type: 'transaction';
  id: number;
  kind: 'in' | 'out';
  amount: number;
  occurredOn: string;
  description: string;
  urgency: string | null;
  categoryId: number;
  categoryName: string;
  voided: boolean;
  hasAttachment: boolean;
  isDues: boolean;
  payerName: string | null;
};
export type TxAggregate = {
  type: 'dues_aggregate';
  occurredOn: string;
  count: number;
  amount: number;
};
export type TxItem = TxRow | TxAggregate;
export type TxDay = { date: string; items: TxItem[] };
export type TxList = { days: TxDay[]; totals: { in: number; out: number } };

export type TxDetail = TxRow & {
  semesterId: number;
  createdBy: { id: number; name: string };
  createdAt: string;
  void: { reason: string; by: string; at: string } | null;
  replacesId: number | null;
  replacedById: number | null;
  allocations: { weekNo: number; label: string; amount: number }[];
  attachments: { id: number; mime: string; name: string }[];
};

export type PaymentPlanItem = {
  invoiceId: number;
  weekNo: number;
  label: string;
  amount: number;
  settles: boolean;
  remainingAfter: number;
};
export type PaymentPreview = {
  member: { id: number; name: string };
  totalRemaining: number;
  allocations: PaymentPlanItem[];
};
export type PaymentResult = {
  paymentId: number;
  transactionId: number;
  member: { id: number; name: string };
  paidThroughWeek: number | null;
  replayed: boolean;
};

export type MemberItem = {
  id: number;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  isActive: boolean;
};
export type Category = {
  id: number;
  kind: 'in' | 'out';
  name: string;
  isSystem: boolean;
  isActive: boolean;
};
export type Notice = { id: number; kind: string; message: string; createdAt: string };
export type AuditItem = {
  id: number;
  actorId: number;
  actorName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: string;
};
export type PeriodsPreview = {
  weeks: { weekNo: number; label: string; dueDate: string }[];
  memberCount: number;
  amount: number;
  totalPerMember: number;
};
export type Period = {
  id: number;
  weekNo: number;
  label: string;
  dueDate: string;
  defaultAmount: number;
};

export type ReconciliationItem = {
  id: number;
  semesterId: number;
  createdAt: string;
  systemBalance: number;
  cashCounted: number;
  bankCounted: number;
  actual: number;
  difference: number;
  note: string | null;
  createdByName: string;
};

export type CategoryTotal = {
  categoryId: number;
  name: string;
  kind: 'in' | 'out';
  total: number;
  count: number;
};
export type MonthlyReport = {
  month: string;
  semester: SemesterInfo | null;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  categories: CategoryTotal[];
};
