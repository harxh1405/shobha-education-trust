import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [
    {
      name: 'rewrite-routes',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Never rewrite internal Vite requests, virtual modules, or html proxies
          if (
            !req.url ||
            req.url.includes('?html-proxy') ||
            req.url.includes('?import') ||
            req.url.startsWith('/@') ||
            req.url.startsWith('/api') ||
            req.url.startsWith('/uploads')
          ) {
            return next();
          }

          const [pathname, search] = req.url.split('?');
          const query = search ? `?${search}` : '';

          if (pathname === '/admin/login' || pathname === '/admin/login/') {
            req.url = `/admin/login.html${query}`;
          } else if (pathname === '/admin' || pathname === '/admin/') {
            req.url = `/admin/index.html${query}`;
          } else if (pathname === '/fee-payment' || pathname === '/fee-payment/') {
            req.url = `/fee-payment.html${query}`;
          } else if (pathname === '/fee-payment-status' || pathname === '/fee-payment-status/' || (pathname.startsWith('/fee-payment-status') && !pathname.endsWith('.html'))) {
            req.url = `/fee-payment-status.html${query}`;
          } else if (pathname === '/student-corner' || pathname === '/student-corner/') {
            req.url = `/student-corner.html${query}`;
          }
          next();
        });
      }
    }
  ],
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        about: resolve(import.meta.dirname, 'about.html'),
        institutions: resolve(import.meta.dirname, 'institutions.html'),
        programmes: resolve(import.meta.dirname, 'programmes.html'),
        admissions: resolve(import.meta.dirname, 'admissions.html'),
        campus: resolve(import.meta.dirname, 'campus.html'),
        community: resolve(import.meta.dirname, 'community.html'),
        news: resolve(import.meta.dirname, 'news.html'),
        studentCorner: resolve(import.meta.dirname, 'student-corner.html'),
        contact: resolve(import.meta.dirname, 'contact.html'),
        adminLogin: resolve(import.meta.dirname, 'admin/login.html'),
        adminPortal: resolve(import.meta.dirname, 'admin/index.html'),
        feePayment: resolve(import.meta.dirname, 'fee-payment.html'),
        feePaymentStatus: resolve(import.meta.dirname, 'fee-payment-status.html')
      }
    }
  }
});
