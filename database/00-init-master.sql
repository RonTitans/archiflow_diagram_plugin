-- ============================================================================
-- ArchiFlow Database Master Initialization Script
-- ============================================================================
-- This script initializes the complete ArchiFlow database from scratch
-- Run this on a fresh PostgreSQL installation for automated deployment
-- ============================================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS archiflow;

-- Set search path
SET search_path TO archiflow, public;

-- Grant permissions
GRANT ALL ON SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_user;

-- ============================================================================
-- 1. Core Schema (Diagrams, Sites, Versions)
-- ============================================================================
\echo 'Creating core schema...'

-- Diagrams table
CREATE TABLE IF NOT EXISTS archiflow.diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id INTEGER,
    site_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_data TEXT,
    deployment_status VARCHAR(50) DEFAULT 'draft',
    deployed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    modified_by VARCHAR(100) DEFAULT 'system'
);

-- Diagram versions
CREATE TABLE IF NOT EXISTS archiflow.diagram_versions (
    id SERIAL PRIMARY KEY,
    diagram_id UUID REFERENCES archiflow.diagrams(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    diagram_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    notes TEXT
);

-- Sites
CREATE TABLE IF NOT EXISTS archiflow.sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    site_code VARCHAR(10),
    description TEXT,
    location TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. Network Device Schema
-- ============================================================================
\echo 'Creating network device schema...'

-- Device templates
CREATE TABLE IF NOT EXISTS archiflow.device_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    image_path VARCHAR(500),
    default_image VARCHAR(500),
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Network devices
CREATE TABLE IF NOT EXISTS archiflow.network_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255),
    asset_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    location TEXT,
    rack_position VARCHAR(50),
    site_id INTEGER REFERENCES archiflow.sites(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    modified_by VARCHAR(100)
);

-- Device-diagram mapping
CREATE TABLE IF NOT EXISTS archiflow.device_diagram_mapping (
    id SERIAL PRIMARY KEY,
    device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    diagram_id UUID REFERENCES archiflow.diagrams(id) ON DELETE CASCADE,
    cell_id VARCHAR(255),
    x_position DECIMAL(10,2),
    y_position DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    style TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, diagram_id)
);

-- IP addresses
CREATE TABLE IF NOT EXISTS archiflow.ip_addresses (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL,
    ip_address INET NOT NULL,
    subnet VARCHAR(50) NOT NULL,
    device_name VARCHAR(255),
    allocated_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ip_address)
);

-- IP allocations
CREATE TABLE IF NOT EXISTS archiflow.ip_allocations (
    id SERIAL PRIMARY KEY,
    device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    subnet VARCHAR(50) NOT NULL,
    vlan_id INTEGER,
    interface_name VARCHAR(100) DEFAULT 'Management',
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ip_address)
);

-- VLANs
CREATE TABLE IF NOT EXISTS archiflow.vlans (
    id SERIAL PRIMARY KEY,
    vid INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    site_id INTEGER REFERENCES archiflow.sites(id),
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- IP pools
CREATE TABLE IF NOT EXISTS archiflow.ip_pools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL,
    gateway VARCHAR(50),
    vlan_id INTEGER REFERENCES archiflow.vlans(id),
    site_id INTEGER REFERENCES archiflow.sites(id),
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. NetBox Integration Schema
-- ============================================================================
\echo 'Creating NetBox cache tables...'

\i netbox-cache-schema.sql
\i netbox-devices-ips-cache.sql

-- ============================================================================
-- 4. Indexes for Performance
-- ============================================================================
\echo 'Creating indexes...'

CREATE INDEX IF NOT EXISTS idx_diagrams_site_id ON archiflow.diagrams(site_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_status ON archiflow.diagrams(status);
CREATE INDEX IF NOT EXISTS idx_diagrams_deployment_status ON archiflow.diagrams(deployment_status);
CREATE INDEX IF NOT EXISTS idx_diagram_versions_diagram_id ON archiflow.diagram_versions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_network_devices_site_id ON archiflow.network_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_network_devices_name ON archiflow.network_devices(name);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_device_name ON archiflow.ip_addresses(device_name);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_pool_id ON archiflow.ip_addresses(pool_id);
CREATE INDEX IF NOT EXISTS idx_ip_allocations_device_id ON archiflow.ip_allocations(device_id);

-- ============================================================================
-- 5. Default Data
-- ============================================================================
\echo 'Inserting default data...'

-- Default site
INSERT INTO archiflow.sites (id, name, slug, site_code, description, status)
VALUES (1, 'Main Office', 'main-office', 'MAIN', 'Primary office location', 'active')
ON CONFLICT (name) DO NOTHING;

-- Default device templates
INSERT INTO archiflow.device_templates (name, device_type, manufacturer, model, category, default_image)
VALUES
    ('Cisco Catalyst 9300', 'switch', 'Cisco', 'Catalyst 9300', 'network', '/images/devices/cisco-catalyst-9300.svg'),
    ('Cisco ISR 4000', 'router', 'Cisco', 'ISR 4000', 'network', '/images/devices/cisco-router.svg')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. Permissions
-- ============================================================================
\echo 'Granting permissions...'

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA archiflow TO archiflow_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA archiflow TO archiflow_user;

\echo 'Database initialization complete!'
