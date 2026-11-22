import { Link, useParams } from 'react-router-dom';
import { useCan, useIdentity } from '../../lib/auth';
import { useMemberDues } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Hero } from '../../components/clay/Surface';
import { DuesBody } from '../dues/DuesBody';

/** Rincian iuran satu anggota untuk ketua dan bendahara (DUE-04). */
export default function MemberDuesPage() {
  const memberId = Number(useParams().id);
  const q = useMemberDues(useIdentity(), memberId);
  const canPay = useCan('payments.create');
  return (
    <div className="stack">
      <AppBar title={q.data?.member.name ?? 'Anggota'} sub="Rincian iuran" back />
      <QueryState
        query={q}
        skeleton={
          <Hero>
            <Skeleton w="40%" h={14} />
            <Skeleton w="60%" h={36} style={{ marginTop: 12 }} />
          </Hero>
        }
      >
        {(d) => (
          <>
            <DuesBody dues={d} own={false} />
            {canPay ? (
              <div className="sticky-bar">
                <Link
                  className="btn"
                  data-variant="primary"
                  data-block="true"
                  to={`/pembayaran/baru?user=${memberId}`}
                >
                  Catat pembayaran
                </Link>
              </div>
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  );
}
