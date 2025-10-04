// ArchiFlow Network Device Manager - Frontend Module

class NetworkDeviceManager {
    constructor(ws, editor) {
        this.ws = ws;
        this.editor = editor; // Reference to Draw.io iframe
        this.deviceTemplates = [];
        this.ipPools = [];
        this.vlans = [];
        this.currentDeviceConfig = null;
        this.pendingDevices = new Map(); // Devices configured but not yet deployed
        this.deployedDevices = new Map(); // Devices saved to database
        this.deviceCells = new Map(); // Map of cell IDs to device data

        this.init();
    }

    init() {
        console.log('[NetworkDevices] Initializing network device manager...');
        this.setupEventListeners();
        this.loadDeviceTemplates();
        this.loadIPPools();
        this.loadVLANs();
    }

    setupEventListeners() {
        // Toggle device palette
        const toggleBtn = document.getElementById('toggleDevicePaletteBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleDevicePalette());
        }

        // Close device palette
        const closeBtn = document.getElementById('closePaletteBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideDevicePalette());
        }

        // View tabs (Templates / Configured)
        document.querySelectorAll('.palette-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.palette-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                const view = e.target.dataset.view;
                this.switchPaletteView(view);
            });
        });

        // Device search
        const searchInput = document.getElementById('deviceSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterDevicesBySearch(e.target.value);
            });
        }

        // Device config modal
        const deviceConfigModal = document.getElementById('deviceConfigModal');
        const saveDeviceConfigBtn = document.getElementById('saveDeviceConfigBtn');
        const addIpBtn = document.getElementById('addIpBtn');

        if (saveDeviceConfigBtn) {
            saveDeviceConfigBtn.addEventListener('click', () => this.saveDeviceConfiguration());
        }

        if (addIpBtn) {
            addIpBtn.addEventListener('click', () => this.showIPAllocationModal());
        }

        // IP allocation modal
        const ipPoolSelect = document.getElementById('ipPoolSelect');
        const confirmAllocateIpBtn = document.getElementById('confirmAllocateIpBtn');

        if (ipPoolSelect) {
            ipPoolSelect.addEventListener('change', (e) => this.showIPPoolInfo(e.target.value));
        }

        if (confirmAllocateIpBtn) {
            confirmAllocateIpBtn.addEventListener('click', () => this.allocateIPAddress());
        }

        // Modal close buttons
        document.querySelectorAll('.close-btn, .btn-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // Deploy button - override existing handler to include device deployment
        const deployBtn = document.getElementById('deployBtn');
        if (deployBtn) {
            // Remove existing listener and add new one
            const newDeployBtn = deployBtn.cloneNode(true);
            deployBtn.parentNode.replaceChild(newDeployBtn, deployBtn);
            newDeployBtn.addEventListener('click', () => this.handleDeploy());
        }

        // Add Device button - opens template selection
        const addDeviceBtn = document.getElementById('addDeviceBtn');
        if (addDeviceBtn) {
            addDeviceBtn.addEventListener('click', () => this.showTemplateSelectionDialog());
        }
    }

    showTemplateSelectionDialog() {
        console.log('[NetworkDevices] Showing template selection dialog');

        // Switch to templates view and show palette
        document.getElementById('devicePalette').style.display = 'flex';
        this.switchPaletteView('templates');

        // Focus on search
        const searchInput = document.getElementById('deviceSearch');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    toggleDevicePalette() {
        console.log('[NetworkDevices] Toggle button clicked!');
        const palette = document.getElementById('devicePalette');
        console.log('[NetworkDevices] Palette element:', palette);
        if (palette) {
            const isHidden = palette.style.display === 'none';
            console.log('[NetworkDevices] Current display:', palette.style.display, '-> Setting to:', isHidden ? 'flex' : 'none');
            palette.style.display = isHidden ? 'flex' : 'none';
        }
    }

    hideDevicePalette() {
        const palette = document.getElementById('devicePalette');
        if (palette) {
            palette.style.display = 'none';
        }
    }

    loadDeviceTemplates() {
        console.log('[NetworkDevices] Loading device templates...');
        this.ws.send(JSON.stringify({
            action: 'get_device_templates'
        }));
    }

    loadIPPools() {
        console.log('[NetworkDevices] Loading IP pools...');
        this.ws.send(JSON.stringify({
            action: 'get_ip_pools'
        }));
    }

    loadVLANs() {
        console.log('[NetworkDevices] Loading VLANs...');
        this.ws.send(JSON.stringify({
            action: 'get_vlans'
        }));
    }

    handleWebSocketMessage(message) {
        console.log('[NetworkDevices] Received WebSocket message:', message.type, message);
        switch(message.type) {
            case 'device_templates':
                console.log('[NetworkDevices] Received templates:', message.templates);
                this.deviceTemplates = message.templates;
                this.renderDeviceTemplates();
                break;
            case 'ip_pools':
                this.ipPools = message.pools;
                this.populateIPPoolDropdown();
                break;
            case 'vlans':
                this.vlans = message.vlans;
                break;
            case 'device_created':
                console.log('[NetworkDevices] Device created in database:', message.device);
                this.deployedDevices.set(message.device.id, message.device);
                break;
            case 'device_mapped':
                console.log('[NetworkDevices] Device mapped to diagram:', message.mapping);
                break;
        }
    }

    renderDeviceTemplates() {
        console.log('[NetworkDevices] Rendering templates, count:', this.deviceTemplates.length);
        const container = document.getElementById('deviceTemplateList');
        if (!container) {
            console.error('[NetworkDevices] Container deviceTemplateList not found!');
            return;
        }

        if (this.deviceTemplates.length === 0) {
            container.innerHTML = `
                <div class="device-list-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <line x1="9" y1="9" x2="15" y2="9"/>
                        <line x1="9" y1="12" x2="15" y2="12"/>
                        <line x1="9" y1="15" x2="13" y2="15"/>
                    </svg>
                    <p>No device templates available</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.deviceTemplates.map(template => `
            <div class="device-template-item" data-template='${JSON.stringify(template)}'>
                <div class="device-icon">${this.getDeviceIcon(template.device_type)}</div>
                <div class="device-info">
                    <div class="device-name">${template.name}</div>
                    <div class="device-type">
                        <span class="device-category-badge ${template.category}">${template.category}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers to device items - open config modal
        container.querySelectorAll('.device-template-item').forEach(item => {
            item.addEventListener('click', () => {
                const template = JSON.parse(item.dataset.template);
                this.openDeviceConfigModalFromTemplate(template);
            });
        });
    }

    getDeviceIcon(deviceType) {
        const icons = {
            'router': '🔀',
            'switch': '🔌',
            'firewall': '🛡️',
            'server': '🖥️',
            'load_balancer': '⚖️',
            'access_point': '📡',
            'workstation': '💻',
            'cloud': '☁️',
            'internet': '🌐',
            'database': '🗄️',
            'storage': '💾'
        };
        return icons[deviceType] || '📦';
    }

    filterDevicesByCategory(category) {
        const filtered = category === 'all'
            ? this.deviceTemplates
            : this.deviceTemplates.filter(t => t.category === category);

        this.deviceTemplates = filtered;
        this.renderDeviceTemplates();
    }

    filterDevicesBySearch(query) {
        const filtered = this.deviceTemplates.filter(t =>
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.device_type.toLowerCase().includes(query.toLowerCase())
        );

        const container = document.getElementById('deviceTemplateList');
        if (!container) return;

        container.innerHTML = filtered.map(template => `
            <div class="device-template-item" data-template='${JSON.stringify(template)}'>
                <div class="device-icon">${this.getDeviceIcon(template.device_type)}</div>
                <div class="device-info">
                    <div class="device-name">${template.name}</div>
                    <div class="device-type">
                        <span class="device-category-badge ${template.category}">${template.category}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Re-add click handlers
        container.querySelectorAll('.device-template-item').forEach(item => {
            item.addEventListener('click', () => {
                const template = JSON.parse(item.dataset.template);
                this.openDeviceConfigModal(template);
            });
        });
    }

    insertDeviceIntoDrawio(deviceData) {
        console.log('[NetworkDevices] Inserting device into Draw.io:', deviceData.name);

        if (!this.editor) {
            console.error('[NetworkDevices] Editor iframe not available!');
            alert('Draw.io editor is not ready. Please wait a moment and try again.');
            return;
        }

        // Get device style based on type
        const shapeStyle = this.getDeviceShapeStyle(deviceData.device_type);

        // Create label with device name and primary IP
        const primaryIp = deviceData.ip_allocations.find(ip => ip.is_primary);
        let label = deviceData.name;
        if (primaryIp) {
            label += '\\n' + primaryIp.ip_address;
        }

        // Generate unique cell ID
        const cellId = deviceData.cellId;

        // Use merge action to insert shape into existing diagram
        const xml = `<mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="${cellId}" value="${label}" style="${shapeStyle}" vertex="1" parent="1">
                    <mxGeometry x="200" y="200" width="120" height="80" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>`;

        console.log('[NetworkDevices] Sending merge XML to Draw.io');

        this.editor.postMessage(JSON.stringify({
            action: 'merge',
            xml: xml
        }), '*');

        console.log('[NetworkDevices] Device shape inserted into diagram');
    }

    getDeviceShapeStyle(deviceType) {
        // Define styles for different device types
        // Using simple built-in shapes for now
        const styles = {
            'router': 'rounded=1;whiteSpace=wrap;html=1;fillColor=#036897;strokeColor=#ffffff;strokeWidth=2;fontColor=#ffffff;',
            'switch': 'rounded=0;whiteSpace=wrap;html=1;fillColor=#036897;strokeColor=#ffffff;strokeWidth=2;fontColor=#ffffff;',
            'firewall': 'rhombus;whiteSpace=wrap;html=1;fillColor=#FF6B6B;strokeColor=#ffffff;strokeWidth=2;fontColor=#ffffff;',
            'server': 'rounded=0;whiteSpace=wrap;html=1;fillColor=#4ECDC4;strokeColor=#ffffff;strokeWidth=2;fontColor=#ffffff;',
            'load_balancer': 'ellipse;whiteSpace=wrap;html=1;fillColor=#FFE66D;strokeColor=#ffffff;strokeWidth=2;fontColor=#333333;',
            'access_point': 'triangle;whiteSpace=wrap;html=1;fillColor=#95E1D3;strokeColor=#ffffff;strokeWidth=2;fontColor=#333333;',
            'workstation': 'rounded=1;whiteSpace=wrap;html=1;fillColor=#A8E6CF;strokeColor=#ffffff;strokeWidth=2;fontColor=#333333;',
            'cloud': 'ellipse;whiteSpace=wrap;html=1;fillColor=#E3F2FD;strokeColor=#2196F3;strokeWidth=2;fontColor=#1565C0;',
            'internet': 'ellipse;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#FBC02D;strokeWidth=2;fontColor=#F57F17;',
            'database': 'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#B39DDB;strokeColor=#673AB7;strokeWidth=2;fontColor=#ffffff;size=15;',
            'storage': 'shape=cube;whiteSpace=wrap;html=1;fillColor=#FFCCBC;strokeColor=#FF5722;strokeWidth=2;fontColor=#ffffff;size=10;'
        };

        return styles[deviceType] || 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;';
    }

    openDeviceConfigModalFromTemplate(template) {
        console.log('[NetworkDevices] Opening config modal for template:', template.name);

        // Create new device config from template
        this.currentDeviceConfig = {
            cellId: 'device_' + Date.now(),
            template_id: template.id,
            device_type: template.device_type,
            name: template.name,
            manufacturer: template.manufacturer || '',
            model: template.model || '',
            status: 'active',
            ip_allocations: []
        };

        // Populate form fields
        document.getElementById('deviceName').value = this.currentDeviceConfig.name || '';
        document.getElementById('deviceTypeDisplay').value = template.name;
        document.getElementById('deviceStatus').value = 'active';
        document.getElementById('deviceManufacturer').value = template.manufacturer || '';
        document.getElementById('deviceModel').value = template.model || '';
        document.getElementById('deviceAssetId').value = '';
        document.getElementById('deviceSerialNumber').value = '';
        document.getElementById('deviceLocation').value = '';
        document.getElementById('deviceRackPosition').value = '';

        // Clear IP allocations
        this.currentDeviceConfig.ip_allocations = [];
        this.updateIPAllocationsList();

        // Show modal
        document.getElementById('deviceConfigModal').style.display = 'flex';
    }

    openDeviceConfigModal(cellId = null) {
        console.log('[NetworkDevices] Opening device config modal for cell:', cellId);

        // If cellId provided, load existing device data
        if (cellId && this.pendingDevices.has(cellId)) {
            this.currentDeviceConfig = { ...this.pendingDevices.get(cellId) };
        } else if (cellId && this.deployedDevices.has(cellId)) {
            this.currentDeviceConfig = { ...this.deployedDevices.get(cellId) };
        } else {
            // New device
            this.currentDeviceConfig = {
                cellId: cellId || 'temp_' + Date.now(),
                template_id: null,
                device_type: '',
                name: '',
                status: 'active',
                ip_allocations: []
            };
        }

        // Populate form fields
        document.getElementById('deviceName').value = this.currentDeviceConfig.name || '';
        document.getElementById('deviceTypeDisplay').value = this.currentDeviceConfig.device_type || '';
        document.getElementById('deviceStatus').value = this.currentDeviceConfig.status || 'active';
        document.getElementById('deviceManufacturer').value = this.currentDeviceConfig.manufacturer || '';
        document.getElementById('deviceModel').value = this.currentDeviceConfig.model || '';
        document.getElementById('deviceAssetId').value = this.currentDeviceConfig.asset_id || '';
        document.getElementById('deviceSerialNumber').value = this.currentDeviceConfig.serial_number || '';
        document.getElementById('deviceLocation').value = this.currentDeviceConfig.location || '';
        document.getElementById('deviceRackPosition').value = this.currentDeviceConfig.rack_position || '';

        // Update IP allocations list
        this.updateIPAllocationsList();

        // Show modal
        document.getElementById('deviceConfigModal').style.display = 'flex';
    }

    showIPAllocationModal() {
        document.getElementById('ipAllocationModal').style.display = 'flex';
    }

    populateIPPoolDropdown() {
        const select = document.getElementById('ipPoolSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Select IP Pool...</option>' +
            this.ipPools.map(pool => `
                <option value="${pool.id}" data-pool='${JSON.stringify(pool)}'>
                    ${pool.name} (${pool.network}) - VLAN ${pool.vlan_id || 'N/A'}
                </option>
            `).join('');
    }

    async showIPPoolInfo(poolId) {
        if (!poolId) {
            document.getElementById('ipPoolInfo').style.display = 'none';
            return;
        }

        const pool = this.ipPools.find(p => p.id === poolId);
        if (!pool) return;

        // Get next available IP from backend
        const response = await this.sendWSMessage({
            action: 'get_next_available_ip',
            poolId: poolId
        });

        document.getElementById('poolNetwork').textContent = pool.network;
        document.getElementById('poolGateway').textContent = pool.gateway || 'N/A';
        document.getElementById('poolVlan').textContent = pool.vlan_id || 'N/A';
        document.getElementById('poolNextIp').textContent = response?.next_ip || 'No IPs available';
        document.getElementById('ipPoolInfo').style.display = 'block';
    }

    allocateIPAddress() {
        const poolId = document.getElementById('ipPoolSelect').value;
        const interfaceName = document.getElementById('ipInterfaceName').value;
        const isPrimary = document.getElementById('ipIsPrimary').checked;

        if (!poolId) {
            alert('Please select an IP pool');
            return;
        }

        const pool = this.ipPools.find(p => p.id === poolId);
        const nextIp = document.getElementById('poolNextIp').textContent;

        if (nextIp === 'No IPs available') {
            alert('No available IPs in this pool');
            return;
        }

        // Add to current device config (not saved to DB yet)
        this.currentDeviceConfig.ip_allocations.push({
            ip_address: nextIp,
            subnet: pool.network,
            vlan_id: pool.vlan_id,
            interface_name: interfaceName,
            is_primary: isPrimary,
            pool_id: poolId
        });

        // Update IP list in device config modal
        this.updateIPAllocationsList();

        // Close IP allocation modal
        document.getElementById('ipAllocationModal').style.display = 'none';

        // Reset form
        document.getElementById('ipPoolSelect').value = '';
        document.getElementById('ipInterfaceName').value = '';
        document.getElementById('ipIsPrimary').checked = false;
        document.getElementById('ipPoolInfo').style.display = 'none';
    }

    updateIPAllocationsList() {
        const ipList = document.getElementById('ipAllocationsList');

        if (this.currentDeviceConfig.ip_allocations.length === 0) {
            ipList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No IP addresses allocated</div>';
            return;
        }

        ipList.innerHTML = this.currentDeviceConfig.ip_allocations.map((ip, index) => `
            <div class="ip-allocation-item">
                <div>
                    <div class="ip-address-display">${ip.ip_address}</div>
                    <div class="ip-interface">${ip.interface_name || 'No interface'} ${ip.is_primary ? '(Primary)' : ''}</div>
                </div>
                <button class="btn-remove-ip" data-index="${index}">Remove</button>
            </div>
        `).join('');

        // Add remove handlers
        ipList.querySelectorAll('.btn-remove-ip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.currentDeviceConfig.ip_allocations.splice(index, 1);
                this.updateIPAllocationsList();
            });
        });
    }

    saveDeviceConfiguration() {
        // Collect form data
        const deviceData = {
            cellId: this.currentDeviceConfig.cellId,
            template_id: this.currentDeviceConfig.template_id,
            name: document.getElementById('deviceName').value,
            device_type: this.currentDeviceConfig.device_type,
            manufacturer: document.getElementById('deviceManufacturer').value,
            model: document.getElementById('deviceModel').value,
            asset_id: document.getElementById('deviceAssetId').value,
            serial_number: document.getElementById('deviceSerialNumber').value,
            status: document.getElementById('deviceStatus').value,
            location: document.getElementById('deviceLocation').value,
            rack_position: document.getElementById('deviceRackPosition').value,
            ip_allocations: this.currentDeviceConfig.ip_allocations,
            site_id: window.editor?.currentSiteId || 1
        };

        if (!deviceData.name) {
            alert('Please enter a device name');
            return;
        }

        // Add to pending devices (will be saved to DB on deploy)
        this.pendingDevices.set(deviceData.cellId, deviceData);

        console.log('[NetworkDevices] Device configured (pending deployment):', deviceData);

        document.getElementById('deviceConfigModal').style.display = 'none';

        // Insert device shape into Draw.io diagram
        this.insertDeviceIntoDrawio(deviceData);

        // Update deploy button and configured devices list
        this.updateDeployButton();
        this.updateConfiguredDevicesList();

        // Show brief success notification
        const primaryIp = deviceData.ip_allocations.find(ip => ip.is_primary);
        let message = `✓ Device added to diagram: ${deviceData.name}`;
        if (primaryIp) {
            message += ` (${primaryIp.ip_address})`;
        }
        console.log(message);
    }

    switchPaletteView(view) {
        if (view === 'templates') {
            document.getElementById('templatesView').style.display = 'block';
            document.getElementById('configuredView').style.display = 'none';
        } else if (view === 'configured') {
            document.getElementById('templatesView').style.display = 'none';
            document.getElementById('configuredView').style.display = 'block';
            this.updateConfiguredDevicesList();
        }
    }

    updateConfiguredDevicesList() {
        const container = document.getElementById('configuredDeviceList');
        const countSpan = document.getElementById('configuredDeviceCount');

        if (!container) return;

        const count = this.pendingDevices.size;
        if (countSpan) countSpan.textContent = count;

        if (count === 0) {
            container.innerHTML = `
                <div class="device-list-empty">
                    <p>No configured devices yet</p>
                    <p style="font-size: 12px; color: #666;">Click on templates to configure devices</p>
                </div>
            `;
            return;
        }

        container.innerHTML = Array.from(this.pendingDevices.values()).map(device => {
            const primaryIp = device.ip_allocations.find(ip => ip.is_primary);
            return `
                <div class="device-template-item configured-device-item" data-cell-id="${device.cellId}">
                    <div class="device-icon">${this.getDeviceIcon(device.device_type)}</div>
                    <div class="device-info">
                        <div class="device-name">${device.name}</div>
                        <div class="device-type" style="font-size: 11px;">
                            ${device.device_type}
                            ${primaryIp ? `<br><strong>${primaryIp.ip_address}</strong>` : ''}
                        </div>
                    </div>
                    <button class="btn-icon-small btn-edit-device" data-cell-id="${device.cellId}" title="Edit">
                        ✏️
                    </button>
                </div>
            `;
        }).join('');

        // Add edit button handlers
        container.querySelectorAll('.btn-edit-device').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cellId = e.target.dataset.cellId;
                this.openDeviceConfigModal(cellId);
            });
        });
    }

    updateDeployButton() {
        const deployBtn = document.getElementById('deployBtn');
        if (deployBtn && this.pendingDevices.size > 0) {
            const count = this.pendingDevices.size;
            deployBtn.innerHTML = `
                <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1V11M8 11L12 7M8 11L4 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Deploy (${count} device${count > 1 ? 's' : ''})
            `;
            deployBtn.classList.add('btn-success');
        }
    }

    async handleDeploy() {
        if (this.pendingDevices.size === 0) {
            // No pending devices, use original deploy functionality
            const event = new CustomEvent('deployDiagram');
            window.dispatchEvent(event);
            return;
        }

        const confirmDeploy = confirm(`Deploy ${this.pendingDevices.size} network device(s) to the database?\n\nThis will create the devices and allocate their IP addresses.`);

        if (!confirmDeploy) return;

        console.log('[NetworkDevices] Deploying pending devices...');

        // Deploy each pending device
        for (const [tempId, deviceData] of this.pendingDevices.entries()) {
            try {
                // Create device in database
                const device = await this.createDeviceInDB(deviceData);

                // Allocate IP addresses for the device
                for (const ipAllocation of deviceData.ip_allocations) {
                    await this.allocateIPInDB(device.id, ipAllocation);
                }

                console.log('[NetworkDevices] Device deployed successfully:', device);

                // Move from pending to deployed
                this.deployedDevices.set(device.id, device);
                this.pendingDevices.delete(tempId);

            } catch (error) {
                console.error('[NetworkDevices] Error deploying device:', error);
                alert(`Failed to deploy device: ${deviceData.name}\nError: ${error.message}`);
                return;
            }
        }

        alert(`Successfully deployed ${this.deployedDevices.size} network device(s)!`);

        // Reset deploy button
        const deployBtn = document.getElementById('deployBtn');
        if (deployBtn) {
            deployBtn.innerHTML = `
                <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1V11M8 11L12 7M8 11L4 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Deploy
            `;
        }
    }

    async createDeviceInDB(deviceData) {
        return new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'device_created') {
                        this.ws.removeEventListener('message', messageHandler);
                        resolve(message.device);
                    } else if (message.type === 'error' && message.action === 'create_device_failed') {
                        this.ws.removeEventListener('message', messageHandler);
                        reject(new Error(message.message));
                    }
                } catch (error) {
                    // Ignore parse errors
                }
            };

            this.ws.addEventListener('message', messageHandler);

            this.ws.send(JSON.stringify({
                action: 'create_network_device',
                device: deviceData
            }));

            // Timeout after 10 seconds
            setTimeout(() => {
                this.ws.removeEventListener('message', messageHandler);
                reject(new Error('Request timeout'));
            }, 10000);
        });
    }

    async allocateIPInDB(deviceId, ipAllocation) {
        return new Promise((resolve, reject) => {
            const messageHandler = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'ip_allocated') {
                        this.ws.removeEventListener('message', messageHandler);
                        resolve(message.allocation);
                    } else if (message.type === 'error' && message.action === 'allocate_ip_failed') {
                        this.ws.removeEventListener('message', messageHandler);
                        reject(new Error(message.message));
                    }
                } catch (error) {
                    // Ignore parse errors
                }
            };

            this.ws.addEventListener('message', messageHandler);

            this.ws.send(JSON.stringify({
                action: 'allocate_ip',
                deviceId: deviceId,
                ipData: ipAllocation
            }));

            // Timeout after 10 seconds
            setTimeout(() => {
                this.ws.removeEventListener('message', messageHandler);
                reject(new Error('Request timeout'));
            }, 10000);
        });
    }

    sendWSMessage(message) {
        return new Promise((resolve, reject) => {
            const handler = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    this.ws.removeEventListener('message', handler);
                    resolve(response);
                } catch (error) {
                    // Ignore parse errors
                }
            };

            this.ws.addEventListener('message', handler);
            this.ws.send(JSON.stringify(message));

            setTimeout(() => {
                this.ws.removeEventListener('message', handler);
                reject(new Error('Timeout'));
            }, 5000);
        });
    }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkDeviceManager;
}