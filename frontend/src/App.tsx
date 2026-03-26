import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import CampaignPage from './pages/CampaignPage';
import GeneratePage from './pages/GeneratePage';
import PostDetailPage from './pages/PostDetailPage';
import BrandKitPage from './pages/BrandKitPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/campaigns/:id" element={<CampaignPage />} />
        <Route path="/campaigns/:id/generate" element={<GeneratePage />} />
        <Route path="/posts/:id" element={<PostDetailPage />} />
        <Route path="/brand-kit" element={<BrandKitPage />} />
      </Route>
    </Routes>
  );
}
