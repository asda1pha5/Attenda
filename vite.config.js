import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function socialPreviewMeta() {
  return {
    name: 'attenda-social-preview-meta',
    transformIndexHtml(html) {
      // Netlify exposes URL during builds. A relative fallback still works in
      // local development and on hosts that do not provide that variable.
      const siteUrl = (process.env.URL || '').replace(/\/$/, '');
      const previewUrl = `${siteUrl}/attenda-envelope-preview.jpg`;
      return html.replaceAll('%SOCIAL_PREVIEW_IMAGE%', previewUrl);
    },
  };
}

export default defineConfig({
  plugins: [react(), socialPreviewMeta()],
});
