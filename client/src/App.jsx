import { Routes, Route } from 'react-router-dom';
import { SessionProvider } from './SessionContext.jsx';
import Home from './pages/Home.jsx';

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </SessionProvider>
  );
}
