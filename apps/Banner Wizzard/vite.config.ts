import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'asset-persistence',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.method === 'POST' && req.url === '/api/save-asset') {
              console.log("Received save-asset request");
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { name, url, category } = JSON.parse(body);
                  console.log(`Saving asset: ${name} (${category})`);
                  const base64Data = url.replace(/^data:image\/\w+;base64,/, "");
                  const buffer = Buffer.from(base64Data, 'base64');

                  const fileName = `${Date.now()}-${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
                  const libraryDir = path.resolve(__dirname, 'public/library');
                  if (!fs.existsSync(libraryDir)) {
                    fs.mkdirSync(libraryDir, { recursive: true });
                  }

                  const filePath = path.join(libraryDir, fileName);
                  fs.writeFileSync(filePath, buffer);

                  const relativeUrl = `/library/${fileName}`;
                  const libraryJsonPath = path.resolve(__dirname, 'public/library.json');
                  let library = [];
                  if (fs.existsSync(libraryJsonPath)) {
                    library = JSON.parse(fs.readFileSync(libraryJsonPath, 'utf8'));
                  }

                  const newAsset = {
                    id: `shared-${Date.now()}`,
                    name,
                    url: relativeUrl,
                    category
                  };

                  library.push(newAsset);
                  fs.writeFileSync(libraryJsonPath, JSON.stringify(library, null, 2));

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(newAsset));
                } catch (err) {
                  console.error("Save asset error:", err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: "Failed to save asset" }));
                }
              });
              return;
            }
            next();
          });
        }
      }
    ],
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
