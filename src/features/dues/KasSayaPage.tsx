import { useEffect, useRef } from 'react';
import { useIdentity } from '../../lib/auth';
import { enterCards } from '../../lib/motion';
import { useMeDues } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Hero } from '../../components/clay/Surface';
import { DuesBody } from './DuesBody';

export default function KasSayaPage() {
  const q = useMeDues(useIdentity());
  const scope = useRef<HTMLDivElement>(null);
  useEffect(() => (scope.current && q.data ? enterCards(scope.current) : undefined), [q.data]);
  return (
    <div ref={scope} className="stack">
      <AppBar title="Kas Saya" />
      <QueryState
        query={q}
        skeleton={
          <Hero>
            <Skeleton w="40%" h={14} />
            <Skeleton w="60%" h={36} style={{ marginTop: 12 }} />
          </Hero>
        }
      >
        {(d) => <DuesBody dues={d} own />}
      </QueryState>
    </div>
  );
}
