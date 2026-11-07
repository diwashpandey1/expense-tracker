import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { firebaseReady } from './lib/firebase'
import { LoadingState } from './components/ui'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const BudgetsPage = lazy(() => import('./pages/BudgetsPage'))
const GoalsPage = lazy(() => import('./pages/GoalsPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AccountsPage = lazy(() => import('./pages/AccountsPage'))
const RecurringPage = lazy(() => import('./pages/RecurringPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const AppLayout = lazy(() => import('./components/AppLayout'))
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))

function FirebaseSetup() {
  return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] p-6">
    <section className="max-w-lg rounded-3xl border border-[#e5e9e1] bg-white p-8 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#738679]">AVORA · PERSONAL FINANCE</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1b3025]">Connect your fresh Firebase project</h1>
      <p className="mt-3 text-sm leading-6 text-[#748078]">Add the web app values from your new Firebase project to the local .env file, then restart Vite. No old project values are used.</p>
      <pre className="mt-5 overflow-x-auto rounded-xl bg-[#f3f5f1] p-4 text-xs leading-6 text-[#35473b]">VITE_FIREBASE_API_KEY=…{ '\n' }VITE_FIREBASE_AUTH_DOMAIN=…{ '\n' }VITE_FIREBASE_PROJECT_ID=…{ '\n' }VITE_FIREBASE_APP_ID=…</pre>
    </section>
  </main>
}

function AuthGate({ children }) {
  const { user, profile, loading, profileLoading } = useAuth()
  if (loading || profileLoading) return <LoadingState />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <ProfileSetupPage />
  if (profile.onboardingStatus === 'not_started' || profile.onboardingStatus === 'in_progress') return <OnboardingPage />
  return children
}

function PublicGate({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState />
  if (user) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  if (!firebaseReady) return <FirebaseSetup />
  return <Suspense fallback={<LoadingState label="Opening AVORA" />}>
    <Routes>
      <Route path="/" element={<PublicGate><HomePage /></PublicGate>} />
      <Route path="/about" element={<PublicGate><AboutPage /></PublicGate>} />
      <Route path="/contact" element={<PublicGate><ContactPage /></PublicGate>} />
      <Route path="/blog" element={<PublicGate><BlogPage /></PublicGate>} />
      <Route path="/tools/*" element={<PublicGate><ToolsPage /></PublicGate>} />
      <Route path="/login" element={<PublicGate><LoginPage /></PublicGate>} />
      <Route path="/signup" element={<PublicGate><SignupPage /></PublicGate>} />
      <Route path="/reset-password" element={<PublicGate><ResetPasswordPage /></PublicGate>} />
      <Route path="/auth/login" element={<PublicGate><LoginPage /></PublicGate>} />
      <Route path="/auth/signup" element={<PublicGate><SignupPage /></PublicGate>} />
      <Route path="/auth/forgot-password" element={<PublicGate><ResetPasswordPage /></PublicGate>} />
      <Route path="/forget-password" element={<PublicGate><ResetPasswordPage /></PublicGate>} />
      <Route path="/profile" element={<Navigate to="/app/settings" replace />} />
      <Route path="/app" element={<AuthGate><AppLayout /></AuthGate>}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="tools/*" element={<ToolsPage basePath="/app/tools" embedded />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  </Suspense>
}
