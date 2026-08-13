import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Sanctuary from './pages/Sanctuary';
import MindmapCanvas from './pages/Canvas';
import AiChat from './pages/Chat';
import Playground from './pages/Playground';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import About from './pages/About';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/sanctuary" element={<Sanctuary />} />
          <Route path="/canvas" element={<MindmapCanvas />} />
          <Route path="/chat" element={<AiChat />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
