/**
 * Debug Routes
 * Diagnostic endpoints for troubleshooting API routing issues
 */

import { Router } from 'express';

const router = Router();

/**
 * Simple test endpoint that bypasses all middleware
 * GET /api/debug/ping
 */
router.get('/ping', (req, res) => {
  console.log('[DEBUG] Ping endpoint hit');
  res.json({
    status: 'ok',
    message: 'Debug API is working',
    timestamp: new Date().toISOString(),
    path: req.path,
    originalUrl: req.originalUrl,
  });
});

/**
 * List all registered routes
 * GET /api/debug/routes
 */
router.get('/routes', (req, res) => {
  console.log('[DEBUG] Routes listing requested');
  
  const routes: any[] = [];
  
  // Get Express app from request
  const app = req.app;
  
  // Extract routes from Express
  if (app._router && app._router.stack) {
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // Routes registered directly on the app
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods),
        });
      } else if (middleware.name === 'router') {
        // Router middleware
        middleware.handle.stack.forEach((handler: any) => {
          if (handler.route) {
            routes.push({
              path: handler.route.path,
              methods: Object.keys(handler.route.methods),
            });
          }
        });
      }
    });
  }
  
  res.json({
    status: 'ok',
    totalRoutes: routes.length,
    routes,
  });
});

/**
 * Echo request details
 * GET /api/debug/echo
 */
router.all('/echo', (req, res) => {
  console.log('[DEBUG] Echo endpoint hit');
  res.json({
    status: 'ok',
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    headers: req.headers,
    query: req.query,
    body: req.body,
    params: req.params,
  });
});

export default router;
