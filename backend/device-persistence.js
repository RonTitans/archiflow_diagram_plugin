// Device Persistence Module
// Handles saving devices extracted from diagrams to the database

const { v4: uuidv4 } = require('uuid');

class DevicePersistence {
    constructor(db) {
        this.db = db;
    }

    /**
     * Save devices from diagram to database
     * @param {string} diagramId - The diagram UUID
     * @param {Array} devices - Array of device objects from parser
     * @param {number} siteId - Site ID for the diagram
     * @returns {Promise<Object>} Summary of saved devices
     */
    async saveDevices(diagramId, devices, siteId) {
        try {
            console.log(`[DevicePersistence] Saving ${devices.length} devices for diagram ${diagramId}`);

            const results = {
                created: [],
                updated: [],
                errors: []
            };

            for (const device of devices) {
                try {
                    const savedDevice = await this.saveDevice(diagramId, device, siteId);

                    if (savedDevice.isNew) {
                        results.created.push(savedDevice.device);
                    } else {
                        results.updated.push(savedDevice.device);
                    }
                } catch (error) {
                    console.error(`[DevicePersistence] Error saving device ${device.name}:`, error);
                    results.errors.push({
                        device: device.name,
                        error: error.message
                    });
                }
            }

            console.log(`[DevicePersistence] Results: ${results.created.length} created, ${results.updated.length} updated, ${results.errors.length} errors`);

            return results;

        } catch (error) {
            console.error('[DevicePersistence] Error in saveDevices:', error);
            throw error;
        }
    }

    /**
     * Save a single device
     */
    async saveDevice(diagramId, deviceData, siteId) {
        try {
            // Check if device already exists in this diagram by cell_id
            const existingMapping = await this.db.query(
                `SELECT d.*, ddm.id as mapping_id
                 FROM archiflow.device_diagram_mapping ddm
                 JOIN archiflow.network_devices d ON ddm.device_id = d.id
                 WHERE ddm.diagram_id = $1 AND ddm.cell_id = $2`,
                [diagramId, deviceData.cell_id]
            );

            let deviceId;
            let isNew = false;

            if (existingMapping.rows.length > 0) {
                // Update existing device
                deviceId = existingMapping.rows[0].id;
                await this.updateDevice(deviceId, deviceData, siteId);
                console.log(`[DevicePersistence] Updated device: ${deviceData.name} (${deviceId})`);
            } else {
                // Create new device
                deviceId = await this.createDevice(deviceData, siteId);
                isNew = true;
                console.log(`[DevicePersistence] Created device: ${deviceData.name} (${deviceId})`);
            }

            // Update or create device-diagram mapping
            await this.updateDeviceDiagramMapping(deviceId, diagramId, deviceData);

            console.log(`[DevicePersistence] About to check IP allocation. deviceData.ip_address = ${deviceData.ip_address}`);

            // Update IP allocation if device has IP
            if (deviceData.ip_address) {
                console.log(`[DevicePersistence] Calling updateIPAllocation for device ${deviceData.name}`);
                await this.updateIPAllocation(deviceId, deviceData);
            } else {
                console.log(`[DevicePersistence] No IP address found for device ${deviceData.name}`);
            }

            return {
                device: {
                    id: deviceId,
                    name: deviceData.name,
                    type: deviceData.device_type,
                    ip: deviceData.ip_address
                },
                isNew
            };

        } catch (error) {
            console.error(`[DevicePersistence] Error saving device ${deviceData.name}:`, error);
            throw error;
        }
    }

    /**
     * Create a new device in network_devices table
     */
    async createDevice(deviceData, siteId) {
        const deviceId = uuidv4();

        const query = `
            INSERT INTO archiflow.network_devices (
                id, name, device_type, manufacturer, model,
                site_id, status, metadata, created_by, modified_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;

        const values = [
            deviceId,
            deviceData.name,
            this.normalizeDeviceType(deviceData.device_type),
            deviceData.manufacturer || null,
            deviceData.model || null,
            siteId,
            deviceData.status || 'active',
            JSON.stringify(deviceData.metadata || {}),
            'system',
            'system'
        ];

        const result = await this.db.query(query, values);
        return result.rows[0].id;
    }

    /**
     * Update existing device
     */
    async updateDevice(deviceId, deviceData, siteId) {
        const query = `
            UPDATE archiflow.network_devices
            SET
                name = $2,
                device_type = $3,
                manufacturer = $4,
                model = $5,
                site_id = $6,
                status = $7,
                metadata = $8,
                modified_by = $9,
                modified_at = NOW()
            WHERE id = $1
        `;

        const values = [
            deviceId,
            deviceData.name,
            this.normalizeDeviceType(deviceData.device_type),
            deviceData.manufacturer || null,
            deviceData.model || null,
            siteId,
            deviceData.status || 'active',
            JSON.stringify(deviceData.metadata || {}),
            'system'
        ];

        await this.db.query(query, values);
    }

    /**
     * Update device-diagram mapping
     */
    async updateDeviceDiagramMapping(deviceId, diagramId, deviceData) {
        // Check if mapping exists
        const existing = await this.db.query(
            'SELECT id FROM archiflow.device_diagram_mapping WHERE device_id = $1 AND diagram_id = $2',
            [deviceId, diagramId]
        );

        if (existing.rows.length > 0) {
            // Update existing mapping
            const query = `
                UPDATE archiflow.device_diagram_mapping
                SET
                    cell_id = $3,
                    x_position = $4,
                    y_position = $5,
                    width = $6,
                    height = $7,
                    style = $8,
                    modified_at = NOW()
                WHERE device_id = $1 AND diagram_id = $2
            `;

            await this.db.query(query, [
                deviceId,
                diagramId,
                deviceData.cell_id,
                deviceData.x_position,
                deviceData.y_position,
                deviceData.width,
                deviceData.height,
                deviceData.style
            ]);
        } else {
            // Create new mapping
            const query = `
                INSERT INTO archiflow.device_diagram_mapping (
                    id, device_id, diagram_id, cell_id,
                    x_position, y_position, width, height, style
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;

            await this.db.query(query, [
                uuidv4(),
                deviceId,
                diagramId,
                deviceData.cell_id,
                deviceData.x_position,
                deviceData.y_position,
                deviceData.width,
                deviceData.height,
                deviceData.style
            ]);
        }
    }

    /**
     * Update IP allocation to link to device
     */
    async updateIPAllocation(deviceId, deviceData) {
        console.log(`[DevicePersistence] updateIPAllocation called: deviceId=${deviceId}, ip=${deviceData.ip_address}, name=${deviceData.name}`);

        if (!deviceData.ip_address) {
            console.log(`[DevicePersistence] No IP address found in deviceData, skipping IP update`);
            return;
        }

        // Clean IP address (remove /24 suffix if present)
        let cleanIP = deviceData.ip_address;
        if (cleanIP.includes('/')) {
            cleanIP = cleanIP.split('/')[0];
        }

        console.log(`[DevicePersistence] Cleaned IP: ${cleanIP}`);

        // Update ip_addresses table to link IP to device
        // Match by IP address OR by device name if IP already allocated
        const query = `
            UPDATE archiflow.ip_addresses
            SET
                device_id = $1,
                device_name = $2,
                allocated_at = COALESCE(allocated_at, NOW())
            WHERE (
                host(ip_address) = $3
                OR (device_name = $2 AND device_id IS NULL)
            )
        `;

        const result = await this.db.query(query, [
            deviceId,
            deviceData.name,
            cleanIP
        ]);

        if (result.rowCount > 0) {
            console.log(`[DevicePersistence] Linked IP ${cleanIP} to device ${deviceData.name} (UUID: ${deviceId})`);
        } else {
            console.log(`[DevicePersistence] Could not link IP ${cleanIP} for device ${deviceData.name} - no matching IP found`);
        }
    }

    /**
     * Normalize device type to match database constraints
     */
    normalizeDeviceType(type) {
        if (!type) return 'server';

        const typeMap = {
            'switch': 'switch',
            'router': 'router',
            'firewall': 'firewall',
            'server': 'server',
            'load_balancer': 'load_balancer',
            'access_point': 'access_point',
            'workstation': 'workstation',
            'cloud': 'cloud',
            'internet': 'internet',
            'database': 'database',
            'storage': 'storage'
        };

        const normalized = type.toLowerCase().replace(/[-\s]/g, '_');
        return typeMap[normalized] || 'server';
    }

    /**
     * Remove devices that no longer exist in diagram
     */
    async cleanupOrphanedDevices(diagramId, currentDeviceCellIds) {
        try {
            // Find devices mapped to this diagram that are not in current list
            const query = `
                DELETE FROM archiflow.device_diagram_mapping
                WHERE diagram_id = $1
                AND cell_id NOT IN (${currentDeviceCellIds.map((_, i) => `$${i + 2}`).join(',')})
                RETURNING device_id
            `;

            const values = [diagramId, ...currentDeviceCellIds];
            const result = await this.db.query(query, values);

            if (result.rowCount > 0) {
                console.log(`[DevicePersistence] Cleaned up ${result.rowCount} orphaned device mappings`);
            }

            return result.rowCount;

        } catch (error) {
            console.error('[DevicePersistence] Error cleaning orphaned devices:', error);
            return 0;
        }
    }
}

module.exports = DevicePersistence;
