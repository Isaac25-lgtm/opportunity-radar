import { useState } from 'react';
import { Alert, Button, ErrorAlert, SelectInput, TextArea, TextInput } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function Contact() {
  const { me } = useAuth();
  const [f, setF] = useState({
    name: me.user?.name ?? '',
    email: me.user?.email ?? '',
    topic: 'other',
    message: '',
  });
  const [err, setErr] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const details = err instanceof ApiError ? (err.details ?? {}) : {};
  return (
    <section className="py-14">
      <div className="container-page grid max-w-5xl gap-12 md:grid-cols-[1fr_1.2fr]">
        <div>
          <h1 className="text-[36px] font-extrabold sm:text-[44px]">Contact us</h1>
          <p className="mt-3 text-lg text-ink-600">
            Questions about your account, an opportunity listing, a payment or your data? Send us a message
            and an administrator will reply by email.
          </p>
          <p className="mt-6 text-sm text-ink-500">
            To report a suspicious or fraudulent listing, choose “Opportunity listing” and include the link.
            We never charge application fees.
          </p>
        </div>
        <form
          className="card space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await api.post('/public/contact', f);
              setSent(true);
            } catch (x) {
              setErr(x);
            } finally {
              setBusy(false);
            }
          }}
        >
          {sent ? (
            <Alert tone="ok" title="Message sent">
              Thank you — we will reply to {f.email}.
            </Alert>
          ) : (
            <>
              <ErrorAlert error={err} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  label="Your name"
                  required
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  error={details.name}
                  autoComplete="name"
                />
                <TextInput
                  label="Email"
                  type="email"
                  required
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                  error={details.email}
                  autoComplete="email"
                />
              </div>
              <SelectInput
                label="Topic"
                value={f.topic}
                onChange={(e) => setF({ ...f, topic: e.target.value })}
                options={[
                  { value: 'account', label: 'My account' },
                  { value: 'opportunity', label: 'Opportunity listing' },
                  { value: 'payment', label: 'Payment' },
                  { value: 'privacy', label: 'Privacy / my data' },
                  { value: 'partnership', label: 'Partnership / source suggestion' },
                  { value: 'other', label: 'Something else' },
                ]}
              />
              <TextArea
                label="Message"
                required
                minLength={10}
                value={f.message}
                onChange={(e) => setF({ ...f, message: e.target.value })}
                error={details.message}
              />
              <Button type="submit" loading={busy} className="w-full">
                Send message
              </Button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
