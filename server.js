/**
 * MathQuest Production Server
 * Serves static frontend files on Port 3000
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const DIST_DIR = path.resolve('dist');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
    // Servir archivos estáticos del build de Vite en producción
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let safePath = path.normalize(decodeURIComponent(parsedUrl.pathname));
    if (safePath === '/') safePath = '/index.html';

    let filePath = path.join(DIST_DIR, safePath);

    // Si el archivo no existe en dist, intentar en la raíz o fallback a index.html (SPA)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
        if (!fs.existsSync(filePath)) {
            filePath = path.resolve('index.html');
        }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Recurso no encontrado');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`MathQuest Server escuchando en http://0.0.0.0:${PORT}`);
});
