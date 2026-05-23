import { Routes, Route } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Home from './pages/Home.jsx';
import SavedMeals from './pages/SavedMeals.jsx';
import Archive from './pages/Archive.jsx';
import SessionDetail from './pages/SessionDetail.jsx';

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/saved-meals" element={<SavedMeals />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/archive/:id" element={<SessionDetail />} />
      </Routes>
    </>
  );
}
