import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import PageViewTracker from "./components/PageViewTracker";
import { StudentOnlyRoute } from "./components/StudentOnlyRoute";
import { useAppKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Lazy load pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Opportunities = lazy(() => import("./pages/Opportunities"));
const OpportunityDetail = lazy(() => import("./pages/OpportunityDetail"));
const Projects = lazy(() => import("./pages/Projects"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const Settings = lazy(() => import("./pages/Settings"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MapView = lazy(() => import("./pages/MapView"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const CheckEmail = lazy(() => import("./pages/CheckEmail"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ApplicationForm = lazy(() => import("./pages/ApplicationForm"));
const HospitalAdmin = lazy(() => import("./pages/HospitalAdmin"));
const HospitalDashboardPage = lazy(() => import("./pages/HospitalDashboard"));
const MyApplications = lazy(() => import("./pages/MyApplications"));
const HospitalApplyPage = lazy(() => import("./pages/HospitalApplyPage"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Hospital admin dashboard (position system)
const HospitalDashboardLayout = lazy(() => import("./layouts/HospitalDashboardLayout"));
const HospitalOverview = lazy(() => import("./components/hospital/HospitalOverview"));
const PositionForm = lazy(() => import("./components/hospital/PositionForm"));
const PositionDetail = lazy(() => import("./components/hospital/PositionDetail"));
const HospitalSettingsPage = lazy(() => import("./components/hospital/HospitalSettings"));
const PositionApplyPage = lazy(() => import("./pages/PositionApplyPage"));
const HospitalDashboardRedirect = lazy(() => import("./components/HospitalDashboardRedirect"));

// Premium feature pages
const Premium = lazy(() => import("./pages/Premium"));
const PremiumPurchase = lazy(() => import("./pages/PremiumPurchase"));
const HourTracker = lazy(() => import("./pages/HourTracker"));
const OpportunityQuiz = lazy(() => import("./pages/OpportunityQuiz"));
const CompetencyMapper = lazy(() => import("./pages/CompetencyMapper"));
const AMCASGenerator = lazy(() => import("./pages/AMCASGenerator"));
const LORTracker = lazy(() => import("./pages/LORTracker"));
const TimelinePlanner = lazy(() => import("./pages/TimelinePlanner"));
const SecondaryEngine = lazy(() => import("./pages/SecondaryEngine"));
const CostSimulator = lazy(() => import("./pages/CostSimulator"));
const SchoolListBuilder = lazy(() => import("./pages/SchoolListBuilder"));


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
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/opportunities/:slug/application" element={<StudentOnlyRoute><ApplicationForm /></StudentOnlyRoute>} />
              <Route path="/opportunities/:slug/apply" element={<StudentOnlyRoute><HospitalApplyPage /></StudentOnlyRoute>} />
              <Route path="/opportunities/:slug/admin" element={<HospitalAdmin />} />
              <Route path="/hospital-dashboard" element={<HospitalDashboardRedirect />}>
                <Route index element={<HospitalOverview />} />
                <Route path="positions/new" element={<PositionForm />} />
                <Route path="positions/:positionId" element={<PositionDetail />} />
                <Route path="positions/:positionId/edit" element={<PositionForm />} />
                <Route path="settings" element={<HospitalSettingsPage />} />
              </Route>
              <Route path="/hospital/admin" element={<HospitalDashboardRedirect />}>
                <Route index element={<HospitalOverview />} />
              </Route>
              <Route path="/pending-approval" element={<PendingApproval />} />
              {/* Hospital admin dashboard with sidebar layout */}
              <Route path="/hospital/:id" element={<HospitalDashboardLayout />}>
                <Route index element={<HospitalOverview />} />
                <Route path="positions/new" element={<PositionForm />} />
                <Route path="positions/:positionId" element={<PositionDetail />} />
                <Route path="positions/:positionId/edit" element={<PositionForm />} />
                <Route path="settings" element={<HospitalSettingsPage />} />
              </Route>
              {/* Student application form for a position */}
              <Route path="/apply/:positionId" element={<PositionApplyPage />} />
              {/* Premium features */}
              <Route path="/premium" element={<Premium />} />
              <Route path="/premium/purchase" element={<PremiumPurchase />} />
              <Route path="/hours" element={<HourTracker />} />
              <Route path="/quiz" element={<OpportunityQuiz />} />
              <Route path="/competencies" element={<CompetencyMapper />} />
              <Route path="/amcas" element={<AMCASGenerator />} />
              <Route path="/lor" element={<LORTracker />} />
              <Route path="/timeline" element={<TimelinePlanner />} />
              <Route path="/secondaries" element={<SecondaryEngine />} />
              <Route path="/costs" element={<CostSimulator />} />
              <Route path="/school-list" element={<SchoolListBuilder />} />
              <Route path="/apply-finder" element={<DirectApplicationFinder />} />
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
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
