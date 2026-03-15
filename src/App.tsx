import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LangProvider } from "@/components/LanguageToggle";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import Index from "./pages/Index";
import SearchPage from "./pages/Search";
import DashboardPage from "./pages/Dashboard";
import AuthPage from "./pages/Auth";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import RoleSelection from "./pages/RoleSelection";
import ProviderProfile from "./pages/ProviderProfile";
import EditProfile from "./pages/EditProfile";
import Admin from "./pages/Admin";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import NewMission from "./pages/NewMission";
import MissionDetail from "./pages/MissionDetail";
import Messages from "./pages/Messages";
import Conversations from "./pages/Conversations";
import Verification from "./pages/Verification";
import FAQ from "./pages/FAQ";
import CategoryPage from "./pages/CategoryPage";
import ProviderWallet from "./pages/ProviderWallet";
import ClientSpending from "./pages/ClientSpending";
import PublicProfile from "./pages/PublicProfile";
import GlobalCallListener from "./components/GlobalCallListener";
import PWAInstallBanner from "./components/PWAInstallBanner";
import RealtimeMessageToast from "./components/RealtimeMessageToast";
import OnboardingGuide from "./components/OnboardingGuide";

const queryClient = new QueryClient();

function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  usePushNotifications();
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PushNotificationProvider>
          <LangProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <GlobalCallListener />
                <RealtimeMessageToast />
                <PWAInstallBanner />
                
                <OnboardingGuide />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/recherche" element={<SearchPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/choix-role" element={<RoleSelection />} />
                  <Route path="/prestataire/:id" element={<ProviderProfile />} />
                  <Route path="/profil/modifier" element={<EditProfile />} />
                  <Route path="/reglages" element={<SettingsPage />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/nouvelle-mission" element={<NewMission />} />
                  <Route path="/mission/:id" element={<MissionDetail />} />
                  <Route path="/conversations" element={<Conversations />} />
                  <Route path="/messages/:missionId" element={<Messages />} />
                  <Route path="/verification" element={<Verification />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/categorie/:name" element={<CategoryPage />} />
                  <Route path="/portefeuille" element={<ProviderWallet />} />
                  <Route path="/depenses" element={<ClientSpending />} />
                  <Route path="/p/:slug" element={<PublicProfile />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </LangProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
