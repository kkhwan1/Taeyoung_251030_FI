/**
 * Simple Toast Notification Utility
 * Provides a lightweight toast interface without external dependencies
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

class ToastManager {
  private container: HTMLElement | null = null;
  private toastCount = 0;

  private ensureContainer() {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
    return this.container;
  }

  private show(message: string, type: ToastType, options: ToastOptions = {}) {
    const container = this.ensureContainer();
    const duration = options.duration ?? 3000;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    this.toastCount++;

    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6',
      warning: '#f59e0b'
    };

    const icons = {
      success: '',
      error: '×',
      info: 'i',
      warning: '!'
    };

    toast.style.cssText = `
      background: white;
      border-left: 4px solid ${colors[type]};
      padding: 1rem;
      border-radius: 0.375rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      min-width: 300px;
      max-width: 500px;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: slideIn 0.3s ease-out;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const icon = document.createElement('div');
    icon.textContent = icons[type];
    icon.style.cssText = `
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      background: ${colors[type]};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-weight: bold;
    `;

    const text = document.createElement('div');
    text.textContent = message;
    text.style.cssText = `
      flex: 1;
      color: #1f2937;
      font-size: 0.875rem;
      line-height: 1.25rem;
    `;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    // Add animation styles if not already present
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Auto-remove after duration
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
        // Clean up container if empty
        if (container.children.length === 0 && document.body.contains(container)) {
          document.body.removeChild(container);
          this.container = null;
        }
      }, 300);
    }, duration);
  }

  success(message: string, options?: ToastOptions) {
    this.show(message, 'success', options);
  }

  error(message: string, options?: ToastOptions) {
    this.show(message, 'error', options);
  }

  info(message: string, options?: ToastOptions) {
    this.show(message, 'info', options);
  }

  warning(message: string, options?: ToastOptions) {
    this.show(message, 'warning', options);
  }
}

// Export singleton instance
export const toast = new ToastManager();

// Re-export for flexibility
export default toast;
