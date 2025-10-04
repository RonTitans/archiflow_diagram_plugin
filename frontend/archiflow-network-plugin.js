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
        pendingDevices: new Map()
    };

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
            } catch (e) {
                // Ignore
            }
        });

        // Request data from parent
        if (window.parent) {
            window.parent.postMessage(JSON.stringify({
                event: 'archiflow_request_data'
            }), '*');
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
                html += '<span style="font-size:24px;margin-right:12px;">' + icon + '</span>';
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
                    return t.id === templateId;
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
    function showDeviceConfigDialog(graph, template) {
        var div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:white;border:1px solid #ccc;border-radius:8px;' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;' +
            'width:600px;max-height:700px;overflow-y:auto;padding:20px;';

        var html = '<h3 style="margin:0 0 15px 0;color:#000;">Configure ' + template.name + '</h3>';
        html += '<div style="margin-bottom:12px;">';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">Device Name *</label>';
        html += '<input type="text" id="deviceName" value="' + template.name + '" ' +
            'style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
        html += '<div>';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">Manufacturer</label>';
        html += '<input type="text" id="deviceManufacturer" value="' + (template.manufacturer || '') + '" ' +
            'style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';
        html += '<div>';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">Model</label>';
        html += '<input type="text" id="deviceModel" value="' + (template.model || '') + '" ' +
            'style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';
        html += '</div>';

        html += '<div style="margin-bottom:12px;">';
        html += '<label style="display:block;margin-bottom:4px;font-weight:600;color:#000;">IP Address</label>';
        html += '<input type="text" id="deviceIpAddress" placeholder="192.168.1.1" ' +
            'style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;color:#000;background:#fff;">';
        html += '</div>';

        html += '<div style="margin-top:20px;text-align:right;">';
        html += '<button id="cancelConfigBtn" style="padding:8px 16px;margin-right:8px;' +
            'border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;color:#000;">Cancel</button>';
        html += '<button id="addDeviceBtn" style="padding:8px 16px;' +
            'border:none;background:#2196F3;color:white;border-radius:4px;cursor:pointer;font-weight:500;">Add to Diagram</button>';
        html += '</div>';

        div.innerHTML = html;
        document.body.appendChild(div);

        // Cancel button
        document.getElementById('cancelConfigBtn').addEventListener('click', function() {
            document.body.removeChild(div);
        });

        // Add device button
        document.getElementById('addDeviceBtn').addEventListener('click', function() {
            var deviceData = {
                template_id: template.id,
                device_type: template.device_type,
                name: document.getElementById('deviceName').value,
                manufacturer: document.getElementById('deviceManufacturer').value,
                model: document.getElementById('deviceModel').value,
                ip_address: document.getElementById('deviceIpAddress').value
            };

            if (!deviceData.name) {
                alert('Please enter a device name');
                return;
            }

            // Insert shape into diagram
            insertDeviceShape(graph, template, deviceData);
            document.body.removeChild(div);
        });
    }

    // Insert device shape into diagram
    function insertDeviceShape(graph, template, deviceData) {
        var parent = graph.getDefaultParent();
        var model = graph.getModel();

        model.beginUpdate();
        try {
            // Get style based on device type
            var style = getDeviceStyle(template.device_type);

            // Create label with device name and IP
            var label = deviceData.name;
            if (deviceData.ip_address) {
                label += '\\n' + deviceData.ip_address;
            }

            // Insert vertex
            var vertex = graph.insertVertex(parent, null, label,
                100, 100, 120, 80, style);

            // Store device metadata in the cell
            vertex.archiflowDevice = deviceData;

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
            if (template) {
                showDeviceConfigDialog(ui.editor.graph, template);
            }
        }
    });

    // Load templates on startup
    loadDeviceTemplates();
    });

})(); // End of IIFE wrapper