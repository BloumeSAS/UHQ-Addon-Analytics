import { Routes, Route } from 'react-router-dom';
import { AddonProvider } from './context';
import MyActivity from './pages/MyActivity';
import Admin from './pages/Admin';
import DashboardWidget from './widgets/DashboardWidget';

/**
 * Routes :
 *   /                  → « Mon activité » (tout utilisateur)
 *   /admin             → panneau d'analyse complet (ADMIN / SUPPORT)
 *   /widget/dashboard  → widget compact du Dashboard du panel
 */
export default function App() {
  return (
    <AddonProvider>
      <Routes>
        <Route path="/" element={<MyActivity />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/widget/dashboard" element={<DashboardWidget />} />
      </Routes>
    </AddonProvider>
  );
}
