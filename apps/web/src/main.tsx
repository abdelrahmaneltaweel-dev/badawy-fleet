import { render } from 'preact';
import { App } from './app';

const rootElement = document.getElementById('app');
if (rootElement) {
  render(<App />, rootElement);
}