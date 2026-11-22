import { useState } from 'react';
import type { AuditItem } from '../../../shared/types';
import { useIdentity } from '../../lib/auth';
import { formatWaktu } from '../../lib/format';
import { useAuditLogs, useMembers, type AuditFilter } from '../../lib/queries';
import { ACTIONS } from '../../lib/auditLabels';
import { useNearEnd } from '../../lib/useNearEnd';
import { AppBar } from '../../components/clay/AppBar';
import { Button } from '../../components/clay/Button';
import { EmptyState } from '../../components/clay/EmptyState';
import { Field, SelectField } from '../../components/clay/Field';
import { ListRow } from '../../components/clay/ListRow';
import { QueryState } from '../../components/clay/QueryState';
import { Sheet } from '../../components/clay/Sheet';
import { Skeleton } from '../../components/clay/Skeleton';
import { Card } from '../../components/clay/Surface';

function DetailSheet({ item, onClose }: { item: AuditItem; onClose: () => void }) {
  const json = (v: unknown) => (v == null ? '-' : JSON.stringify(v, null, 2));
  return (
    <Sheet title={ACTIONS[item.action] ?? item.action} onClose={onClose}>
      <div className="t-small muted">
        {item.actorName}, {formatWaktu(item.createdAt)}
      </div>
      {item.reason ? <div className="t-small">Alasan: {item.reason}</div> : null}
      <div className="kv__label">Sebelum</div>
      <pre className="clay-sunken t-caption" style={{ padding: 12, overflowX: 'auto', margin: 0 }}>
        {json(item.before)}
      </pre>
      <div className="kv__label">Sesudah</div>
      <pre className="clay-sunken t-caption" style={{ padding: 12, overflowX: 'auto', margin: 0 }}>
        {json(item.after)}
      </pre>
    </Sheet>
  );
}

function AuditRows({ items, onOpen }: { items: AuditItem[]; onOpen: (a: AuditItem) => void }) {
  return (
    <Card pad="list">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onOpen(a)}
          style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}
        >
          <ListRow
            icon={a.action.includes('void') ? 'ban' : 'shield'}
            tone={a.action.includes('void') ? 'rose' : 'purple'}
            title={ACTIONS[a.action] ?? a.action}
            sub={`${a.actorName} · ${formatWaktu(a.createdAt)}`}
          />
        </button>
      ))}
    </Card>
  );
}

function AuditSkeleton() {
  return (
    <Card pad="list">
      {[0, 1, 2].map((i) => (
        <div key={i} className="row">
          <Skeleton w={44} h={44} r={14} />
          <Skeleton w="60%" h={16} />
          <span />
        </div>
      ))}
    </Card>
  );
}

function AuditList({ filter }: { filter: AuditFilter }) {
  const [open, setOpen] = useState<AuditItem>();
  const q = useAuditLogs(useIdentity(), filter);
  const sentinel = useNearEnd(
    () => void q.fetchNextPage(),
    Boolean(q.hasNextPage) && !q.isFetchingNextPage,
  );
  return (
    <>
      <QueryState query={q} skeleton={<AuditSkeleton />}>
        {(data) => {
          const items = data.pages.flatMap((p) => p.data);
          if (items.length === 0)
            return (
              <EmptyState
                icon="shield"
                title="Belum ada aktivitas"
                text="Aksi tulis akan tercatat di sini."
              />
            );
          return (
            <>
              <AuditRows items={items} onOpen={setOpen} />
              <div ref={sentinel} />
              {q.hasNextPage ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={q.isFetchingNextPage}
                  loadingText="Memuat…"
                  onClick={() => void q.fetchNextPage()}
                >
                  Muat lebih banyak
                </Button>
              ) : null}
            </>
          );
        }}
      </QueryState>
      {open ? <DetailSheet item={open} onClose={() => setOpen(undefined)} /> : null}
    </>
  );
}

type Draft = { action: string; actor: string; from: string; to: string };

function Filters({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const members = useMembers(useIdentity(), '').data ?? [];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <SelectField
        label="Jenis aksi"
        value={draft.action}
        onChange={(e) => set({ action: e.target.value })}
      >
        <option value="">Semua aksi</option>
        {Object.entries(ACTIONS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Pelaku"
        value={draft.actor}
        onChange={(e) => set({ actor: e.target.value })}
      >
        <option value="">Semua pelaku</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>
      <div className="stat-pair">
        <Field
          label="Dari tanggal"
          type="date"
          value={draft.from}
          onChange={(e) => set({ from: e.target.value })}
        />
        <Field
          label="Sampai tanggal"
          type="date"
          value={draft.to}
          onChange={(e) => set({ to: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function AuditPage() {
  const [draft, setDraft] = useState<Draft>({ action: '', actor: '', from: '', to: '' });
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const filter: AuditFilter = {
    action: draft.action || undefined,
    actorId: Number(draft.actor) || undefined,
    from: draft.from || undefined,
    to: draft.to || undefined,
  };
  return (
    <div className="stack">
      <AppBar title="Audit Log" />
      <Filters draft={draft} set={set} />
      <AuditList filter={filter} />
    </div>
  );
}
