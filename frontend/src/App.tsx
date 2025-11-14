import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/LayoutNew';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Campaigns from './pages/Campaigns';
import Logs from './pages/Logs';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
