// ArchiFlow Network Diagram Editor - Main Application
class ArchiFlowEditor {
    constructor() {
        // Configuration - Use proxied Draw.io to avoid cross-origin issues
        this.EMBED_URL = '/drawio/';  // Proxied through simple-server.js
        this.WS_URL = 'ws://localhost:3333';

        // State
        this.editor = null;
        this.ws = null;
        this.currentDiagramId = null;
        this.currentDiagramData = null;
        this.currentSiteId = null;
        this.isConnected = false;
        this.isDirty = false;
        this.autoSaveTimer = null;
        this.diagrams = [];
        this.sites = [];
        this.drawioReady = false;
        this.pendingLoad = null;
        this.networkDeviceManager = null;

        // Initialize
        this.init();
    }

    init() {
        console.log('[ArchiFlow] Initializing editor...');

        // Initialize Draw.io
        this.initDrawio();

        // Initialize WebSocket
        this.connectWebSocket();

        // Setup event listeners
        this.setupEventListeners();
    }

    initDrawio() {
        const iframe = document.getElementById('drawioEditor');

        // The iframe now loads plugin-loader.html which handles Draw.io initialization
        // and plugin injection with robust retry logic
        console.log('[ArchiFlow] Initializing Draw.io with plugin loader...');

        // Wait for the loader to be ready
        iframe.onload = () => {
            this.editor = iframe.contentWindow;
            console.log('[ArchiFlow] Plugin loader iframe ready');

            // The loader will forward all Draw.io messages to us
            // and handle plugin injection automatically
        };

        // Since iframe already has src="plugin-loader.html" in HTML,
        // we just need to store the reference
        this.editor = iframe.contentWindow;
    }

    connectWebSocket() {
        console.log('[WebSocket] Connecting to:', this.WS_URL);
        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
            console.log('[WebSocket] Connected');
            this.isConnected = true;
            this.updateConnectionStatus(true);

            // Initialize network device manager (pass editor iframe reference)
            if (typeof NetworkDeviceManager !== 'undefined') {
                this.networkDeviceManager = new NetworkDeviceManager(this.ws, this.editor);
                console.log('[ArchiFlow] Network Device Manager initialized');

                // Send templates to Draw.io plugin when received
                this.sendTemplatesToPlugin();
            }

            // Load sites first
            this.loadSites();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            } catch (error) {
                console.error('[WebSocket] Error parsing message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            this.updateConnectionStatus(false);
        };

        this.ws.onclose = () => {
            console.log('[WebSocket] Connection closed');
            this.isConnected = false;
            this.updateConnectionStatus(false);

            // Attempt reconnection
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }

    setupEventListeners() {
        // New Diagram Button (both header and welcome)
        document.getElementById('createDiagramBtn')?.addEventListener('click', () => this.showCreateModal());
        document.getElementById('createFirstDiagram')?.addEventListener('click', () => this.showCreateModal());

        // Site selector
        document.getElementById('siteSelector')?.addEventListener('change', (e) => {
            this.currentSiteId = e.target.value;
            if (this.currentSiteId) {
                this.loadDiagramsForSite(this.currentSiteId);
            }
        });

        // Save button in toolbar
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveDiagram());

        // Deploy button
        document.getElementById('deployBtn')?.addEventListener('click', () => this.showDeployModal());

        // More options dropdown
        document.getElementById('moreOptionsBtn')?.addEventListener('click', (e) => this.showDropdownMenu(e));

        // Create modal buttons
        document.getElementById('confirmCreateBtn')?.addEventListener('click', () => this.confirmCreate());

        // Deploy modal buttons
        document.getElementById('confirmDeployBtn')?.addEventListener('click', () => this.confirmDeploy());

        // Search input
        document.getElementById('searchDiagrams')?.addEventListener('input', (e) => this.filterDiagrams(e.target.value));

        // Filter dropdown
        document.getElementById('filterStatus')?.addEventListener('change', (e) => this.filterByStatus(e.target.value));

        // Dropdown menu items
        document.getElementById('renameDiagramBtn')?.addEventListener('click', () => this.renameDiagram());
        document.getElementById('duplicateDiagramBtn')?.addEventListener('click', () => this.duplicateDiagram());
        document.getElementById('exportDiagramBtn')?.addEventListener('click', () => this.exportDiagram());
        document.getElementById('deleteDiagramBtn')?.addEventListener('click', () => this.deleteDiagram());

        // Close modal handlers
        document.querySelectorAll('.close-btn, .btn-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Draw.io message handler
        window.addEventListener('message', (evt) => this.handleDrawioMessage(evt));

        // Click outside dropdown to close
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('dropdownMenu');
            const moreBtn = document.getElementById('moreOptionsBtn');
            if (dropdown && !dropdown.contains(e.target) && e.target !== moreBtn) {
                dropdown.style.display = 'none';
            }
        });
    }

    handleDrawioMessage(evt) {
        // Messages can come from either the loader iframe or Draw.io (forwarded through loader)
        if (evt.source !== this.editor) return;

        try {
            // Skip non-string messages that aren't objects
            if (typeof evt.data !== 'string' && typeof evt.data !== 'object') {
                return;
            }

            // Handle both string and object messages
            let msg;
            if (typeof evt.data === 'string') {
                // Skip the special 'ready' message
                if (evt.data === 'ready') {
                    return;
                }
                msg = JSON.parse(evt.data);
            } else {
                msg = evt.data;
            }

            // Ensure msg is an object
            if (!msg || typeof msg !== 'object') {
                return;
            }

            // Handle plugin loader status messages
            if (msg.source === 'archiflow-loader') {
                console.log('[Plugin Loader] Status:', msg.status);
                if (msg.status === 'plugin-loaded' || msg.status === 'plugin-loaded-eval') {
                    console.log('[ArchiFlow] Network plugin loaded successfully');
                    // Send device templates to plugin once it's loaded
                    this.sendTemplatesToPlugin();
                }
                return;
            }

            // Handle plugin requests for data
            if (msg.event === 'archiflow_request_data') {
                console.log('[ArchiFlow] Plugin requesting templates');
                this.sendTemplatesToPlugin();
                return;
            }

            // Handle device added from plugin
            if (msg.event === 'archiflow_device_added') {
                console.log('[ArchiFlow] Device added to diagram:', msg.device);
                if (this.networkDeviceManager) {
                    const cellId = 'device_' + Date.now();
                    this.networkDeviceManager.pendingDevices.set(cellId, msg.device);
                    this.networkDeviceManager.updateDeployButton();
                    this.networkDeviceManager.updateConfiguredDevicesList();
                }
                return;
            }

            switch(msg.event) {
                case 'init':
                    console.log('[Draw.io] Init event received - Draw.io is ready');
                    if (!this.drawioReady) {
                        this.drawioReady = true;
                        this.onDrawioReady();
                    }
                    break;

                case 'save':
                    console.log('[Draw.io] Save event received');
                    this.handleDrawioSave(msg);
                    break;

                case 'autosave':
                    console.log('[Draw.io] Autosave event');
                    // Extract mxGraphModel if we got mxfile format
                    let xmlToAutosave = msg.xml;
                    if (msg.xml && msg.xml.includes('<mxfile')) {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(msg.xml, 'text/xml');
                        const graphModel = xmlDoc.querySelector('mxGraphModel');
                        if (graphModel) {
                            xmlToAutosave = new XMLSerializer().serializeToString(graphModel);
                        }
                    }
                    this.currentDiagramData = xmlToAutosave;
                    this.isDirty = true;
                    break;

                case 'doubleClick':
                    console.log('[Draw.io] Double-click event on cell:', msg.cell);
                    // Check if this is a network device cell
                    if (this.networkDeviceManager && msg.cell && msg.cell.id && msg.cell.id.startsWith('device_')) {
                        this.networkDeviceManager.openDeviceConfigModal(msg.cell.id);
                    }
                    break;

                case 'export':
                    console.log('[Draw.io] Export event');
                    if (msg.format === 'xml' && msg.xml) {
                        // Extract mxGraphModel if we got mxfile format
                        let xmlToSave = msg.xml;
                        if (msg.xml && msg.xml.includes('<mxfile')) {
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(msg.xml, 'text/xml');
                            const graphModel = xmlDoc.querySelector('mxGraphModel');
                            if (graphModel) {
                                xmlToSave = new XMLSerializer().serializeToString(graphModel);
                            }
                        }
                        this.currentDiagramData = xmlToSave;
                        this.saveToDatabase();
                    }
                    break;
            }
        } catch (error) {
            // Only log actual errors, not expected non-JSON messages
            if (error.name === 'SyntaxError' && typeof evt.data === 'string') {
                // This is likely a non-JSON message, which is fine
                if (!['ready', 'init'].includes(evt.data)) {
                    console.debug('[Draw.io] Non-JSON message received:', evt.data);
                }
            } else {
                console.error('[Draw.io] Error handling message:', error);
            }
        }
    }

    handleDrawioSave(msg) {
        // Extract mxGraphModel if we got mxfile format
        let xmlToSave = msg.xml;
        if (msg.xml && msg.xml.includes('<mxfile')) {
            console.log('[Save] Extracting mxGraphModel from mxfile wrapper...');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(msg.xml, 'text/xml');
            const graphModel = xmlDoc.querySelector('mxGraphModel');
            if (graphModel) {
                xmlToSave = new XMLSerializer().serializeToString(graphModel);
            }
        }

        this.currentDiagramData = xmlToSave;
        this.isDirty = false;
        this.saveToDatabase();
    }

    handleWebSocketMessage(message) {
        console.log('[WebSocket] Message received:', message.type || message.action);

        // Forward network device messages to the network device manager
        if (this.networkDeviceManager) {
            const networkDeviceMessageTypes = [
                'device_templates', 'ip_pools', 'vlans', 'network_devices',
                'device_created', 'device_updated', 'device_deleted',
                'device_mapped', 'ip_allocated', 'ip_released'
            ];

            if (networkDeviceMessageTypes.includes(message.type)) {
                this.networkDeviceManager.handleWebSocketMessage(message);
                return;
            }
        }

        switch(message.type || message.action) {
            case 'connection':
                console.log('[WebSocket] Server info:', message);
                break;

            case 'save_success':
            case 'diagram_saved':
                this.onSaveSuccess(message);
                break;

            case 'load_success':
            case 'diagram_loaded':
                this.onLoadSuccess(message);
                break;

            case 'list_success':
            case 'diagrams_listed':
                this.onDiagramsListed(message);
                break;

            case 'sites_listed':
                this.onSitesListed(message);
                break;

            case 'deploy_success':
                this.onDeploySuccess(message);
                break;

            case 'delete_success':
                this.onDeleteSuccess(message);
                break;

            case 'error':
                this.showNotification(message.message, 'error');
                break;
        }
    }

    onDrawioReady() {
        // Draw.io is ready
        if (this.pendingLoad) {
            // Load pending diagram
            console.log('[Draw.io] Loading pending diagram...');
            this.editor.postMessage(JSON.stringify({
                action: 'load',
                autosave: 1,
                xml: this.pendingLoad
            }), '*');
            this.pendingLoad = null;
        } else {
            // Load empty diagram
            this.loadEmptyDiagram();
        }

        // Load custom network devices library
        this.loadCustomLibrary();
    }

    // Site Management
    loadSites() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({
            action: 'list_sites'
        }));
    }

    onSitesListed(message) {
        this.sites = message.sites || [];
        console.log('[Sites] Received', this.sites.length, 'sites');

        // Update both site selectors
        const mainSelector = document.getElementById('siteSelector');
        const modalSelector = document.getElementById('newDiagramSite');

        if (mainSelector) {
            mainSelector.innerHTML = '<option value="">Select a site...</option>';
            this.sites.forEach(site => {
                const option = document.createElement('option');
                option.value = site.id;
                option.textContent = site.name;
                mainSelector.appendChild(option);
            });
        }

        if (modalSelector) {
            modalSelector.innerHTML = '<option value="">Select site...</option>';
            this.sites.forEach(site => {
                const option = document.createElement('option');
                option.value = site.id;
                option.textContent = site.name;
                modalSelector.appendChild(option);
            });
        }
    }

    // Diagram List Management
    loadDiagramsForSite(siteId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({
            action: 'list_diagrams',
            siteId: parseInt(siteId)
        }));
    }

    onDiagramsListed(message) {
        this.diagrams = message.diagrams || [];
        console.log('[Diagrams] Received', this.diagrams.length, 'diagrams');

        // Update counter
        const counter = document.getElementById('diagramCount');
        if (counter) {
            counter.textContent = `${this.diagrams.length} diagram${this.diagrams.length !== 1 ? 's' : ''}`;
        }

        // Render diagram list
        this.renderDiagramList();
    }

    renderDiagramList() {
        const listContainer = document.getElementById('diagramList');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (this.diagrams.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No diagrams found</div>';
            return;
        }

        this.diagrams.forEach(diagram => {
            const item = document.createElement('div');
            item.className = 'diagram-item';
            item.dataset.diagramId = diagram.id;

            const isDeployed = diagram.deployment_status === 'deployed';

            item.innerHTML = `
                <div class="diagram-header">
                    <h4 class="diagram-title">${diagram.title || 'Untitled'}</h4>
                    <span class="status-badge ${isDeployed ? 'deployed' : 'draft'}">
                        ${isDeployed ? 'Deployed' : 'Draft'}
                    </span>
                </div>
                <div class="diagram-meta">
                    <span class="diagram-date">Modified ${this.formatDate(diagram.modified_at)}</span>
                </div>
            `;

            item.addEventListener('click', () => this.loadDiagram(diagram.id));
            listContainer.appendChild(item);
        });
    }

    // Diagram Operations
    loadDiagram(diagramId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        this.currentDiagramId = diagramId;
        this.showLoading('Loading diagram...');

        this.ws.send(JSON.stringify({
            action: 'load_diagram',
            diagramId: diagramId
        }));
    }

    onLoadSuccess(message) {
        console.log('[Load] Success:', message);
        this.hideLoading();

        // Update current diagram info
        this.currentDiagramId = message.diagramId;

        // Check for deployment status
        const diagram = this.diagrams.find(d => d.id === message.diagramId);
        const isDeployed = diagram?.deployment_status === 'deployed';

        // Update UI
        document.getElementById('welcomeMessage').style.display = 'none';
        document.getElementById('editorToolbar').style.display = 'flex';
        document.getElementById('drawioEditor').style.display = 'block';

        // Update title and status
        const titleEl = document.getElementById('currentDiagramTitle');
        if (titleEl) {
            titleEl.textContent = message.title || 'Untitled Diagram';
        }

        const statusEl = document.getElementById('currentDiagramStatus');
        if (statusEl) {
            statusEl.className = `status-badge ${isDeployed ? 'deployed' : 'draft'}`;
            statusEl.textContent = isDeployed ? 'Deployed' : 'Draft';
        }

        // Load content into Draw.io
        if (this.drawioReady) {
            this.editor.postMessage(JSON.stringify({
                action: 'load',
                autosave: 1,
                xml: message.content
            }), '*');
        } else {
            this.pendingLoad = message.content;
        }

        // Mark active diagram in list
        document.querySelectorAll('.diagram-item').forEach(item => {
            item.classList.toggle('active', item.dataset.diagramId === message.diagramId);
        });

        this.showNotification('Diagram loaded successfully');
    }

    saveDiagram() {
        if (!this.currentDiagramId) {
            this.showNotification('No diagram loaded', 'error');
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        // Request current content from Draw.io
        this.editor.postMessage(JSON.stringify({
            action: 'export',
            format: 'xml'
        }), '*');
    }

    saveToDatabase() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        if (!this.currentDiagramData) {
            this.showNotification('No diagram data to save', 'error');
            return;
        }

        const title = document.getElementById('currentDiagramTitle')?.textContent || 'Untitled Diagram';

        this.ws.send(JSON.stringify({
            action: 'save_diagram',
            diagramId: this.currentDiagramId,
            title: title,
            content: this.currentDiagramData,
            siteId: this.currentSiteId
        }));
    }

    onSaveSuccess(message) {
        console.log('[Save] Success:', message);
        this.isDirty = false;
        this.showNotification('Diagram saved successfully');

        // Reload diagram list to show updated timestamp
        if (this.currentSiteId) {
            this.loadDiagramsForSite(this.currentSiteId);
        }
    }

    // Create New Diagram
    showCreateModal() {
        const modal = document.getElementById('createDiagramModal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('newDiagramName')?.focus();
        }
    }

    confirmCreate() {
        const name = document.getElementById('newDiagramName')?.value.trim() || 'Untitled Diagram';
        const description = document.getElementById('newDiagramDescription')?.value.trim() || '';
        const siteId = document.getElementById('newDiagramSite')?.value;

        if (!siteId) {
            this.showNotification('Please select a site', 'error');
            return;
        }

        // Generate new UUID
        const diagramId = this.generateUUID();

        // Create empty diagram
        const emptyDiagram = '<mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

        // Save to server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'save_diagram',
                diagramId: diagramId,
                title: name,
                description: description,
                siteId: parseInt(siteId),
                content: emptyDiagram
            }));

            // Close modal
            document.getElementById('createDiagramModal').style.display = 'none';

            // Clear form
            document.getElementById('newDiagramName').value = '';
            document.getElementById('newDiagramDescription').value = '';

            // Update site selector and load the new diagram
            document.getElementById('siteSelector').value = siteId;
            this.currentSiteId = siteId;

            // Load diagrams for this site
            this.loadDiagramsForSite(siteId);

            // Load the new diagram
            setTimeout(() => this.loadDiagram(diagramId), 500);
        }
    }

    // Deploy Diagram
    showDeployModal() {
        if (!this.currentDiagramId) {
            this.showNotification('No diagram loaded', 'error');
            return;
        }

        // Find current diagram info
        const diagram = this.diagrams.find(d => d.id === this.currentDiagramId);
        const site = this.sites.find(s => s.id == this.currentSiteId);

        if (diagram && site) {
            document.getElementById('deployDiagramName').textContent = diagram.title;
            document.getElementById('deploySiteName').textContent = site.name;
            document.getElementById('deployModal').style.display = 'flex';
        }
    }

    confirmDeploy() {
        if (!this.currentDiagramId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.ws.send(JSON.stringify({
            action: 'deploy_diagram',
            diagramId: this.currentDiagramId,
            siteId: this.currentSiteId
        }));

        document.getElementById('deployModal').style.display = 'none';
    }

    onDeploySuccess(message) {
        this.showNotification('Diagram deployed successfully');

        // Update status badge
        const statusEl = document.getElementById('currentDiagramStatus');
        if (statusEl) {
            statusEl.className = 'status-badge deployed';
            statusEl.textContent = 'Deployed';
        }

        // Reload diagram list to show updated status
        if (this.currentSiteId) {
            this.loadDiagramsForSite(this.currentSiteId);
        }
    }

    // Delete Diagram
    deleteDiagram() {
        if (!this.currentDiagramId) return;

        if (confirm('Are you sure you want to delete this diagram?')) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    action: 'delete_diagram',
                    diagramId: this.currentDiagramId
                }));
            }
        }

        // Hide dropdown
        document.getElementById('dropdownMenu').style.display = 'none';
    }

    onDeleteSuccess(message) {
        this.showNotification('Diagram deleted successfully');

        // Clear current diagram
        this.currentDiagramId = null;

        // Show welcome screen
        document.getElementById('welcomeMessage').style.display = 'flex';
        document.getElementById('editorToolbar').style.display = 'none';
        document.getElementById('drawioEditor').style.display = 'none';

        // Reload diagram list
        if (this.currentSiteId) {
            this.loadDiagramsForSite(this.currentSiteId);
        }
    }

    // UI Helpers
    showDropdownMenu(event) {
        const dropdown = document.getElementById('dropdownMenu');
        const button = event.currentTarget;

        if (dropdown) {
            const rect = button.getBoundingClientRect();
            dropdown.style.display = 'block';
            dropdown.style.top = `${rect.bottom + 5}px`;
            dropdown.style.right = `${window.innerWidth - rect.right}px`;
        }
    }

    filterDiagrams(searchTerm) {
        const items = document.querySelectorAll('.diagram-item');
        const term = searchTerm.toLowerCase();

        items.forEach(item => {
            const title = item.querySelector('.diagram-title')?.textContent.toLowerCase() || '';
            item.style.display = title.includes(term) ? 'block' : 'none';
        });
    }

    filterByStatus(status) {
        const items = document.querySelectorAll('.diagram-item');

        items.forEach(item => {
            const badge = item.querySelector('.status-badge');
            if (status === 'all') {
                item.style.display = 'block';
            } else if (status === 'deployed') {
                item.style.display = badge?.classList.contains('deployed') ? 'block' : 'none';
            } else if (status === 'draft') {
                item.style.display = badge?.classList.contains('draft') ? 'block' : 'none';
            }
        });
    }

    loadEmptyDiagram() {
        const emptyDiagram = '<mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

        if (this.drawioReady && this.editor) {
            this.editor.postMessage(JSON.stringify({
                action: 'load',
                autosave: 1,
                xml: emptyDiagram
            }), '*');
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            const dot = statusEl.querySelector('.status-dot');
            const text = statusEl.querySelector('.status-text');

            if (connected) {
                dot.className = 'status-dot connected';
                text.textContent = 'Connected';
            } else {
                dot.className = 'status-dot disconnected';
                text.textContent = 'Disconnected';
            }
        }
    }

    showNotification(message, type = 'success') {
        // Simple notification - can be enhanced with a proper notification system
        console.log(`[Notification] ${type}:`, message);

        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.querySelector('.loading-text').textContent = text;
            overlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        // Less than a minute
        if (diff < 60000) return 'Just now';

        // Less than an hour
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
        }

        // Less than a day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        }

        // Less than a week
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        }

        // Default to date
        return date.toLocaleDateString();
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Stub functions for features not yet implemented
    renameDiagram() {
        const newName = prompt('Enter new name:', document.getElementById('currentDiagramTitle')?.textContent);
        if (newName && newName.trim()) {
            // TODO: Implement rename
            this.showNotification('Rename feature coming soon', 'info');
        }
        document.getElementById('dropdownMenu').style.display = 'none';
    }

    duplicateDiagram() {
        // TODO: Implement duplicate
        this.showNotification('Duplicate feature coming soon', 'info');
        document.getElementById('dropdownMenu').style.display = 'none';
    }

    exportDiagram() {
        if (this.drawioReady && this.editor) {
            this.editor.postMessage(JSON.stringify({
                action: 'export',
                format: 'png'
            }), '*');
        }
        document.getElementById('dropdownMenu').style.display = 'none';
    }

    async loadCustomLibrary() {
        try {
            console.log('[ArchiFlow] Loading custom network devices library...');

            // Fetch the custom library file
            const response = await fetch('/network-devices-library.xml');
            const libraryXml = await response.text();

            console.log('[ArchiFlow] Custom library loaded, sending to Draw.io');

            // Send custom library to Draw.io using custom library protocol
            this.editor.postMessage(JSON.stringify({
                action: 'custom',
                data: libraryXml
            }), '*');

            console.log('[ArchiFlow] Custom library sent to Draw.io');
        } catch (error) {
            console.error('[ArchiFlow] Error loading custom library:', error);
        }
    }

    sendTemplatesToPlugin() {
        if (!this.editor || !this.networkDeviceManager) return;

        console.log('[ArchiFlow] Sending templates to Draw.io plugin...');

        // Send device templates
        this.editor.postMessage(JSON.stringify({
            event: 'archiflow_templates',
            templates: this.networkDeviceManager.deviceTemplates
        }), '*');

        // Send IP pools
        this.editor.postMessage(JSON.stringify({
            event: 'archiflow_ip_pools',
            pools: this.networkDeviceManager.ipPools
        }), '*');
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ArchiFlowEditor();
});