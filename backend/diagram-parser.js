// Diagram Parser Module
// Extracts network devices and their metadata from Draw.io XML diagrams

const xml2js = require('xml2js');

class DiagramParser {
    constructor() {
        this.parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true
        });
    }

    /**
     * Parse Draw.io XML and extract all network devices
     * @param {string} diagramXml - The Draw.io XML content
     * @returns {Promise<Array>} Array of device objects
     */
    async extractDevices(diagramXml) {
        try {
            if (!diagramXml) {
                throw new Error('Diagram XML is required');
            }

            // Parse XML
            const result = await this.parser.parseStringPromise(diagramXml);

            const devices = [];

            // Navigate through the XML structure to find cells
            // Draw.io structure: mxfile > diagram > mxGraphModel > root > mxCell[]
            const mxGraphModel = this.findMxGraphModel(result);

            if (!mxGraphModel || !mxGraphModel.root) {
                console.log('[DiagramParser] No root found in diagram');
                return devices;
            }

            // Get all cells
            const cells = Array.isArray(mxGraphModel.root.mxCell)
                ? mxGraphModel.root.mxCell
                : [mxGraphModel.root.mxCell];

            // Extract devices from cells
            for (const cell of cells) {
                if (!cell) continue;

                const device = this.extractDeviceFromCell(cell);
                if (device) {
                    devices.push(device);
                }
            }

            console.log(`[DiagramParser] Extracted ${devices.length} devices from diagram`);
            return devices;

        } catch (error) {
            console.error('[DiagramParser] Error parsing diagram:', error);
            throw error;
        }
    }

    /**
     * Find mxGraphModel in the XML structure
     */
    findMxGraphModel(xmlObj) {
        // Check different possible structures
        if (xmlObj.mxGraphModel) {
            return xmlObj.mxGraphModel;
        }

        if (xmlObj.mxfile) {
            const diagram = xmlObj.mxfile.diagram;
            if (diagram && diagram.mxGraphModel) {
                return diagram.mxGraphModel;
            }
        }

        return null;
    }

    /**
     * Decode HTML entities
     */
    decodeHTML(html) {
        const entities = {
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&amp;': '&',
            '&nbsp;': ' '
        };
        return html.replace(/&[a-z]+;/g, match => entities[match] || match);
    }

    /**
     * Extract text from HTML
     */
    extractTextFromHTML(html) {
        // Simple HTML text extraction - remove tags
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Extract device information from a cell
     */
    extractDeviceFromCell(cell) {
        try {
            // Check if cell has ArchiFlow device metadata
            let value = cell.value || '';
            const style = cell.style || '';

            // Check for Object element (Draw.io custom data structure)
            let objectData = null;
            if (cell.Object) {
                objectData = cell.Object;
                console.log('[DiagramParser] Found Object metadata:', JSON.stringify(objectData));
            }

            // Skip if it's just a basic shape (lines, connectors, etc.)
            // But allow if we have Object metadata or shape=image
            const hasImageShape = style.includes('shape=image');
            if ((!value || typeof value !== 'string') && !objectData && !hasImageShape) {
                return null;
            }

            // Decode HTML entities if value is HTML-encoded
            if (typeof value === 'string' && value.includes('&lt;')) {
                value = this.decodeHTML(value);
            }

            // Extract plain text from HTML
            let plainTextValue = value;
            if (value.includes('<div') || value.includes('<span')) {
                plainTextValue = this.extractTextFromHTML(value);
                console.log('[DiagramParser] Extracted text from HTML:', plainTextValue);
            }

            // ArchiFlow devices can be identified by:
            // 1. Has Object metadata
            // 2. Has shape=image style
            // 3. Device naming pattern (e.g., MAIN-SW-001, DEV-SITE-01, SW-BACKUP-01)
            // 4. Explicit archiflow_device marker

            const isArchiflowDevice = objectData !== null ||
                                      hasImageShape ||
                                      value.includes('archiflow_device') ||
                                      style.includes('archiflow');

            // Check for device naming patterns (TYPE-SITE-##, SITE-TYPE-##, or similar)
            const deviceNamePattern = /([A-Z]+)-([A-Z]+)-(\d+)/;
            const hasDevicePattern = deviceNamePattern.test(plainTextValue);

            // Only process if it looks like a device
            if (!isArchiflowDevice && !hasDevicePattern) {
                return null;
            }

            // Extract device name and IP from plain text value
            let deviceName = plainTextValue.trim();
            let ipAddress = null;

            // Parse if value contains newlines or spaces (name IP format)
            const parts = deviceName.split(/[\n\s]+/);
            if (parts.length >= 2) {
                deviceName = parts[0].trim();
                // Check if second part looks like an IP
                if (parts[1].match(/^\d+\.\d+\.\d+\.\d+/)) {
                    ipAddress = parts[1].trim();
                }
            }

            // Get metadata from Object element if available
            let metadata = {};
            if (objectData) {
                metadata = objectData;
                // Override with Object data
                if (objectData.name) deviceName = objectData.name;
                if (objectData.ip_address) ipAddress = objectData.ip_address;
            } else {
                // Try to parse metadata from value if in key=value format
                metadata = this.parseMetadata(value);
            }

            // Infer device type from name pattern, Object data, or style
            let deviceType = metadata.device_type || metadata.type;
            if (!deviceType) {
                if (deviceName.includes('-SW-') || deviceName.startsWith('SW-')) deviceType = 'switch';
                else if (deviceName.includes('-RTR-')) deviceType = 'router';
                else if (deviceName.includes('-FW-')) deviceType = 'firewall';
                else if (deviceName.includes('-SRV-')) deviceType = 'server';
                else if (deviceName.includes('-AP-')) deviceType = 'access_point';
                else deviceType = 'server'; // default
            }

            // Extract device information
            const device = {
                cell_id: cell.id,
                name: metadata.device_name || deviceName,
                device_type: deviceType,
                manufacturer: metadata.manufacturer || null,
                model: metadata.model || null,
                ip_address: metadata.ip_address || metadata.ip || ipAddress,
                pool_id: metadata.pool_id || null,
                site_id: metadata.site_id ? parseInt(metadata.site_id) : null,
                status: metadata.status || 'active',

                // Position and visual data from geometry
                x_position: cell.mxGeometry && cell.mxGeometry.x ? parseFloat(cell.mxGeometry.x) :
                           (cell.x ? parseFloat(cell.x) : null),
                y_position: cell.mxGeometry && cell.mxGeometry.y ? parseFloat(cell.mxGeometry.y) :
                           (cell.y ? parseFloat(cell.y) : null),
                width: cell.mxGeometry && cell.mxGeometry.width ? parseFloat(cell.mxGeometry.width) :
                      (cell.width ? parseFloat(cell.width) : null),
                height: cell.mxGeometry && cell.mxGeometry.height ? parseFloat(cell.mxGeometry.height) :
                       (cell.height ? parseFloat(cell.height) : null),
                style: style,

                // Additional metadata
                metadata: metadata
            };

            console.log(`[DiagramParser] Extracted device: ${device.name} (${device.device_type})`);
            return device;

        } catch (error) {
            console.error('[DiagramParser] Error extracting device from cell:', error);
            return null;
        }
    }

    /**
     * Parse metadata string (key=value;key2=value2)
     */
    parseMetadata(value) {
        const metadata = {};

        if (!value) return metadata;

        // Try to parse as JSON first
        if (value.startsWith('{')) {
            try {
                return JSON.parse(value);
            } catch (e) {
                // Not JSON, continue with key=value parsing
            }
        }

        // Parse key=value pairs
        const pairs = value.split(';');
        for (const pair of pairs) {
            const [key, ...valueParts] = pair.split('=');
            if (key && valueParts.length > 0) {
                const val = valueParts.join('=').trim();
                metadata[key.trim()] = val;
            }
        }

        return metadata;
    }

    /**
     * Extract connections between devices
     */
    async extractConnections(diagramXml) {
        try {
            const result = await this.parser.parseStringPromise(diagramXml);
            const mxGraphModel = this.findMxGraphModel(result);

            if (!mxGraphModel || !mxGraphModel.root) {
                return [];
            }

            const cells = Array.isArray(mxGraphModel.root.mxCell)
                ? mxGraphModel.root.mxCell
                : [mxGraphModel.root.mxCell];

            const connections = [];

            for (const cell of cells) {
                if (!cell) continue;

                // Edges/connections have source and target
                if (cell.source && cell.target && cell.edge === '1') {
                    connections.push({
                        id: cell.id,
                        source_cell_id: cell.source,
                        target_cell_id: cell.target,
                        style: cell.style || '',
                        connection_type: this.inferConnectionType(cell.style)
                    });
                }
            }

            console.log(`[DiagramParser] Extracted ${connections.length} connections from diagram`);
            return connections;

        } catch (error) {
            console.error('[DiagramParser] Error extracting connections:', error);
            return [];
        }
    }

    /**
     * Infer connection type from style
     */
    inferConnectionType(style) {
        if (!style) return 'ethernet';

        style = style.toLowerCase();

        if (style.includes('fiber')) return 'fiber';
        if (style.includes('wireless')) return 'wireless';
        if (style.includes('vpn')) return 'vpn';
        if (style.includes('wan')) return 'internet';

        return 'ethernet';
    }
}

module.exports = DiagramParser;
