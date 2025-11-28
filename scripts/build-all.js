const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const appsDir = path.join(rootDir, 'apps');
const menuDir = path.join(rootDir, 'menu');
const distDir = path.join(rootDir, 'dist');

// Ensure dist directory exists
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

const apps = [];

// 1. Build Apps
if (fs.existsSync(appsDir)) {
    const appFolders = fs.readdirSync(appsDir).filter(file => {
        return fs.statSync(path.join(appsDir, file)).isDirectory();
    });

    appFolders.forEach(app => {
        console.log(`Building app: ${app}...`);
        const appPath = path.join(appsDir, app);

        try {
            // Install dependencies if needed (skipping for speed if already installed, but good to ensure)
            if (!fs.existsSync(path.join(appPath, 'node_modules'))) {
                console.log(`Installing dependencies for ${app}...`);
                execSync('npm install', { cwd: appPath, stdio: 'inherit' });
            }

            // Build
            execSync('npm run build', { cwd: appPath, stdio: 'inherit' });

            // Copy to dist
            const appDist = path.join(appPath, 'dist');
            const targetDir = path.join(distDir, app);

            if (fs.existsSync(appDist)) {
                fs.cpSync(appDist, targetDir, { recursive: true });
                apps.push({
                    name: app,
                    path: `/${app}/`
                });
            } else {
                console.error(`Build failed for ${app}: dist folder not found.`);
            }
        } catch (error) {
            console.error(`Error building ${app}:`, error);
        }
    });
}

// 2. Generate apps.json
const appsJsonPath = path.join(distDir, 'apps.json');
fs.writeFileSync(appsJsonPath, JSON.stringify(apps, null, 2));
console.log(`Generated apps.json with ${apps.length} apps.`);

// 3. Build Menu
console.log('Building Menu...');
try {
    if (!fs.existsSync(path.join(menuDir, 'node_modules'))) {
        console.log(`Installing dependencies for menu...`);
        execSync('npm install', { cwd: menuDir, stdio: 'inherit' });
    }

    // Copy apps.json to public folder of menu so it can be fetched during dev/build if needed, 
    // or we just rely on it being in dist at runtime. 
    // For the menu app to know about apps during build, we might want to inject it or just fetch it at runtime.
    // Runtime fetch is better for dynamic updates if we were using a backend, but here it's static.
    // We'll put it in public so local dev works if we mock it, but for prod it will be at root.

    execSync('npm run build', { cwd: menuDir, stdio: 'inherit' });

    // Copy menu dist to root of main dist
    const menuDist = path.join(menuDir, 'dist');
    fs.cpSync(menuDist, distDir, { recursive: true, force: true }); // Merge into dist

} catch (error) {
    console.error('Error building menu:', error);
}

console.log('Build complete! Output in dist/');
