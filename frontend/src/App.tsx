import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, ErrorBoundary } from './components';
import { 
  Dashboard, 
  PipelineList, 
  CreatePipeline, 
  PipelineDetail, 
  Monitoring
  // Settings 
} from './pages';
import './index.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipelines" element={<PipelineList />} />
            <Route path="/pipelines/create" element={<CreatePipeline />} />
            <Route path="/pipelines/:id" element={<PipelineDetail />} />
            <Route path="/monitoring" element={<Monitoring />} />
            {/* <Route path="/settings" element={<Settings />} /> */}
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
