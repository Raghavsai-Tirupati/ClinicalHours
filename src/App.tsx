import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { useAppKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Lazy load pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Opportunities = lazy(() => import("./pages/Opportunities"));
const OpportunityDetail = lazy(() => import("./pages/OpportunityDetail"));
const Projects = lazy(() => import("./pages/Projects"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MapView = lazy(() => import("./pages/MapView"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const CheckEmail = lazy(() => import("./pages/CheckEmail"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TestHeaders = lazy(() => import("./pages/TestHeaders"));
const AuthTest = lazy(() => import("./pages/AuthTest"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ApplicationForm = lazy(() => import("./pages/ApplicationForm"));
const HospitalAdmin = lazy(() => import("./pages/HospitalAdmin"));
const HospitalOnboarding = lazy(() => import("./pages/HospitalOnboarding"));
const HospitalDashboard = lazy(() => import("./pages/HospitalDashboard"));
const HospitalApply = lazy(() => import("./pages/HospitalApply"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/opportunities/:slug" element={<OpportunityDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/check-email" element={<CheckEmail />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify" element={<VerifyEmail />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/test-headers" element={<TestHeaders />} />
              <Route path="/auth-test" element={<AuthTest />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/opportunities/:slug/application" element={<ApplicationForm />} />
              <Route path="/opportunities/:slug/admin" element={<HospitalAdmin />} />
              <Route path="/hospital/onboarding" element={<HospitalOnboarding />} />
              <Route path="/hospital/admin" element={<HospitalDashboard />} />
              <Route path="/hospital/apply/:accountId" element={<HospitalApply />} />
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
