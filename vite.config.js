import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    cssCodeSplit: false,
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
        admin: resolve(import.meta.dirname, 'admin/login.html')
      }
    }
  }
});
