import { Bookmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OpportunityCard, type OppSummary } from '../../components/opportunity';
import { EmptyState, ErrorAlert, PageHeader, Spinner, useLoad, useToast } from '../../components/ui';
import { api } from '../../lib/api';

export default function Saved() {
  const toast = useToast();
  const { data, error, loading, setData } = useLoad(
    () => api.get<{ items: OppSummary[] }>('/opportunities/saved'),
    [],
  );
  return (
    <>
      <PageHeader
        title="Saved opportunities"
        subtitle="We remind you three days before a saved opportunity closes."
      />
      <ErrorAlert error={error} />
      {loading ? (
        <Spinner />
      ) : data?.items.length ? (
        <div className="space-y-3">
          {data.items.map((o) => (
            <OpportunityCard
              key={o.id}
              o={o}
              onSave={async (x) => {
                await api.del(`/opportunities/${x.id}/state`);
                setData({ items: data.items.filter((i) => i.id !== x.id) });
                toast('Removed from saved', 'info');
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bookmark className="h-10 w-10" />}
          title="Nothing saved yet"
          action={
            <Link to="/app/opportunities" className="btn btn-md btn-primary">
              Browse opportunities
            </Link>
          }
        >
          Save opportunities you want to come back to.
        </EmptyState>
      )}
    </>
  );
}
