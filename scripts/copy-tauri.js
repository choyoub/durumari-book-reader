import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist-tauri');
const tauriReleaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
const bundleDir = path.join(tauriReleaseDir, 'bundle');

// Create dist-tauri if not exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const filesToCopy = [
  {
    src: path.join(tauriReleaseDir, 'durumari-webview.exe'),
    dest: path.join(distDir, 'durumari-webview.exe')
  },
  {
    src: path.join(bundleDir, 'msi', '두루마리_0.1.0_x64_ko-KR.msi'),
    dest: path.join(distDir, '두루마리_0.1.0_x64_ko-KR.msi')
  },
  {
    src: path.join(bundleDir, 'nsis', '두루마리_0.1.0_x64-setup.exe'),
    dest: path.join(distDir, '두루마리_0.1.0_x64-setup.exe')
  }
];

filesToCopy.forEach(file => {
  if (fs.existsSync(file.src)) {
    fs.copyFileSync(file.src, file.dest);
    console.log(`Copied: ${path.basename(file.src)} -> dist-tauri/`);
  } else {
    console.warn(`File not found: ${file.src}`);
  }
});

console.log('All build artifacts have been copied to ./dist-tauri/');
