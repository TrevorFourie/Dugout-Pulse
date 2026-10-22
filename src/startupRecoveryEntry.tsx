import React from 'react';
import { createRoot } from 'react-dom/client';
import { StartupRecoveryPanel } from './components/StartupRecoveryPanel';
import './index.css';

const root = document.getElementById('startup-recovery-root');
if (root) {
  const params = new URLSearchParams(window.location.search);
  createRoot(root).render(<StartupRecoveryPanel errorReference={params.get('ref') || ''} />);
}
