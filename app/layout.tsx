import type { Metadata, Viewport } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Montserrat - primary display font (brand reference)
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: true,
  variable: "--font-montserrat",
});

// Inter - fallback
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#05110B" },
    { media: "(prefers-color-scheme: dark)", color: "#05110B" },
  ],
};

export const metadata: Metadata = {
  title: "FlipPay",
  description: "Deposit Naira and receive $SEND tokens on Base",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlipPay",
  },
  icons: {
    icon: [
      { url: "/whitefavicon.png", sizes: "any", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/favicon.png", sizes: "any", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [
      { url: "/whitefavicon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${montserrat.variable} ${inter.variable} dark`}>
      <head>
        {/* Run before Next.js dev overlay scripts: MetaMask inpage failures are not app bugs; stop them from opening the Runtime overlay. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
if(typeof window==='undefined')return;
function mmNoise(m,st){var s=(m?String(m):'')+(st?String(st):'');s=s.toLowerCase();return s.indexOf('failed to connect to metamask')!==-1||(s.indexOf('metamask')!==-1&&s.indexOf('connect')!==-1);}
function extUrl(u){return typeof u==='string'&&(u.indexOf('chrome-extension://')===0||u.indexOf('moz-extension://')===0||u.indexOf('safari-web-extension://')===0);}
window.addEventListener('error',function(e){var fn=String(e.filename||'');if(extUrl(fn)&&mmNoise(e.message,e.error&&e.error.stack)){e.stopImmediatePropagation();e.preventDefault();}},true);
window.addEventListener('unhandledrejection',function(e){var r=e.reason;var m=typeof r==='string'?r:(r&&r.message)||'';var st=r&&r.stack?String(r.stack):'';if(mmNoise(m,st)){e.preventDefault();e.stopImmediatePropagation();}},true);
})();`,
          }}
        />
        {/* Resource hints for faster external resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://assets.coingecko.com" />
        <link rel="dns-prefetch" href="https://api.coingecko.com" />
        
        {/* Load Material Icons - critical for icon rendering */}
        {/* Add fallback handling for Material Icons loading failures */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
          crossOrigin="anonymous"
        />
        {/* Fallback script to detect Material Icons loading failures */}
        <Script id="material-icons-fallback" strategy="afterInteractive">
          {`
            (function() {
              try {
                if (typeof document === 'undefined') return;
                
                // Check if Material Icons loaded after a delay
                setTimeout(function() {
                  try {
                    const testEl = document.createElement('span');
                    testEl.className = 'material-icons-outlined';
                    testEl.textContent = 'check';
                    testEl.style.position = 'absolute';
                    testEl.style.visibility = 'hidden';
                    document.body.appendChild(testEl);
                    
                    const computedStyle = window.getComputedStyle(testEl);
                    const fontFamily = computedStyle.fontFamily;
                    
                    // If font didn't load, add fallback CSS
                    if (!fontFamily.includes('Material Icons')) {
                      console.warn('Material Icons failed to load, using fallback');
                      const style = document.createElement('style');
                      style.textContent = \`
                        .material-icons-outlined,
                        .material-icons-round {
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                        }
                        .material-icons-outlined::before,
                        .material-icons-round::before {
                          content: attr(data-icon);
                          font-weight: bold;
                        }
                      \`;
                      document.head.appendChild(style);
                    }
                    
                    document.body.removeChild(testEl);
                  } catch (e) {
                    console.warn('Error checking Material Icons:', e);
                  }
                }, 2000);
              } catch (e) {
                console.warn('Error in Material Icons fallback check:', e);
              }
            })();
          `}
        </Script>
        
        <link rel="manifest" href="/manifest.json" />
        {/* Flutterwave Inline - payment modal; afterInteractive so it doesn't block HTML parsing */}
        <Script
          src="https://checkout.flutterwave.com/v3.js"
          strategy="afterInteractive"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <Script id="favicon-switcher" strategy="lazyOnload">
          {`
            (function() {
              try {
                // Guard against mobile browser issues
                if (typeof window === 'undefined' || typeof document === 'undefined') return;
                
                const updateFavicon = () => {
                  try {
                    const isDark = document.documentElement.classList.contains('dark');
                    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
                    link.type = 'image/png';
                    link.rel = 'shortcut icon';
                    link.href = isDark ? '/favicon.png' : '/whitefavicon.png';
                    const head = document.getElementsByTagName('head')[0];
                    if (head) {
                      head.appendChild(link);
                    }
                  } catch (e) {
                    console.warn('Error updating favicon:', e);
                  }
                };
                
                // Check on load - safely access localStorage
                try {
                  if (typeof localStorage !== 'undefined') {
                    const darkMode = localStorage.getItem("darkMode") === "true";
                    if (darkMode) {
                      document.documentElement.classList.add("dark");
                    }
                  }
                } catch (e) {
                  console.warn('Error accessing localStorage:', e);
                }
                
                updateFavicon();
                
                // Watch for changes
                if (typeof MutationObserver !== 'undefined') {
                  const observer = new MutationObserver(updateFavicon);
                  observer.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class']
                  });
                }
              } catch (e) {
                console.warn('Error in favicon switcher:', e);
              }
            })();
          `}
        </Script>
        <Script id="disable-right-click" strategy="lazyOnload">
          {`
            (function() {
              try {
                // Guard against mobile browser issues
                if (typeof window === 'undefined' || typeof document === 'undefined') return;
                
                // Check if we're on an admin page
                const isAdminPage = window.location.pathname.startsWith('/admin');
                
                // Only disable right-click if NOT on admin page
                if (!isAdminPage) {
                  // Disable right-click context menu
                  document.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    return false;
                  });
                }
              } catch (e) {
                console.warn('Error in right-click handler:', e);
              }
            })();
          `}
        </Script>
        <Script id="global-error-handler" strategy="afterInteractive">
          {`
            (function() {
              // Global error handler for unhandled errors
              if (typeof window !== 'undefined') {
                // Handle synchronous errors
                window.addEventListener('error', function(event) {
                  var fn = String(event.filename || '');
                  var combined = ((event.message || '') + ' ' + (event.error && event.error.message ? String(event.error.message) : '')).toLowerCase();
                  var isExtScript = fn.indexOf('chrome-extension://') !== -1 || fn.indexOf('moz-extension://') !== -1;
                  if (isExtScript && (combined.indexOf('metamask') !== -1 || combined.indexOf('failed to connect') !== -1)) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  var hasMessage = event.message && String(event.message).trim();
                  var hasError = event.error && (event.error.message || String(event.error).trim());
                  if (!hasMessage && !hasError) {
                    console.warn('Global error (no details):', event.filename || 'unknown', event.lineno, event.colno);
                    return;
                  }
                  var msg = event.message || '(no message)';
                  var err = event.error ? (event.error.message || String(event.error)) : '';
                  console.error('Global error caught:', msg, err || { filename: event.filename, lineno: event.lineno, colno: event.colno });
                  
                  // Handle WebSocket security errors gracefully
                  if (event.error && event.error.message) {
                    const errorMsg = event.error.message.toLowerCase();
                    
                    // WebSocket security errors - these are non-critical, app can work without realtime
                    if (errorMsg.includes('websocket') && 
                        (errorMsg.includes('insecure') || 
                         errorMsg.includes('not available') ||
                         errorMsg.includes('operation is insecure'))) {
                      console.warn('WebSocket not available, app will use polling fallback');
                      event.preventDefault(); // Prevent error from crashing the app
                      return;
                    }
                    
                    // Ignore other known non-critical errors
                    if (errorMsg.includes('script error') || 
                        errorMsg.includes('non-error promise rejection') ||
                        errorMsg.includes('resizeobserver')) {
                      event.preventDefault();
                      return;
                    }
                  }
                  
                  // Don't prevent default for critical errors - let ErrorBoundary handle them
                }, true); // Use capture phase
                
                // Handle unhandled promise rejections (log readable reason — Events/plain objects often stringify as {})
                function stringifyRejectionReason(reason) {
                  if (reason == null) return String(reason);
                  if (reason instanceof Error) {
                    return reason.name + ': ' + reason.message + (reason.stack ? ' | ' + reason.stack : '');
                  }
                  if (typeof reason === 'object') {
                    try {
                      var j = JSON.stringify(reason);
                      if (j && j !== '{}') return j;
                    } catch (e1) {}
                    if (reason && reason.message) return String(reason.message);
                    return '[object Object] (likely a DOM Event or non-enumerable rejection)';
                  }
                  return String(reason);
                }
                window.addEventListener('unhandledrejection', function(event) {
                  const reasonText = stringifyRejectionReason(event.reason);
                  const lowerReasonText = reasonText.toLowerCase();

                  // MetaMask extension failures (locked wallet, blocked site, etc.) often surface as
                  // unhandled rejections from inpage.js even when the UI catch() runs too — do not
                  // console.error here or Next.js dev overlay reports a false "Console Error".
                  if (
                    lowerReasonText.includes('failed to connect to metamask') ||
                    (lowerReasonText.includes('metamask') && lowerReasonText.includes('connect'))
                  ) {
                    event.preventDefault();
                    return;
                  }

                  if (event.reason && typeof event.reason === 'object') {
                    const reasonMsg = (event.reason.message || String(event.reason)).toLowerCase();

                    if (
                      reasonMsg.includes('websocket') &&
                      (reasonMsg.includes('insecure') ||
                        reasonMsg.includes('not available') ||
                        reasonMsg.includes('operation is insecure'))
                    ) {
                      console.warn('WebSocket promise rejection, app will use polling fallback');
                      event.preventDefault();
                      return;
                    }

                    if (
                      reasonMsg.includes('network') ||
                      reasonMsg.includes('fetch') ||
                      reasonMsg.includes('timeout')
                    ) {
                      event.preventDefault();
                      return;
                    }
                  }

                  console.error('Unhandled promise rejection:', reasonText);
                });
                
                // Handle React errors that escape ErrorBoundary
                const originalConsoleError = console.error;
                console.error = function(...args) {
                  // Log original error
                  originalConsoleError.apply(console, args);
                  
                  // Check if it's a React error
                  const errorStr = args.join(' ');
                  if (errorStr.includes('Error:') && errorStr.includes('React')) {
                    console.warn('React error detected, ErrorBoundary should handle it');
                  }
                };
              }
            })();
          `}
        </Script>
      </head>
      <body className="bg-background-dark text-accent font-sans min-h-screen flex flex-col transition-colors duration-300 selection:bg-secondary selection:text-primary" style={{ fontFamily: 'var(--font-montserrat), var(--font-inter), sans-serif' }}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}

