import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const apiMiddleware = {
    name: 'api-middleware',
    configureServer(server) {
      console.log("-----------------------------------------");
      console.log("  NANO STUDIO PRO API PLUGIN LOADED      ");
      console.log("-----------------------------------------");

      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        // Debug logging
        if (url.includes('/api/')) {
          console.log(`[PLUGIN REQ] ${req.method} ${url}`);
        }

        // Match /api/prompts/ with optional base path prefix
        if (url.match(/(\/nano-studio-pro)?\/api\/prompts\/?/)) {
          const PROMPTS_FILE = path.resolve(__dirname, 'shared_prompts.json');

          const readJson = () => {
            if (!fs.existsSync(PROMPTS_FILE)) return [];
            try { return JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8')); }
            catch (e) { return []; }
          };

          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(readJson()));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const prompts = readJson();
                const newPrompt = { ...JSON.parse(body), id: Date.now().toString(), timestamp: Date.now() };
                prompts.unshift(newPrompt);
                fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(newPrompt));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to save prompt' }));
              }
            });
            return;
          }
        }

        // Match /api/styles/ with optional base path prefix
        if (url.match(/(\/nano-studio-pro)?\/api\/styles\/?/)) {
          const STYLES_FILE = path.resolve(__dirname, 'shared_styles.json');
          const STYLES_DIR = path.resolve(__dirname, 'public/shared_styles');
          if (!fs.existsSync(STYLES_DIR)) fs.mkdirSync(STYLES_DIR, { recursive: true });

          const readJson = () => {
            if (!fs.existsSync(STYLES_FILE)) return [];
            try { return JSON.parse(fs.readFileSync(STYLES_FILE, 'utf-8')); }
            catch (e) { return []; }
          };

          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(readJson()));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const { name, prompt, imageData } = JSON.parse(body);
                const styles = readJson();
                const fileName = `${Date.now()}-${name.replace(/\s+/g, '_')}.jpg`;
                const filePath = path.join(STYLES_DIR, fileName);
                const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

                const newStyle = {
                  id: Date.now().toString(),
                  name,
                  prompt,
                  imageUrl: `/nano-studio-pro/shared_styles/${fileName}`,
                  timestamp: Date.now()
                };
                styles.unshift(newStyle);
                fs.writeFileSync(STYLES_FILE, JSON.stringify(styles, null, 2));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(newStyle));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to save style' }));
              }
            });
            return;
          }
        }

        next();
      });
    }
  };

  return {
    base: '/nano-studio-pro/',
    plugins: [react(), apiMiddleware],
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
