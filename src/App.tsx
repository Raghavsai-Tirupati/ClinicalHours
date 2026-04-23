import { lazy, Suspense } from "react";
import type React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import PageViewTracker from "./components/PageViewTracker";
import { StudentOnlyRoute } from "./components/StudentOnlyRoute";
import { HospitalOnlyRoute } from "./components/HospitalOnlyRoute";
import { AdminOnlyRoute } from "./components/AdminOnlyRoute";
import { useAppKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { AuthProvider } from "./hooks/useAuth";

// Retry wrapper for lazy imports — handles chunk-loading failures after deploys
function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err) => {
      // If we already tried reloading, don't loop
      const key = 'chunk_reload';
      const hasReloaded = sessionStorage.getItem(key);
      if (!hasReloaded) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {}); // never resolves — page is reloading
      }
      sessionStorage.removeItem(key);
      throw err; // let ErrorBoundary handle it
    }),
  );
}

const Home = lazyRetry(() => import("./pages/Home"));
const Opportunities = lazyRetry(() => import("./pages/Opportunities"));
const OpportunityDetail = lazyRetry(() => import("./pages/OpportunityDetail"));
const Projects = lazyRetry(() => import("./pages/Projects"));
const Contact = lazyRetry(() => import("./pages/Contact"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const MapView = lazyRetry(() => import("./pages/MapView"));
const Terms = lazyRetry(() => import("./pages/Terms"));
const Privacy = lazyRetry(() => import("./pages/Privacy"));
const CheckEmail = lazyRetry(() => import("./pages/CheckEmail"));
const VerifyEmail = lazyRetry(() => import("./pages/VerifyEmail"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const AdminDashboard = lazyRetry(() => import("./pages/AdminDashboard"));
const HospitalAdmin = lazyRetry(() => import("./pages/HospitalAdmin"));
const MyApplications = lazyRetry(() => import("./pages/MyApplications"));
const HospitalApplyPage = lazyRetry(() => import("./pages/HospitalApplyPage"));
const PendingApproval = lazyRetry(() => import("./pages/PendingApproval"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const GoogleAuthCallback = lazyRetry(() => import("./pages/GoogleAuthCallback"));

// Hospital admin dashboard (position system)
const HospitalDashboardLayout = lazyRetry(() => import("./layouts/HospitalDashboardLayout"));
const PositionForm = lazyRetry(() => import("./components/hospital/PositionForm"));
const CopyPositionForm = lazyRetry(() => import("./components/hospital/CopyPositionForm"));
const PositionDetail = lazyRetry(() => import("./components/hospital/PositionDetail"));
const ApplicantProfilePage = lazyRetry(() => import("./components/hospital/ApplicantProfilePage"));
const ApplicantPersonPage = lazyRetry(() => import("./components/hospital/ApplicantPersonPage"));
const HospitalSettingsPage = lazyRetry(() => import("./components/hospital/HospitalSettings"));
const PositionsHub = lazyRetry(() => import("./components/hospital/PositionsHub"));
const ApplicationsHub = lazyRetry(() => import("./components/hospital/ApplicationsHub"));
const InterviewsPage = lazyRetry(() => import("./components/hospital/InterviewsPage"));
const EmailPage = lazyRetry(() => import("./components/hospital/EmailPage"));
const EmailCommunication = lazyRetry(() => import("./components/clinic-dashboard/email-communication/EmailCommunication"));
const ActivityPage = lazyRetry(() => import("./components/hospital/ActivityPage"));
const VolunteerManagement = lazyRetry(() => import("./components/clinic-dashboard/volunteer-management/VolunteerManagement"));
const WaitlistModule = lazyRetry(() => import("./components/clinic-dashboard/waitlist/WaitlistModule"));
// Volunteer Tracker is now a sub-tab inside the Team (VolunteerManagement) page.
// Legacy /volunteer-tracker routes redirect to /team?tab=tracker.
const WaitlistPage = lazyRetry(() => import("./components/waitlist/WaitlistPage"));
const ClinicOnboard = lazyRetry(() => import("./pages/ClinicOnboard"));
const PositionApplyPage = lazyRetry(() => import("./pages/PositionApplyPage"));
const HospitalDashboardRedirect = lazyRetry(() => import("./components/HospitalDashboardRedirect"));

// Premium feature pages
const Premium = lazyRetry(() => import("./pages/Premium"));
const PremiumPurchase = lazyRetry(() => import("./pages/PremiumPurchase"));
const HourTracker = lazyRetry(() => import("./pages/HourTracker"));
const CompetencyMapper = lazyRetry(() => import("./pages/CompetencyMapper"));
const AMCASGenerator = lazyRetry(() => import("./pages/AMCASGenerator"));
const SecondaryEngine = lazyRetry(() => import("./pages/SecondaryEngine"));
const CostSimulator = lazyRetry(() => import("./pages/CostSimulator"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Run keyboard shortcuts within Router context so useNavigate works correctly
function KeyboardShortcuts() {
  useAppKeyboardShortcuts();
  return null;
}

function AppContent() {
  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <KeyboardShortcuts />
        <ScrollToTop />
        <PageViewTracker />
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/opportunities" element={<StudentOnlyRoute><Opportunities /></StudentOnlyRoute>} />
              <Route path="/opportunities/:slug" element={<StudentOnlyRoute><OpportunityDetail /></StudentOnlyRoute>} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Settings />} />
              <Route path="/dashboard" element={<StudentOnlyRoute><Dashboard /></StudentOnlyRoute>} />
              <Route path="/my-applications" element={<StudentOnlyRoute><MyApplications /></StudentOnlyRoute>} />
              <Route path="/map" element={<StudentOnlyRoute><MapView /></StudentOnlyRoute>} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/check-email" element={<CheckEmail />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify" element={<VerifyEmail />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/admin"
                element={
                  <AdminOnlyRoute>
                    <AdminDashboard />
                  </AdminOnlyRoute>
                }
              />
              <Route path="/opportunities/:slug/apply" element={<StudentOnlyRoute><HospitalApplyPage /></StudentOnlyRoute>} />
              <Route
                path="/opportunities/:slug/admin"
                element={
                  <HospitalOnlyRoute>
                    <HospitalAdmin />
                  </HospitalOnlyRoute>
                }
              />
              <Route
                path="/hospital-dashboard"
                element={
                  <HospitalOnlyRoute>
                    <HospitalDashboardRedirect />
                  </HospitalOnlyRoute>
                }
              >
                <Route index element={<ApplicationsHub />} />
                <Route path="positions" element={<PositionsHub />} />
                <Route path="positions/new" element={<PositionForm />} />
                <Route path="positions/copy" element={<CopyPositionForm />} />
                <Route path="positions/:positionId" element={<PositionDetail />} />
                <Route path="positions/:positionId/edit" element={<PositionForm />} />
                <Route path="applicants/:applicationId" element={<ApplicantProfilePage />} />
                <Route path="people/:studentId" element={<ApplicantPersonPage />} />
                <Route path="interviews" element={<InterviewsPage />} />
                <Route path="email" element={<EmailCommunication />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="team" element={<VolunteerManagement />} />
                <Route path="waitlist" element={<WaitlistModule />} />
                <Route path="volunteer-tracker" element={<Navigate to="../team?tab=tracker" replace />} />
                <Route path="settings" element={<HospitalSettingsPage />} />
                <Route path="applications" element={<ApplicationsHub />} />
              </Route>
              <Route
                path="/hospital/admin"
                element={
                  <HospitalOnlyRoute>
                    <HospitalDashboardRedirect />
                  </HospitalOnlyRoute>
                }
              >
                <Route index element={<ApplicationsHub />} />
                <Route path="applications" element={<ApplicationsHub />} />
              </Route>
              <Route path="/pending-approval" element={<PendingApproval />} />
              {/* Hospital admin dashboard with sidebar layout */}
              <Route path="/hospital/:id" element={<HospitalDashboardLayout />}>
                <Route index element={<ApplicationsHub />} />
                <Route path="positions" element={<PositionsHub />} />
                <Route path="positions/new" element={<PositionForm />} />
                <Route path="positions/copy" element={<CopyPositionForm />} />
                <Route path="positions/:positionId" element={<PositionDetail />} />
                <Route path="positions/:positionId/edit" element={<PositionForm />} />
                <Route path="applicants/:applicationId" element={<ApplicantProfilePage />} />
                <Route path="people/:studentId" element={<ApplicantPersonPage />} />
                <Route path="interviews" element={<InterviewsPage />} />
                <Route path="email" element={<EmailCommunication />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="team" element={<VolunteerManagement />} />
                <Route path="waitlist" element={<WaitlistModule />} />
                <Route path="volunteer-tracker" element={<Navigate to="../team?tab=tracker" replace />} />
                <Route path="settings" element={<HospitalSettingsPage />} />
                <Route path="applications" element={<ApplicationsHub />} />
              </Route>
              {/* Public waitlist form */}
              <Route path="/waitlist/:slug" element={<WaitlistPage />} />
              {/* Existing staff onboarding link */}
              <Route path="/clinic-onboard/:clinicId" element={<ClinicOnboard />} />
              {/* Student application form for a position */}
              <Route path="/apply/:positionId" element={<PositionApplyPage />} />
              {/* Premium features */}
              <Route path="/premium" element={<Premium />} />
              <Route path="/premium/purchase" element={<PremiumPurchase />} />
              <Route path="/hours" element={<HourTracker />} />
              <Route path="/competencies" element={<CompetencyMapper />} />
              <Route path="/amcas" element={<AMCASGenerator />} />
              <Route path="/secondaries" element={<SecondaryEngine />} />
              <Route path="/costs" element={<CostSimulator />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" storageKey="clinicalhours-theme">
        <AuthProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
