import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import ClientDashboard from "./pages/ClientDashboard";
import Report from "./pages/Report";
import DynamicReport from "./pages/DynamicReport";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";

import AdminYouTubeAssets from "./pages/AdminYouTubeAssets";
import YouTubeAnalytics from "./pages/YouTubeAnalytics";
import XAnalytics from "./pages/XAnalytics";
import MetaAnalytics from "./pages/MetaAnalytics";
import TikTokAnalytics from "./pages/TikTokAnalytics";
import LinkedInAnalytics from "./pages/LinkedInAnalytics";
import TikTokMetricoolAnalytics from "./pages/TikTokMetricoolAnalytics";
import LinkedInMetricoolAnalytics from "./pages/LinkedInMetricoolAnalytics";
import AdsAnalytics from "./pages/AdsAnalytics";
import WebAnalytics from "./pages/WebAnalytics";
import UnifiedAnalytics from "./pages/UnifiedAnalytics";
import FatherFigureFormulaNov24to30 from "./pages/FatherFigureFormulaNov24to30";
import FatherFigureFormulaDec1to7 from "./pages/FatherFigureFormulaDec1to7";
import FatherFigureFormulaDec15to21 from "./pages/FatherFigureFormulaDec15to21";
import SnarkyHumansNov24to30 from "./pages/SnarkyHumansNov24to30";
import SnarkyHumansDec1to7 from "./pages/SnarkyHumansDec1to7";
import SnarkyHumansDec15to21 from "./pages/SnarkyHumansDec15to21";
import SnarkyPetsNov24to30 from "./pages/SnarkyPetsNov24to30";
import SnarkyPetsDec1to7 from "./pages/SnarkyPetsDec1to7";
import SnarkyPetsDec15to21 from "./pages/SnarkyPetsDec15to21";
import SerenityScrollsNov24to30 from "./pages/SerenityScrollsNov24to30";
import SerenityScrollsNov17to23 from "./pages/SerenityScrollsNov17to23";
import SerenityScrollsDec1to7 from "./pages/SerenityScrollsDec1to7";
import SerenityScrollsDec15to21 from "./pages/SerenityScrollsDec15to21";
import OxiSureTechNov24to30 from "./pages/OxiSureTechNov24to30";
import OxiSureTechDec1to7 from "./pages/OxiSureTechDec1to7";
import OxiSureTechDec15to21 from "./pages/OxiSureTechDec15to21";
import TheHavenAtDeerParkNov24to30 from "./pages/TheHavenAtDeerParkNov24to30";
import TheHavenAtDeerParkDec1to7 from "./pages/TheHavenAtDeerParkDec1to7";
import TheHavenAtDeerParkDec15to21 from "./pages/TheHavenAtDeerParkDec15to21";
import BsueBrowLashDec1to7 from "./pages/BsueBrowLashDec1to7";
import BsueBrowLashDec15to21 from "./pages/BsueBrowLashDec15to21";
import CissiePryorPresentsDec15to21 from "./pages/CissiePryorPresentsDec15to21";
import SienviAgencyDec15to21 from "./pages/SienviAgencyDec15to21";
import LuxxeAutoDec15to21 from "./pages/LuxxeAutoDec15to21";
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
import MetaAgencyOAuthCallback from "./pages/MetaAgencyOAuthCallback";
import TikTokOAuthCallback from "./pages/TikTokOAuthCallback";
import LinkedInOAuthCallback from "./pages/LinkedInOAuthCallback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/client/:clientId" element={<ClientDashboard />} />
          <Route path="/admin" element={<Admin />} />
          
          <Route path="/admin/youtube-assets" element={<AdminYouTubeAssets />} />
          <Route path="/report/:clientId/:reportId" element={<Report />} />
          <Route path="/dynamic-report/:reportId" element={<DynamicReport />} />
          <Route path="/youtube-analytics/:clientId" element={<YouTubeAnalytics />} />
          <Route path="/x-analytics/:clientId" element={<XAnalytics />} />
          <Route path="/meta-analytics/:clientId" element={<MetaAnalytics />} />
          <Route path="/tiktok-analytics/:clientId" element={<TikTokAnalytics />} />
          <Route path="/linkedin-analytics/:clientId" element={<LinkedInAnalytics />} />
          <Route path="/tiktok-metricool/:clientId" element={<TikTokMetricoolAnalytics />} />
          <Route path="/linkedin-metricool/:clientId" element={<LinkedInMetricoolAnalytics />} />
          <Route path="/web-analytics/:clientId" element={<WebAnalytics />} />
          <Route path="/ads-analytics/:clientId" element={<AdsAnalytics />} />
          <Route path="/analytics/:clientId" element={<UnifiedAnalytics />} />
          <Route path="/father-figure-formula-nov24-30" element={<FatherFigureFormulaNov24to30 />} />
          <Route path="/father-figure-formula-dec1-7" element={<FatherFigureFormulaDec1to7 />} />
          <Route path="/father-figure-formula-dec15-21" element={<FatherFigureFormulaDec15to21 />} />
          <Route path="/snarky-humans-nov24-30" element={<SnarkyHumansNov24to30 />} />
          <Route path="/snarky-humans-dec1-7" element={<SnarkyHumansDec1to7 />} />
          <Route path="/snarky-humans-dec15-21" element={<SnarkyHumansDec15to21 />} />
          <Route path="/snarky-pets-nov24-30" element={<SnarkyPetsNov24to30 />} />
          <Route path="/snarky-pets-dec1-7" element={<SnarkyPetsDec1to7 />} />
          <Route path="/snarky-pets-dec15-21" element={<SnarkyPetsDec15to21 />} />
          <Route path="/serenity-scrolls-nov24-30" element={<SerenityScrollsNov24to30 />} />
          <Route path="/serenity-scrolls-nov17-23" element={<SerenityScrollsNov17to23 />} />
          <Route path="/serenity-scrolls-dec1-7" element={<SerenityScrollsDec1to7 />} />
          <Route path="/serenity-scrolls-dec15-21" element={<SerenityScrollsDec15to21 />} />
          <Route path="/oxisure-tech-nov24-30" element={<OxiSureTechNov24to30 />} />
          <Route path="/oxisure-tech-dec1-7" element={<OxiSureTechDec1to7 />} />
          <Route path="/oxisure-tech-dec15-21" element={<OxiSureTechDec15to21 />} />
          <Route path="/the-haven-at-deer-park-nov24-30" element={<TheHavenAtDeerParkNov24to30 />} />
          <Route path="/the-haven-at-deer-park-dec1-7" element={<TheHavenAtDeerParkDec1to7 />} />
          <Route path="/the-haven-at-deer-park-dec15-21" element={<TheHavenAtDeerParkDec15to21 />} />
          <Route path="/bsue-brow-lash-dec1-7" element={<BsueBrowLashDec1to7 />} />
          <Route path="/bsue-brow-lash-dec15-21" element={<BsueBrowLashDec15to21 />} />
          <Route path="/cissie-pryor-presents-dec15-21" element={<CissiePryorPresentsDec15to21 />} />
          <Route path="/sienvi-agency-dec15-21" element={<SienviAgencyDec15to21 />} />
          <Route path="/luxxe-auto-dec15-21" element={<LuxxeAutoDec15to21 />} />
          <Route path="/oauth/meta/callback" element={<MetaOAuthCallback />} />
          <Route path="/oauth/meta/agency/callback" element={<MetaAgencyOAuthCallback />} />
          <Route path="/oauth/tiktok/callback" element={<TikTokOAuthCallback />} />
          <Route path="/oauth/linkedin/callback" element={<LinkedInOAuthCallback />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
