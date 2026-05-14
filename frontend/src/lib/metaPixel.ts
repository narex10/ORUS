/** Meta Pixel para CRM Zap (PageView + Purchase no browser). */
export function loadMetaPixel(pixelId: string): void {
  if (!pixelId?.trim() || typeof window === 'undefined') return;

  const w = window as Window & {
    fbq?: (...args: unknown[]) => void;
    _orusPixelId?: string;
  };

  if (w._orusPixelId === pixelId && typeof w.fbq === 'function') return;

  if (!w.fbq) {
    const boot = new Function(`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    `);
    boot();
  }

  const tryInit = () => {
    if (typeof w.fbq === 'function') {
      w.fbq('init', pixelId);
      w.fbq('track', 'PageView');
      w._orusPixelId = pixelId;
      return true;
    }
    return false;
  };

  if (tryInit()) return;

  let tries = 0;
  const id = window.setInterval(() => {
    tries++;
    if (tryInit() || tries > 200) window.clearInterval(id);
  }, 50);
}

export function trackPurchase(value: number, currency = 'BRL'): void {
  const win = window as Window & { fbq?: (...args: unknown[]) => void };
  if (typeof win.fbq === 'function') {
    win.fbq('track', 'Purchase', { value, currency });
  }
}
