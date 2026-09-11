import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { handlePaymentRequest } from './server/payment-backend.js';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist'
  },
  plugins: [
    {
      name: 'api-payment-routes',
      configureServer(server) {
        server.middlewares.use('/api', (req, res, next) => {
          handlePaymentRequest(req, res).catch(next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api', (req, res, next) => {
          handlePaymentRequest(req, res).catch(next);
        });
      }
    },
    {
      name: 'copy-game-scripts-and-assets',
      closeBundle() {
        const filesToCopy = [
          'app.js',
          'snake.js',
          'tetris.js',
          'arkanoid.js',
          'slider.js',
          'sudoku.js',
          'ahorcado.js',
          'tresenraya.js',
          'rush.js',
          'builder.js',
          'escape.js',
          'duel.js',
          'calculator.js',
          'firebase.js',
          'cloud-save.js',
          'auth.js',
          'vip-payment.js',
          'style.css',
          'avatar_cube.png',
          'avatar_cylinder.png',
          'avatar_pyramid.png',
          'avatar_sphere.png'
        ];
        if (!fs.existsSync('dist')) {
          fs.mkdirSync('dist', { recursive: true });
        }
        for (const file of filesToCopy) {
          if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join('dist', file));
          }
        }
      }
    }
  ]
});
