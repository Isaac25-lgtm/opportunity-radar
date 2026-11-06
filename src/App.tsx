import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout, PublicLayout, RequireAuth } from './components/Layout';
import { Spinner } from './components/ui';
import Home from './pages/public/Home';

const p = <T,>(f: () => Promise<{ default: T }>) => lazy(f as any);
const CvBuilderLanding = p(() => import('./pages/public/CvBuilderLanding'));
const Templates = p(() => import('./pages/public/Templates'));
const HowItWorks = p(() => import('./pages/public/HowItWorks'));
const Pricing = p(() => import('./pages/public/Pricing'));
const Help = p(() => import('./pages/public/Help'));
const Contact = p(() => import('./pages/public/Contact'));
const Legal = p(() => import('./pages/public/Legal'));
const Sources = p(() => import('./pages/public/Sources'));
const SignIn = p(() => import('./pages/public/Auth').then((m) => ({ default: m.SignIn })));
const SignUp = p(() => import('./pages/public/Auth').then((m) => ({ default: m.SignUp })));
const Forgot = p(() => import('./pages/public/Auth').then((m) => ({ default: m.Forgot })));
const Reset = p(() => import('./pages/public/Auth').then((m) => ({ default: m.Reset })));
const NotFound = p(() => import('./pages/public/NotFound'));
const MockCheckout = p(() => import('./pages/public/MockCheckout'));

const Dashboard = p(() => import('./pages/app/Dashboard'));
const Onboarding = p(() => import('./pages/app/Onboarding'));
const Profiles = p(() => import('./pages/app/Profiles'));
const ProfileEditor = p(() => import('./pages/app/ProfileEditor'));
const Opportunities = p(() => import('./pages/app/Opportunities'));
const OpportunityDetail = p(() => import('./pages/app/OpportunityDetail'));
const Saved = p(() => import('./pages/app/Saved'));
const Tracker = p(() => import('./pages/app/Tracker'));
const CvList = p(() => import('./pages/app/CvList'));
const CvEditor = p(() => import('./pages/app/CvEditor'));
const CvPrint = p(() => import('./pages/app/CvPrint'));
const CvImport = p(() => import('./pages/app/CvImport'));
const CoverLetter = p(() => import('./pages/app/CoverLetter'));
const Documents = p(() => import('./pages/app/Documents'));
const Notifications = p(() => import('./pages/app/Notifications'));
const Settings = p(() => import('./pages/app/Settings'));
const Billing = p(() => import('./pages/app/Billing'));
const BillingReturn = p(() => import('./pages/app/BillingReturn'));

const AdminLayout = p(() => import('./pages/admin/AdminLayout'));
const AdminOverview = p(() => import('./pages/admin/Overview'));
const AdminUsers = p(() => import('./pages/admin/Users'));
const AdminSources = p(() => import('./pages/admin/Sources'));
const AdminRuns = p(() => import('./pages/admin/Runs'));
const AdminOpportunities = p(() => import('./pages/admin/Opportunities'));
const AdminOpportunityEdit = p(() => import('./pages/admin/OpportunityEdit'));
const AdminPlans = p(() => import('./pages/admin/Plans'));
const AdminPayments = p(() => import('./pages/admin/Payments'));
const AdminAudit = p(() => import('./pages/admin/Audit'));
const AdminConfig = p(() => import('./pages/admin/Config'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<Spinner className="min-h-[60vh]" />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="cv-builder" element={<CvBuilderLanding />} />
            <Route path="templates" element={<Templates />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="help" element={<Help />} />
            <Route path="contact" element={<Contact />} />
            <Route path="privacy" element={<Legal kind="privacy" />} />
            <Route path="terms" element={<Legal kind="terms" />} />
            <Route path="sources" element={<Sources />} />
            <Route path="opportunities" element={<Opportunities publicMode />} />
            <Route path="opportunities/:id" element={<OpportunityDetail publicMode />} />
            <Route path="signin" element={<SignIn />} />
            <Route path="signup" element={<SignUp />} />
            <Route path="forgot-password" element={<Forgot />} />
            <Route path="reset-password" element={<Reset />} />
            <Route
              path="mock-checkout/:tracking"
              element={
                <RequireAuth>
                  <MockCheckout />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route
            path="app/cvs/:id/edit"
            element={
              <RequireAuth>
                <CvEditor />
              </RequireAuth>
            }
          />
          <Route
            path="app/cvs/:id/print"
            element={
              <RequireAuth>
                <CvPrint />
              </RequireAuth>
            }
          />
          <Route path="app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="profiles" element={<Profiles />} />
            <Route path="profiles/:type" element={<ProfileEditor />} />
            <Route path="opportunities" element={<Opportunities />} />
            <Route path="opportunities/:id" element={<OpportunityDetail />} />
            <Route path="saved" element={<Saved />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="cvs" element={<CvList />} />
            <Route path="cvs/import" element={<CvImport />} />
            <Route path="cover-letters/:id" element={<CoverLetter />} />
            <Route path="documents" element={<Documents />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="billing" element={<Billing />} />
            <Route path="billing/return" element={<BillingReturn />} />
          </Route>
          <Route
            path="admin"
            element={
              <RequireAuth admin>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="sources" element={<AdminSources />} />
            <Route path="runs" element={<AdminRuns />} />
            <Route path="opportunities" element={<AdminOpportunities />} />
            <Route path="opportunities/new" element={<AdminOpportunityEdit />} />
            <Route path="opportunities/:id" element={<AdminOpportunityEdit />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="config" element={<AdminConfig />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
