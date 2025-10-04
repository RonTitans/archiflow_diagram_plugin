# Draw.io Proxy Fix Summary

## Problem
The plugin loader was failing with "Bad Gateway - Draw.io not available" because:
1. Draw.io runs in a separate Docker container on port 8083
2. Frontend runs in another Docker container on port 8081
3. The proxy was trying to connect to `localhost:8083` from inside the frontend container
4. Inside a Docker container, `localhost` refers to the container itself, not the host

## Solution
Fixed the proxy in `simple-server.js` to:
1. Detect when running in Docker (checks for `/.dockerenv` file)
2. Use Docker service name `drawio:8080` when in Docker
3. Use `localhost:8083` when running locally

## Changes Made

### 1. Updated `frontend/simple-server.js`
```javascript
// Before:
const DRAWIO_PROXY_TARGET = 'http://localhost:8083';

// After:
const isDocker = process.env.RUNNING_IN_DOCKER || fs.existsSync('/.dockerenv');
const DRAWIO_PROXY_TARGET = isDocker ? 'http://drawio:8080' : 'http://localhost:8083';
```

### 2. Updated `frontend/plugin-loader.html`
```javascript
// Changed from direct connection:
const DRAWIO_URL = 'http://localhost:8083';

// To proxied connection (same-origin):
const DRAWIO_URL = '/drawio';
```

### 3. Updated `frontend/app.js`
```javascript
// Changed from:
this.EMBED_URL = 'http://localhost:8083/';

// To:
this.EMBED_URL = '/drawio/';
```

## Benefits
1. **No Cross-Origin Issues**: Everything is now on the same origin (localhost:8081)
2. **Plugin Injection Works**: The loader can directly access Draw.io's iframe DOM
3. **Docker Compatible**: Automatically uses correct hostnames in Docker environment
4. **Local Development**: Still works when running locally without Docker

## How It Works
- Frontend at `http://localhost:8081/`
- Draw.io accessed via `http://localhost:8081/drawio/` (proxied)
- Plugin at `http://localhost:8081/archiflow-network-plugin.js`
- All same-origin = no security restrictions!

## Testing
After restarting the frontend container:
1. The proxy correctly connects to `http://drawio:8080` in Docker
2. Draw.io is accessible via `/drawio/` path
3. Plugin loader can inject scripts directly into Draw.io's iframe
4. No more cross-origin errors!