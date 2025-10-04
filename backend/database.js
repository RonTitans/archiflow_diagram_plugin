const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

class DatabaseManager {
    constructor() {
        this.dbMode = process.env.DB_MODE || 'mock';
        this.pool = null;

        if (this.dbMode === 'postgresql') {
            this.initPostgreSQL();
        } else {
            console.warn('[Database] Running in MOCK mode - data will not persist');
            this.mockData = new Map();
        }
    }

    initPostgreSQL() {
        console.log('[Database] Initializing PostgreSQL connection...');

        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'archiflow',
            user: process.env.DB_USER || 'archiflow_user',
            password: process.env.DB_PASSWORD || 'archiflow_pass',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test connection
        this.pool.query('SELECT NOW()', (err, res) => {
            if (err) {
                console.error('[Database] Connection failed:', err);
                process.exit(1);
            } else {
                console.log('[Database] Connected to PostgreSQL at', res.rows[0].now);
                // Set search path
                this.pool.query('SET search_path TO archiflow', (err) => {
                    if (err) {
                        console.error('[Database] Failed to set search path:', err);
                    } else {
                        console.log('[Database] Search path set to archiflow schema');
                    }
                });
            }
        });

        // Error handler
        this.pool.on('error', (err) => {
            console.error('[Database] Unexpected error:', err);
        });
    }

    async query(text, params) {
        if (this.dbMode === 'postgresql') {
            try {
                const result = await this.pool.query(text, params);
                return result;
            } catch (error) {
                console.error('[Database] Query error:', error);
                throw error;
            }
        } else {
            // Mock mode - simulate database behavior
            return this.mockQuery(text, params);
        }
    }

    async saveDiagram(data) {
        const {
            id = uuidv4(),
            siteId = 1,
            siteName = 'Default Site',
            title = 'Untitled Diagram',
            description = '',
            diagramData,
            status = 'draft',
            modifiedBy = 'system'
        } = data;

        if (this.dbMode === 'postgresql') {
            try {
                // Check if diagram exists
                const checkQuery = 'SELECT id FROM archiflow.diagrams WHERE id = $1';
                const checkResult = await this.query(checkQuery, [id]);

                if (checkResult.rows.length > 0) {
                    // Update existing diagram
                    const updateQuery = `
                        UPDATE archiflow.diagrams
                        SET site_id = $2,
                            site_name = $3,
                            title = $4,
                            description = $5,
                            diagram_data = $6,
                            status = $7,
                            modified_by = $8,
                            modified_at = NOW()
                        WHERE id = $1
                        RETURNING *
                    `;
                    const result = await this.query(updateQuery, [
                        id, siteId, siteName, title, description, diagramData, status, modifiedBy
                    ]);
                    console.log(`[Database] Updated diagram: ${id}`);
                    return result.rows[0];
                } else {
                    // Insert new diagram
                    const insertQuery = `
                        INSERT INTO archiflow.diagrams (
                            id, site_id, site_name, title, description,
                            diagram_data, status, created_by, modified_by
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
                        RETURNING *
                    `;
                    const result = await this.query(insertQuery, [
                        id, siteId, siteName, title, description, diagramData, status, modifiedBy
                    ]);
                    console.log(`[Database] Created new diagram: ${id}`);
                    return result.rows[0];
                }
            } catch (error) {
                console.error('[Database] Save diagram error:', error);
                throw error;
            }
        } else {
            // Mock mode
            const diagram = {
                id,
                site_id: siteId,
                site_name: siteName,
                title,
                description,
                diagram_data: diagramData,
                status,
                created_at: new Date(),
                modified_at: new Date()
            };
            this.mockData.set(id, diagram);
            console.log(`[Mock] Saved diagram: ${id}`);
            return diagram;
        }
    }

    async loadDiagram(diagramId) {
        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        if (this.dbMode === 'postgresql') {
            try {
                const query = `
                    SELECT id, site_id, site_name, title, description,
                           diagram_data, status, metadata, created_at, modified_at
                    FROM archiflow.diagrams
                    WHERE id = $1
                `;
                const result = await this.query(query, [diagramId]);

                if (result.rows.length > 0) {
                    const diagram = result.rows[0];
                    // Map diagram_data to both fields for compatibility
                    return {
                        ...diagram,
                        diagram_xml: diagram.diagram_data,
                        diagram_data: diagram.diagram_data
                    };
                }
                return null;
            } catch (error) {
                console.error('[Database] Load diagram error:', error);
                throw error;
            }
        } else {
            // Mock mode
            const diagram = this.mockData.get(diagramId);
            if (diagram) {
                return {
                    ...diagram,
                    diagram_xml: diagram.diagram_data,
                    diagram_data: diagram.diagram_data
                };
            }
            return null;
        }
    }

    async listDiagrams(filters = {}) {
        const { siteId, status = 'all', limit = 100, offset = 0 } = filters;

        if (this.dbMode === 'postgresql') {
            try {
                let query = `
                    SELECT id, site_id, site_name, title, description,
                           status, created_at, modified_at,
                           LENGTH(diagram_data) as size
                    FROM archiflow.diagrams
                    WHERE 1=1
                `;
                const params = [];
                let paramCount = 0;

                if (siteId) {
                    params.push(siteId);
                    query += ` AND site_id = $${++paramCount}`;
                }

                if (status !== 'all') {
                    params.push(status);
                    query += ` AND status = $${++paramCount}`;
                }

                query += ' ORDER BY modified_at DESC';

                params.push(limit);
                query += ` LIMIT $${++paramCount}`;

                params.push(offset);
                query += ` OFFSET $${++paramCount}`;

                const result = await this.query(query, params);
                return result.rows;
            } catch (error) {
                console.error('[Database] List diagrams error:', error);
                throw error;
            }
        } else {
            // Mock mode
            const diagrams = Array.from(this.mockData.values())
                .filter(d => !siteId || d.site_id === siteId)
                .filter(d => status === 'all' || d.status === status)
                .sort((a, b) => b.modified_at - a.modified_at)
                .slice(offset, offset + limit);
            return diagrams;
        }
    }

    async createVersion(data) {
        const { diagramId, versionType = 'manual', changeSummary = '', createdBy = 'system' } = data;

        if (this.dbMode === 'postgresql') {
            try {
                // Get current diagram data
                const diagram = await this.loadDiagram(diagramId);
                if (!diagram) {
                    throw new Error(`Diagram not found: ${diagramId}`);
                }

                // Get next version number
                const versionQuery = `
                    SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
                    FROM archiflow.diagram_versions
                    WHERE diagram_id = $1
                `;
                const versionResult = await this.query(versionQuery, [diagramId]);
                const nextVersion = versionResult.rows[0].next_version;

                // Create version
                const insertQuery = `
                    INSERT INTO archiflow.diagram_versions (
                        diagram_id, version_number, version_type,
                        diagram_xml, change_summary, created_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *
                `;
                const result = await this.query(insertQuery, [
                    diagramId, nextVersion, versionType,
                    diagram.diagram_data, changeSummary, createdBy
                ]);

                console.log(`[Database] Created version ${nextVersion} for diagram: ${diagramId}`);
                return result.rows[0];
            } catch (error) {
                console.error('[Database] Create version error:', error);
                throw error;
            }
        } else {
            // Mock mode - simple version tracking
            const version = {
                id: Date.now(),
                diagram_id: diagramId,
                version_number: 1,
                version_type: versionType,
                change_summary: changeSummary,
                created_at: new Date()
            };
            console.log(`[Mock] Created version for diagram: ${diagramId}`);
            return version;
        }
    }

    async getVersions(diagramId) {
        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        if (this.dbMode === 'postgresql') {
            try {
                const query = `
                    SELECT id, version_number, version_type,
                           change_summary, created_by, created_at
                    FROM archiflow.diagram_versions
                    WHERE diagram_id = $1
                    ORDER BY version_number DESC
                `;
                const result = await this.query(query, [diagramId]);
                return result.rows;
            } catch (error) {
                console.error('[Database] Get versions error:', error);
                throw error;
            }
        } else {
            // Mock mode
            return [];
        }
    }

    async deleteDiagram(diagramId) {
        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        if (this.dbMode === 'postgresql') {
            try {
                const query = 'DELETE FROM archiflow.diagrams WHERE id = $1 RETURNING id';
                const result = await this.query(query, [diagramId]);

                if (result.rows.length === 0) {
                    throw new Error(`Diagram not found: ${diagramId}`);
                }

                console.log(`[Database] Deleted diagram: ${diagramId}`);
                return true;
            } catch (error) {
                console.error('[Database] Delete diagram error:', error);
                throw error;
            }
        } else {
            // Mock mode
            if (this.mockData.has(diagramId)) {
                this.mockData.delete(diagramId);
                console.log(`[Mock] Deleted diagram: ${diagramId}`);
                return true;
            }
            throw new Error(`Diagram not found: ${diagramId}`);
        }
    }

    // Mock query simulator
    mockQuery(text, params) {
        return {
            rows: [],
            rowCount: 0
        };
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('[Database] Connection pool closed');
        }
    }
}

module.exports = DatabaseManager;