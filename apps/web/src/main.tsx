import { render } from 'preact';
import { App } from './app';
import { initTheme } from './theme';
import './styles/tokens.css';
import './styles/components.css';

// Initialize Theme early (ADR-029)
initTheme();

const rootElement = document.getElementById('app');
if (rootElement) {
  render(<App />, rootElement);
}