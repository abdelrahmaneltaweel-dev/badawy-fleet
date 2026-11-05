export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface PWAState {
  updateAvailable: boolean;
  canInstall: boolean;
  install: () => Promise<void>;
  update: () => void;
}

type PWAStateListener = (state: PWAState) => void;
const listeners = new Set<PWAStateListener>();

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
let isUpdateAvailable = false;
let canInstall = false;

function notify() {
  const state: PWAState = {
    updateAvailable: isUpdateAvailable,
    canInstall,
    install: async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        canInstall = false;
        deferredPrompt = null;
        notify();
      }
    },
    update: () => {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    }
  };
  listeners.forEach((fn) => fn(state));
}

export function subscribePWA(listener: PWAStateListener): () => void {
  listeners.add(listener);
  notify();
  return () => {
    listeners.delete(listener);
  };
}

export function initPWA() {
  if (typeof window === 'undefined') return;

  // Listen for native install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    canInstall = true;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    canInstall = false;
    deferredPrompt = null;
    notify();
  });

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((registration) => {
          if (registration.waiting) {
            waitingWorker = registration.waiting;
            isUpdateAvailable = true;
            notify();
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorker = newWorker;
                isUpdateAvailable = true;
                notify();
              }
            });
          });
        })
        .catch((err) => {
          console.warn('PWA registration failed:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}