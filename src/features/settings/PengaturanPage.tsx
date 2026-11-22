import { useIdentity } from '../../lib/auth';
import { useSemesters } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Card } from '../../components/clay/Surface';
import { CategoriesCard } from './CategoriesCard';
import { CloseSemesterCard } from './CloseSemesterCard';
import { PeriodsCard } from './PeriodsCard';
import { SemesterCard } from './SemesterCard';

export default function PengaturanPage() {
  const q = useSemesters(useIdentity());
  return (
    <div className="stack">
      <AppBar title="Pengaturan" back="/lainnya" />
      <QueryState
        query={q}
        skeleton={
          <Card>
            <Skeleton w="50%" h={20} />
          </Card>
        }
      >
        {(list) => {
          const active = list.find((s) => s.status === 'active');
          return (
            <>
              <SemesterCard semester={active} />
              <PeriodsCard hasSemester={Boolean(active)} />
              <CategoriesCard />
              {active ? <CloseSemesterCard semester={active} /> : null}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
