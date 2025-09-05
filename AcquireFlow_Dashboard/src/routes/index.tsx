import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthPage } from '../components/Auth/AuthPage';
import { Dashboard } from '../components/Dashboard/Dashboard';
import ProtectedRoute from './ProtectedRoute';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { DealFinder } from '../components/DealFinder/DealFinder';
import { Campaigns } from '../components/Campaigns/Campaigns';
import { MarketIntelligence } from '../components/MarketIntelligence/MarketIntelligence';
import { ContactsPage } from '../components/Contacts/ContactsPage';
import { PipelinePage } from '../components/Pipeline/PipelinePage';
import { ReportsPage } from '../components/Reports/ReportsPage';
import { AccountSettings } from '../components/Settings/AccountSettings';
import { LOIGeneratorPage } from '../components/LOIGenerator/LOIGeneratorPage';
import { HelpCenter } from '../components/HelpCenter/HelpCenter';
import { KnowledgeBase } from '../components/HelpCenter/KnowledgeBase';
import { InteractiveSupport } from '../components/HelpCenter/InteractiveSupport';
import { LearningCenter } from '../components/HelpCenter/LearningCenter';
import { SelfServiceTools } from '../components/HelpCenter/SelfServiceTools';
import { PremiumSupport } from '../components/HelpCenter/PremiumSupport';
import { ResetPasswordForm } from '../components/Auth/ResetPasswordForm';
import { Inbox } from '../components/Inbox/Inbox';
import { propertyService } from '../services/propertyService';
import { PropertyDetailsModal } from '../components/DealFinder/PropertyDetailsModal';

export const AppRoutes: React.FC = () => {
  // Initialize currentPage from localStorage or default to 'Dashboard'
  const [currentPage, setCurrentPage] = useState(() => {
    const urlHash = typeof window !== 'undefined' ? window.location.hash : '';
    const hashMatch = urlHash?.match(/page=([^&]+)/);
    const pageFromHash = hashMatch ? decodeURIComponent(hashMatch[1]) : null;
    const savedPage = localStorage.getItem('acquireflow-current-page');
    return pageFromHash || savedPage || 'Dashboard';
  });
  
  // Update localStorage whenever currentPage changes
  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    localStorage.setItem('acquireflow-current-page', page);
  };
  // Keep URL hash in sync so refreshes preserve the current page reliably
  useEffect(() => {
    const encoded = encodeURIComponent(currentPage);
    const base = window.location.pathname + window.location.search;
    const newHash = `#page=${encoded}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', base + newHash);
    }
  }, [currentPage]);
  const renderPage = () => {
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard setActivePage={handlePageChange} />;
      case 'Deal Finder':
        return <DealFinder />;
      case 'Campaigns':
        return <Campaigns />;
      case 'Inbox':
        return <Inbox />;
      case 'Market Intelligence':
        return <MarketIntelligence />;
      case 'Contacts':
        return <ContactsPage />;
      case 'Pipeline':
        return <PipelinePage />;
      case 'Reports':
        return <ReportsPage />;
      case 'LOI Generator':
        return <LOIGeneratorPage />;
      case 'Settings':
        return <AccountSettings />;
      case 'Help Center':
        return <HelpCenter  />;
      case 'Knowledge Base':
        return <KnowledgeBase />;
      case 'Interactive Support':
        return <InteractiveSupport />;
      case 'Learning Center':
        return <LearningCenter />;
      case 'Self-Service Tools':
        return <SelfServiceTools />;
      case 'Premium Support':
        return <PremiumSupport />;
      default:
        return <Dashboard setActivePage={handlePageChange} />;
    }
  };
  return (
    <Routes>
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage />} />
      <Route path="/reset" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordForm />} />
      {/* Public share view, no auth */}
      <Route path="/share/:token" element={<PublicShareView />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
           <div className="flex h-screen w-full bg-gray-50 text-dark overflow-hidden">
      <Sidebar activePage={currentPage} setActivePage={handlePageChange} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header setActivePage={handlePageChange} />
        <main className="flex-1 overflow-auto">{renderPage()}</main>
      </div>
    </div>;
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const PublicShareView: React.FC = () => {
  const { token } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<any | null>(null);
  React.useEffect(() => {
    const run = async () => {
      try {
        if (!token) throw new Error('Missing token');
        const d = await propertyService.getSharedProperty(token);
        setData(d as any);
      } catch (e: any) {
        setError(e?.message || 'Failed to load shared property');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);
  if (loading) return <div className="p-8 text-center">Loading shared property...</div>;
  if (error || !data) return <div className="p-8 text-center text-red-600">{error || 'Not found'}</div>;
  // Minimal read-only view using the modal’s formatter
  const fake = {
    id: Number((data as any).id || 0),
    address: (data as any).address?.address || 'Property',
    city: (data as any).address?.city || '',
    state: (data as any).address?.state || '',
    price: (data as any).estimatedValue || 0,
    type: (data as any).propertyType || 'SFR',
    beds: (data as any).bedrooms || 0,
    baths: (data as any).bathrooms || 0,
    sqft: (data as any).squareFeet || 0,
    image: `https://source.unsplash.com/random/800x600/?house,${(data as any).id}`,
    cashFlow: 0,
    capRate: 0,
    roi: 0,
    rehabCost: 0,
    motivationFactors: [],
    daysOnMarket: 0,
    dealScore: 0,
    lat: (data as any).latitude || 0,
    lng: (data as any).longitude || 0,
  };
  return (
    <PropertyDetailsModal property={fake as any} onClose={() => (window.location.href = '/')} savedProperties={[]} allProperties={[]} />
  );
};

export default AppRoutes;
