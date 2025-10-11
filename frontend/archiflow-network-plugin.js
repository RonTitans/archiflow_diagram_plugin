/**
 * ArchiFlow Network Devices Plugin for Draw.io
 * Adds network device management capabilities to Draw.io diagrams
 */

// Wrap in IIFE to allow return statement
(function() {
    // Prevent duplicate loading
    if (window.archiflowPluginLoaded) {
        console.log('[ArchiFlow Plugin] Already loaded, skipping initialization');
        return;
    }
    window.archiflowPluginLoaded = true;

    Draw.loadPlugin(function(ui) {
    // Add localized strings
    mxResources.parse('addNetworkDevice=Add Network Device...');
    mxResources.parse('configureDevice=Configure Device...');

    // Store network device data
    var networkDeviceManager = {
        templates: [],
        ipPools: [],
        sites: [],
        currentSite: null, // Initialize as null
        pendingDevices: new Map(),
        deviceCounters: {} // Track device counts locally
    };

    // Generate device name based on type and site
    async function generateDeviceName(template, site) {
        // Device type prefixes (industry standard)
        var prefixes = {
            'switch': 'SW',
            'router': 'RTR',
            'firewall': 'FW',
            'server': 'SRV',
            'wireless_ap': 'AP',
            'load_balancer': 'LB',
            'storage': 'STG',
            'vm': 'VM'
        };

        var prefix = prefixes[template.device_type] || 'DEV';
        var siteCode = 'SITE'; // Default

        if (site) {
            // Try site_code first, then slug, then first 3 letters of name
            siteCode = site.site_code || site.slug || site.name.substring(0, 3).toUpperCase();
            // Clean up the code (remove spaces, special chars)
            siteCode = siteCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
            if (siteCode.length > 6) {
                siteCode = siteCode.substring(0, 6);
            }
        }

        // CRITICAL FIX: Get next counter from backend (checks NetBox + local DB)
        console.log('[ArchiFlow] Requesting next device counter for:', prefix + '-' + siteCode);

        try {
            // Request counter from backend via parent window
            var counterPromise = new Promise(function(resolve, reject) {
                var messageHandler = function(event) {
                    if (event.data && typeof event.data === 'string') {
                        try {
                            var data = JSON.parse(event.data);
                            if (data.event === 'next_device_counter') {
                                window.removeEventListener('message', messageHandler);
                                resolve(data.nextCounter);
                            }
                        } catch (e) {
                            // Ignore non-JSON messages
                        }
                    }
                };

                window.addEventListener('message', messageHandler);

                // Timeout after 3 seconds
                setTimeout(function() {
                    window.removeEventListener('message', messageHandler);
                    reject(new Error('Timeout waiting for device counter'));
                }, 3000);

                // Send request to parent
                window.parent.postMessage(JSON.stringify({
                    event: 'get_next_device_counter',
                    prefix: prefix,
                    siteCode: siteCode
                }), '*');
            });

            var nextCounter = await counterPromise;
            console.log('[ArchiFlow] Received next counter:', nextCounter);
            var number = String(nextCounter).padStart(2, '0');
            return prefix + '-' + siteCode + '-' + number;

        } catch (error) {
            console.error('[ArchiFlow] Error getting device counter, falling back to local:', error);

            // Fallback to old in-memory counter if backend fails
            var counterKey = prefix + '-' + siteCode;
            if (!networkDeviceManager.deviceCounters[counterKey]) {
                networkDeviceManager.deviceCounters[counterKey] = 0;
            }
            networkDeviceManager.deviceCounters[counterKey]++;
            var number = String(networkDeviceManager.deviceCounters[counterKey]).padStart(2, '0');
            return prefix + '-' + siteCode + '-' + number;
        }
    }

    // Get the graph instance
    var graph = ui.editor.graph;

    // Helper function to create formatted device labels
    function createDeviceLabel(deviceData, style) {
        style = style || 'default'; // default, compact, badge, minimal

        if (style === 'minimal') {
            // Just the name, IP as tooltip
            return '<div style="text-align:center;">' +
                '<div style="font-weight:bold;font-size:14px;color:#2c3e50;">' +
                deviceData.name + '</div>' +
                (deviceData.ip_address ?
                    '<div style="font-size:12px;color:#555;margin-top:3px;font-weight:500;">' +
                    deviceData.ip_address + '</div>' : '') +
                '</div>';
        } else if (style === 'compact') {
            // Name and IP on same line
            return '<div style="text-align:center;font-size:10px;">' +
                '<span style="font-weight:bold;color:#2c3e50;">' + deviceData.name + '</span>' +
                (deviceData.ip_address ?
                    ' <span style="color:#95a5a6;">| ' + deviceData.ip_address + '</span>' : '') +
                '</div>';
        } else if (style === 'badge') {
            // IP in a badge style
            return '<div style="text-align:center;font-family:Arial,sans-serif;">' +
                '<div style="font-weight:bold;font-size:12px;color:#2c3e50;margin-bottom:3px;">' +
                deviceData.name + '</div>' +
                (deviceData.ip_address ?
                    '<div style="font-size:10px;color:white;background:#3498db;' +
                    'padding:2px 8px;border-radius:10px;display:inline-block;">' +
                    deviceData.ip_address + '</div>' : '') +
                '</div>';
        } else {
            // Default style with gray background for IP
            return '<div style="text-align:center;font-family:Arial,sans-serif;">' +
                '<div style="font-weight:bold;font-size:12px;color:#333;margin-bottom:2px;">' +
                deviceData.name + '</div>' +
                (deviceData.ip_address ?
                    '<div style="font-size:10px;color:#666;background:#f0f0f0;' +
                    'padding:2px 6px;border-radius:3px;display:inline-block;">' +
                    deviceData.ip_address + '</div>' : '') +
                '</div>';
        }
    }

    // Listen for cell removals
    graph.addListener(mxEvent.REMOVE_CELLS, function(sender, evt) {
        var cells = evt.getProperty('cells');
        if (cells && cells.length > 0) {
            cells.forEach(function(cell) {
                // Check if this cell has ArchiFlow device data
                if (cell.archiflowDevice && cell.archiflowDevice.ip_address) {
                    console.log('[ArchiFlow] Device removed, releasing IP:', cell.archiflowDevice.ip_address);

                    // Notify parent to release the IP
                    if (window.parent) {
                        window.parent.postMessage(JSON.stringify({
                            event: 'archiflow_device_removed',
                            device: cell.archiflowDevice,
                            cellId: cell.id
                        }), '*');
                    }
                }
            });
        }
    });

    // Listen for double-clicks to edit devices
    graph.addListener(mxEvent.DOUBLE_CLICK, function(sender, evt) {
        var cell = evt.getProperty('cell');

        // Only handle cells with ArchiFlow device data
        if (cell && cell.archiflowDevice) {
            evt.consume(); // Prevent default double-click behavior

            console.log('[ArchiFlow] Double-click on device:', cell.archiflowDevice);

            // Find the template for this device
            var template = networkDeviceManager.templates.find(function(t) {
                return t.id === cell.archiflowDevice.template_id;
            });

            // If no template found, create a basic one from device data
            if (!template) {
                console.log('[ArchiFlow] No template found, creating from device data');
                template = {
                    id: cell.archiflowDevice.template_id || 'custom',
                    name: cell.archiflowDevice.name || 'Network Device',
                    device_type: cell.archiflowDevice.device_type || 'router',
                    manufacturer: cell.archiflowDevice.manufacturer || '',
                    model: cell.archiflowDevice.model || ''
                };
            }

            showDeviceConfigDialog(graph, template, cell);
        }
    });

    // Fetch device templates from backend
    function loadDeviceTemplates() {
        // This will be called by the parent window
        window.addEventListener('message', function(evt) {
            try {
                var msg = JSON.parse(evt.data);
                if (msg.event === 'archiflow_templates') {
                    networkDeviceManager.templates = msg.templates;
                }
                if (msg.event === 'archiflow_ip_pools') {
                    networkDeviceManager.ipPools = msg.pools;
                }
                if (msg.event === 'archiflow_vlans') {
                    networkDeviceManager.vlans = msg.vlans;
                    console.log('[ArchiFlow] VLANs loaded:', networkDeviceManager.vlans);
                }
                if (msg.event === 'archiflow_current_site') {
                    networkDeviceManager.currentSite = msg.site;
                    console.log('[ArchiFlow] Current site:', networkDeviceManager.currentSite);
                }
                if (msg.event === 'archiflow_pool_ips') {
                    displayPoolIPs(msg.ips);
                }
            } catch (e) {
                // Ignore
            }
        });

        // Request data from parent
        if (window.parent) {
            window.parent.postMessage(JSON.stringify({
                event: 'archiflow_request_data'
            }), '*');

            // Also request current site
            window.parent.postMessage(JSON.stringify({
                event: 'archiflow_request_current_site'
            }), '*');

            console.log('[ArchiFlow Plugin] Requesting data and current site from parent');
        }
    }

    // Show device template selection dialog
    function showDeviceTemplateDialog(graph) {
        var div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:white;border:1px solid #ccc;border-radius:8px;' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;' +
            'width:500px;max-height:600px;overflow-y:auto;padding:20px;';

        var html = '<h3 style="margin:0 0 15px 0;color:#000;">Select Network Device</h3>';
        html += '<div style="margin-bottom:15px;">';
        html += '<input type="text" id="deviceTemplateSearch" placeholder="Search devices..." ' +
            'style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';
        html += '<div id="deviceTemplateList" style="max-height:400px;overflow-y:auto;">';

        // Render templates
        if (networkDeviceManager.templates.length === 0) {
            html += '<p style="text-align:center;color:#999;">Loading templates...</p>';
        } else {
            networkDeviceManager.templates.forEach(function(template) {
                var icon = getDeviceIcon(template.device_type);
                html += '<div class="template-item" data-template-id="' + template.id + '" ' +
                    'style="padding:12px;margin:8px 0;border:1px solid #e0e0e0;border-radius:6px;' +
                    'cursor:pointer;display:flex;align-items:center;transition:all 0.2s;" ' +
                    'onmouseover="this.style.background=\'#f5f5f5\';this.style.borderColor=\'#2196F3\';" ' +
                    'onmouseout="this.style.background=\'white\';this.style.borderColor=\'#e0e0e0\';">';
                // Show image if available, otherwise show icon
                if (template.image_url) {
                    html += '<img src="' + template.image_url + '" style="width:60px;height:40px;object-fit:contain;margin-right:12px;" ' +
                        'onerror="this.outerHTML=\'<span style=\\\'font-size:24px;margin-right:12px;\\\'>' + icon + '</span>\'">';
                } else {
                    html += '<span style="font-size:24px;margin-right:12px;">' + icon + '</span>';
                }
                html += '<div>';
                html += '<div style="font-weight:600;margin-bottom:4px;color:#000;">' + template.name + '</div>';
                html += '<div style="font-size:11px;color:#333;">' + template.device_type + '</div>';
                html += '</div>';
                html += '</div>';
            });
        }

        html += '</div>';
        html += '<div style="margin-top:15px;text-align:right;">';
        html += '<button id="cancelDeviceBtn" style="padding:8px 16px;margin-right:8px;' +
            'border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;color:#000;">Cancel</button>';
        html += '</div>';

        div.innerHTML = html;
        document.body.appendChild(div);

        // Add event listeners
        document.getElementById('cancelDeviceBtn').addEventListener('click', function() {
            document.body.removeChild(div);
        });

        // Template selection
        var templateItems = div.querySelectorAll('.template-item');
        templateItems.forEach(function(item) {
            item.addEventListener('click', function() {
                var templateId = this.getAttribute('data-template-id');
                var template = networkDeviceManager.templates.find(function(t) {
                    return String(t.id) === String(templateId);
                });
                document.body.removeChild(div);
                showDeviceConfigDialog(graph, template);
            });
        });

        // Search functionality
        document.getElementById('deviceTemplateSearch').addEventListener('input', function(e) {
            var query = e.target.value.toLowerCase();
            templateItems.forEach(function(item) {
                var text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? 'flex' : 'none';
            });
        });
    }

    // Show device configuration dialog
    async function showDeviceConfigDialog(graph, template, existingCell) {
        var div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:white;border:1px solid #ccc;border-radius:8px;' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;' +
            'width:600px;max-height:700px;overflow-y:auto;padding:20px;';

        var isEdit = existingCell && existingCell.archiflowDevice;
        var existingDevice = isEdit ? existingCell.archiflowDevice : null;

        var html = '<h3 style="margin:0 0 15px 0;color:#000;">' + (isEdit ? 'Edit' : 'Configure') + ' ' + template.name + '</h3>';

        // Auto-generate name based on current site
        var autoGeneratedName = '';
        if (!isEdit) {
            // Try to use current site or use a default
            var siteForNaming = networkDeviceManager.currentSite || { site_code: 'SITE', name: 'Default Site' };
            autoGeneratedName = await generateDeviceName(template, siteForNaming);

            // Request current site from parent if we don't have it
            if (!networkDeviceManager.currentSite && window.parent) {
                window.parent.postMessage(JSON.stringify({
                    event: 'archiflow_request_current_site'
                }), '*');
            }
        }

        html += '<div style="margin-bottom:12px;">';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">Device Name *</label>';
        html += '<div style="display:flex;gap:8px;">';
        html += '<input type="text" id="deviceName" value="' +
            (isEdit && existingDevice.name ? existingDevice.name : autoGeneratedName) + '" ' +
            'placeholder="Enter device name" ' +
            'style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '<button id="autoNameBtn" type="button" style="padding:8px 12px;border:1px solid #2196F3;' +
            'background:#fff;color:#2196F3;border-radius:4px;cursor:pointer;font-size:12px;" title="Generate new name">↻</button>';
        html += '</div>';
        html += '<div style="font-size:11px;color:#666;margin-top:4px;">Auto-generated format: TYPE-SITE-NUMBER (e.g., SW-' +
            (networkDeviceManager.currentSite ? networkDeviceManager.currentSite.site_code : 'SITE') + '-01)</div>';
        html += '</div>';

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
        html += '<div>';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">Manufacturer</label>';
        html += '<input type="text" id="deviceManufacturer" value="' + (isEdit && existingDevice.manufacturer ? existingDevice.manufacturer : (template.manufacturer || '')) + '" ' +
            'style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';
        html += '<div>';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">Model</label>';
        html += '<input type="text" id="deviceModel" value="' + (isEdit && existingDevice.model ? existingDevice.model : (template.model || '')) + '" ' +
            'style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';
        html += '</div>';

        html += '<div style="margin-bottom:12px;">';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">IP Address</label>';
        html += '<div style="display:flex;gap:8px;margin-bottom:8px;">';
        html += '<select id="ipPoolSelect" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '<option value="">Select IP Pool...</option>';
        html += '</select>';
        html += '<input type="text" id="deviceIpAddress" value="' + (isEdit && existingDevice.ip_address ? existingDevice.ip_address : '') + '" placeholder="Or enter manually" ' +
            'style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';
        html += '<div id="ipListContainer" style="max-height:200px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;display:none;">';
        html += '<div style="padding:8px;text-align:center;color:#999;">Select a pool to view available IPs</div>';
        html += '</div>';
        html += '</div>';

        // VLAN selection
        html += '<div style="margin-bottom:12px;">';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">VLAN</label>';
        html += '<select id="vlanSelect" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '<option value="">Select VLAN...</option>';
        html += '</select>';
        html += '</div>';

        html += '<div style="margin-top:20px;text-align:right;">';
        html += '<button id="cancelConfigBtn" style="padding:8px 16px;margin-right:8px;' +
            'border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;color:#000;">Cancel</button>';
        html += '<button id="addDeviceBtn" style="padding:8px 16px;' +
            'border:none;background:#2196F3;color:white;border-radius:4px;cursor:pointer;font-weight:500;">' + (isEdit ? 'Update Device' : 'Add to Diagram') + '</button>';
        html += '</div>';

        div.innerHTML = html;
        document.body.appendChild(div);

        // Load IP pools
        if (networkDeviceManager.ipPools && networkDeviceManager.ipPools.length > 0) {
            var poolSelect = document.getElementById('ipPoolSelect');
            networkDeviceManager.ipPools.forEach(function(pool) {
                var option = document.createElement('option');
                option.value = pool.id;
                option.textContent = pool.name + ' (' + pool.network + ')';
                poolSelect.appendChild(option);
            });
        }

        // Load VLANs
        if (networkDeviceManager.vlans && networkDeviceManager.vlans.length > 0) {
            var vlanSelect = document.getElementById('vlanSelect');
            networkDeviceManager.vlans.forEach(function(vlan) {
                var option = document.createElement('option');
                option.value = vlan.id;
                option.textContent = 'VLAN ' + vlan.vid + ' - ' + vlan.name;
                vlanSelect.appendChild(option);
            });

            // Pre-select VLAN if device already has one
            if (isEdit && existingDevice.vlan_id) {
                vlanSelect.value = existingDevice.vlan_id;
            }
        }

        // Handle auto-generate name button (regenerate with new number)
        document.getElementById('autoNameBtn').addEventListener('click', function() {
            // Use current site or create a default one
            var siteToUse = networkDeviceManager.currentSite;
            if (!siteToUse) {
                // Try to get from parent one more time
                if (window.parent) {
                    window.parent.postMessage(JSON.stringify({
                        event: 'archiflow_request_current_site'
                    }), '*');
                }
                // Use a default for now
                siteToUse = { site_code: 'SITE', name: 'Default Site' };
            }

            generateDeviceName(template, siteToUse).then(function(autoName) {
                document.getElementById('deviceName').value = autoName;
            }).catch(function(error) {
                console.error('[ArchiFlow] Error generating device name:', error);
            });
        });

        // Handle pool selection
        document.getElementById('ipPoolSelect').addEventListener('change', function(e) {
            var poolId = e.target.value;
            if (poolId) {
                loadPoolIPs(poolId);
            } else {
                document.getElementById('ipListContainer').style.display = 'none';
            }
        });

        // Function to load IPs from selected pool
        function loadPoolIPs(poolId) {
            var container = document.getElementById('ipListContainer');
            container.style.display = 'block';
            container.innerHTML = '<div style="padding:8px;text-align:center;color:#999;">Loading IPs...</div>';

            // Send message to get pool IPs
            window.parent.postMessage(JSON.stringify({
                action: 'get_pool_ips',
                poolId: poolId
            }), '*');
        }

        // Cancel button
        document.getElementById('cancelConfigBtn').addEventListener('click', function() {
            document.body.removeChild(div);
        });

        // Add/Update device button
        document.getElementById('addDeviceBtn').addEventListener('click', function() {
            var poolSelect = document.getElementById('ipPoolSelect');
            var vlanSelect = document.getElementById('vlanSelect');
            var newIpAddress = document.getElementById('deviceIpAddress').value;
            var deviceData = {
                template_id: template.id,
                device_type: template.device_type,
                name: document.getElementById('deviceName').value,
                manufacturer: document.getElementById('deviceManufacturer').value,
                model: document.getElementById('deviceModel').value,
                ip_address: newIpAddress,
                pool_id: poolSelect ? poolSelect.value : null,
                vlan_id: vlanSelect ? vlanSelect.value : null
            };

            if (!deviceData.name) {
                alert('Please enter a device name');
                return;
            }

            // Check if we're changing IP addresses
            if (isEdit && existingDevice.ip_address && existingDevice.ip_address !== newIpAddress) {
                var confirmMsg = 'You are changing the IP address from ' + existingDevice.ip_address + ' to ' + newIpAddress + '.\n\n';
                confirmMsg += 'This will release the old IP address back to the pool and allocate the new one.\n\n';
                confirmMsg += 'Do you want to continue?';

                if (!confirm(confirmMsg)) {
                    return;
                }

                // Release old IP
                if (window.parent) {
                    window.parent.postMessage(JSON.stringify({
                        event: 'archiflow_ip_changed',
                        oldIp: existingDevice.ip_address,
                        newIp: newIpAddress,
                        deviceName: deviceData.name
                    }), '*');
                }
            }

            if (isEdit) {
                // Update existing device
                updateDeviceShape(graph, existingCell, deviceData);
            } else {
                // Insert new shape into diagram
                insertDeviceShape(graph, template, deviceData);
            }
            document.body.removeChild(div);
        });
    }

    // Update existing device shape
    function updateDeviceShape(graph, cell, deviceData) {
        var model = graph.getModel();

        model.beginUpdate();
        try {
            var label;

            // If the cell has an image, use HTML formatted label
            if (cell.archiflowDevice && cell.archiflowDevice.image_url) {
                // Use the same style as in insertDeviceShape
                label = createDeviceLabel(deviceData, 'minimal');

                var currentStyle = model.getStyle(cell);
                if (!currentStyle || !currentStyle.includes('html=1')) {
                    var newStyle = 'shape=image;image=' + cell.archiflowDevice.image_url + ';' +
                        'verticalLabelPosition=bottom;verticalAlign=top;' +
                        'labelBackgroundColor=transparent;spacing=8;spacingTop=8;' +
                        'imageBackground=none;imageBorder=none;' +
                        'imageAspect=0;html=1';
                    model.setStyle(cell, newStyle);
                }
            } else {
                // Plain text label for devices without images
                label = deviceData.name;
                if (deviceData.ip_address) {
                    label += '\\n' + deviceData.ip_address;
                }
            }

            // Update the cell value
            model.setValue(cell, label);

            // Update device metadata in the cell
            cell.archiflowDevice = deviceData;

            // Notify parent window
            if (window.parent) {
                window.parent.postMessage(JSON.stringify({
                    event: 'archiflow_device_updated',
                    device: deviceData
                }), '*');
            }

        } finally {
            model.endUpdate();
        }
    }

    // Insert device shape into diagram
    function insertDeviceShape(graph, template, deviceData) {
        var parent = graph.getDefaultParent();
        var model = graph.getModel();

        model.beginUpdate();
        try {
            // Create label with device name and IP
            var label = deviceData.name;
            if (deviceData.ip_address) {
                label += '\\n' + deviceData.ip_address;
            }

            var vertex;

            // Check if template has an image
            if (template.image_url) {
                // Use the helper function to create formatted label
                // You can change 'minimal' to 'default', 'compact', or 'badge' for different styles
                var htmlLabel = createDeviceLabel(deviceData, 'minimal');

                // Use image style for devices with images
                var imageStyle = 'shape=image;image=' + template.image_url + ';' +
                    'verticalLabelPosition=bottom;verticalAlign=top;' +
                    'labelBackgroundColor=transparent;spacing=8;spacingTop=8;' +
                    'imageBackground=none;imageBorder=none;' +
                    'imageAspect=0;html=1'; // html=1 enables HTML labels

                // Use template's default dimensions or calculate based on aspect
                var width = template.default_width || 340;
                var height = template.default_height || 35;

                vertex = graph.insertVertex(parent, null, htmlLabel,
                    100, 100, width, height, imageStyle);
            } else {
                // Use standard style for devices without images
                var style = getDeviceStyle(template.device_type);
                vertex = graph.insertVertex(parent, null, label,
                    100, 100, 120, 80, style);
            }

            // Store device metadata in the cell
            vertex.archiflowDevice = deviceData;
            vertex.archiflowDevice.image_url = template.image_url; // Store image URL for later use

            // Select the new cell
            graph.setSelectionCell(vertex);

            // Notify parent window
            if (window.parent) {
                window.parent.postMessage(JSON.stringify({
                    event: 'archiflow_device_added',
                    device: deviceData
                }), '*');
            }

        } finally {
            model.endUpdate();
        }
    }

    // Display pool IPs in the container
    function displayPoolIPs(ips) {
        var container = document.getElementById('ipListContainer');
        if (!container) return;

        var html = '<div style="max-height:200px;overflow-y:auto;">';

        if (ips && ips.length > 0) {
            ips.forEach(function(ipInfo) {
                var bgColor, textColor, status;
                var isClickable = true;

                if (ipInfo.is_gateway) {
                    bgColor = '#fff3e0';
                    textColor = '#e65100';
                    status = '🚪 Gateway';
                    isClickable = false;
                } else if (ipInfo.is_reserved) {
                    bgColor = '#fce4ec';
                    textColor = '#c2185b';
                    status = '🔐 Reserved';
                    isClickable = false;
                } else if (ipInfo.is_allocated) {
                    bgColor = '#ffebee';
                    textColor = '#c62828';
                    status = '🔒 ' + (ipInfo.device_name || 'Allocated');
                    isClickable = false;
                } else {
                    bgColor = '#e8f5e9';
                    textColor = '#2e7d32';
                    status = '✅ Available';
                }

                var cursorStyle = isClickable ? 'pointer' : 'not-allowed';

                html += '<div class="ip-item" data-ip="' + ipInfo.ip_address + '" ' +
                    'data-clickable="' + isClickable + '" ' +
                    'style="padding:8px 12px;cursor:' + cursorStyle + ';display:flex;justify-content:space-between;' +
                    'border-bottom:1px solid #eee;background:' + bgColor + ';" ' +
                    'onmouseover="this.style.background=\'#f5f5f5\'" ' +
                    'onmouseout="this.style.background=\'' + bgColor + '\'">';
                html += '<span style="font-family:monospace;color:#000;">' + ipInfo.ip_address + '</span>';
                html += '<span style="font-size:12px;color:' + textColor + ';">' + status + '</span>';
                html += '</div>';
            });
        } else {
            html += '<div style="padding:12px;text-align:center;color:#999;">No IPs available in this pool</div>';
        }

        html += '</div>';
        container.innerHTML = html;
        container.style.display = 'block';

        // Add click handlers to IP items
        var ipItems = container.querySelectorAll('.ip-item');
        ipItems.forEach(function(item) {
            item.addEventListener('click', function() {
                var isClickable = this.getAttribute('data-clickable') === 'true';
                if (isClickable) {
                    var ip = this.getAttribute('data-ip');
                    document.getElementById('deviceIpAddress').value = ip;
                    // Highlight selected
                    ipItems.forEach(function(i) {
                        i.style.border = 'none';
                    });
                    this.style.border = '2px solid #2196F3';
                }
            });
        });
    }

    // Get device icon
    function getDeviceIcon(deviceType) {
        var icons = {
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

    // Get device style
    function getDeviceStyle(deviceType) {
        var styles = {
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

    // Add action to UI
    ui.actions.addAction('addNetworkDevice', function() {
        showDeviceTemplateDialog(ui.editor.graph);
    });

    // Extend the popup menu (right-click context menu)
    var uiCreatePopupMenu = ui.menus.createPopupMenu;
    ui.menus.createPopupMenu = function(menu, cell, evt) {
        uiCreatePopupMenu.apply(this, arguments);

        // Add separator
        menu.addSeparator();

        // Add "Add Network Device" menu item
        this.addMenuItems(menu, ['addNetworkDevice'], null, evt);

        // If a device cell is selected, add "Configure Device" option
        if (cell && cell.archiflowDevice) {
            this.addMenuItems(menu, ['configureDevice'], null, evt);
        }
    };

    // Add configure device action
    ui.actions.addAction('configureDevice', function() {
        var cell = ui.editor.graph.getSelectionCell();
        if (cell && cell.archiflowDevice) {
            // Re-open config dialog with existing data
            var template = networkDeviceManager.templates.find(function(t) {
                return t.id === cell.archiflowDevice.template_id;
            });

            // If no template found, create a basic one from device data
            if (!template && cell.archiflowDevice) {
                template = {
                    id: cell.archiflowDevice.template_id || 'custom',
                    name: cell.archiflowDevice.name || 'Network Device',
                    device_type: cell.archiflowDevice.device_type || 'router',
                    manufacturer: cell.archiflowDevice.manufacturer || '',
                    model: cell.archiflowDevice.model || ''
                };
            }

            if (template) {
                showDeviceConfigDialog(ui.editor.graph, template, cell);
            }
        }
    });

    // Load templates on startup
    loadDeviceTemplates();
    });

})(); // End of IIFE wrapper