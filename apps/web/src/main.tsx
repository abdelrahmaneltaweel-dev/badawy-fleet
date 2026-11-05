import { render } from 'preact';
import { App } from './app';
import { initTheme } from './theme';
import { initPWA } from './pwa';
import './styles/tokens.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/motion.css';

// Initialize Theme & PWA early (ADR-014, ADR-028, ADR-029)
initTheme();
initPWA();

const rootElement = document.getElementById('app');
if (rootElement) {
  render(<App />, rootElement);
}