const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 8081;
const HOST = '0.0.0.0';
// When running in Docker, use the Docker service name 'drawio' and internal port 8080
// When running locally, use localhost:8083
const isDocker = process.env.RUNNING_IN_DOCKER || fs.existsSync('/.dockerenv');
const DRAWIO_PROXY_TARGET = isDocker ? 'http://drawio:8080' : 'http://localhost:8083';

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Proxy requests to Draw.io
function proxyToDrawio(request, response) {
    // Remove /drawio prefix and construct target URL
    const path = request.url.replace('/drawio', '');
    const targetUrl = new URL(path || '/', DRAWIO_PROXY_TARGET);

    console.log(`[Proxy] ${request.method} ${request.url}`);
    console.log(`[Proxy] Target: ${DRAWIO_PROXY_TARGET}`);
    console.log(`[Proxy] Full URL: ${targetUrl.href}`);

    const proxyReq = http.request(targetUrl, {
        method: request.method,
        headers: request.headers
    }, (proxyRes) => {
        response.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(response);
    });

    proxyReq.on('error', (err) => {
        console.error('[Proxy] Error:', err.message);
        response.writeHead(502);
        response.end('Bad Gateway - Draw.io not available');
    });

    request.pipe(proxyReq);
}

// Create server
const server = http.createServer((request, response) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);

    // Handle OPTIONS preflight requests for CORS
    if (request.method === 'OPTIONS') {
        response.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400', // 24 hours
            'Content-Length': '0'
        });
        response.end();
        return;
    }

    // Proxy /drawio/* requests to Draw.io container (makes it same-origin)
    if (request.url.startsWith('/drawio')) {
        proxyToDrawio(request, response);
        return;
    }

    // Parse URL
    let filePath = '.' + request.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = path.resolve(safePath);

    // Check if file is within current directory
    if (!absolutePath.startsWith(process.cwd())) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code === 'ENOENT') {
                // File not found
                response.writeHead(404);
                response.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>404 - Not Found</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                background: #ecf0f1;
                            }
                            .error-container {
                                text-align: center;
                                padding: 40px;
                                background: white;
                                border-radius: 8px;
                                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            }
                            h1 { color: #e74c3c; }
                            p { color: #7f8c8d; }
                            a {
                                color: #3498db;
                                text-decoration: none;
                                font-weight: bold;
                            }
                            a:hover { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        <div class="error-container">
                            <h1>404 - Not Found</h1>
                            <p>The requested file "${request.url}" was not found.</p>
                            <a href="/">Go to Home</a>
                        </div>
                    </body>
                    </html>
                `);
            } else {
                // Server error
                response.writeHead(500);
                response.end(`Server Error: ${error.code}`);
            }
        } else {
            // Success - add enhanced CORS headers for plugin loading
            response.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                'Access-Control-Allow-Credentials': 'true',
                'Cache-Control': 'no-cache'
            });
            response.end(content, 'utf-8');
        }
    });
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`[Error] Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('[Error] Server error:', error);
    }
});

// Start server
server.listen(PORT, HOST, () => {
    console.log(`[Server] ArchiFlow Frontend Server running at http://${HOST}:${PORT}/`);
    console.log(`[Server] Serving files from: ${process.cwd()}`);
    console.log(`[Server] Draw.io proxy target: ${DRAWIO_PROXY_TARGET}`);
    console.log(`[Server] Running in Docker: ${isDocker}`);
    console.log(`[Server] Press Ctrl+C to stop`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n[Server] SIGINT received, shutting down...');
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});