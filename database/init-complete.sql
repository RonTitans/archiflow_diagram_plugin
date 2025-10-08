-- ArchiFlow Complete Database Initialization
-- This file consolidates all schema definitions in the correct order
-- for automatic deployment via Docker

-- =====================================================
-- PART 1: Base Schema (diagrams, versions, sites)
-- =====================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS archiflow;

-- Set search path
SET search_path TO archiflow;

-- Main diagrams table (stores actual diagram data)
CREATE TABLE IF NOT EXISTS archiflow.diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id INTEGER NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_data TEXT NOT NULL,  -- The actual Draw.io XML
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft', -- draft, live, archived
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    modified_by VARCHAR(100) DEFAULT 'system'
);

-- Version history table (for versioning support)
CREATE TABLE IF NOT EXISTS archiflow.diagram_versions (
    id SERIAL PRIMARY KEY,
    diagram_id UUID REFERENCES archiflow.diagrams(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type VARCHAR(50) DEFAULT 'manual', -- manual, autosave, publish
    diagram_xml TEXT NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    UNIQUE(diagram_id, version_number)
);

-- Sites table (for site management)
CREATE TABLE IF NOT EXISTS archiflow.sites (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) UNIQUE,
    site_code VARCHAR(10),  -- Added for auto-naming
    status VARCHAR(50) DEFAULT 'active',
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_diagrams_site_id ON archiflow.diagrams(site_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_status ON archiflow.diagrams(status);
CREATE INDEX IF NOT EXISTS idx_diagrams_created_at ON archiflow.diagrams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagram_versions_diagram_id ON archiflow.diagram_versions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_versions_created_at ON archiflow.diagram_versions(created_at DESC);

-- Function to automatically update modified_at timestamp
CREATE OR REPLACE FUNCTION archiflow.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update modified_at on diagrams table
CREATE TRIGGER update_diagrams_modified_at
    BEFORE UPDATE ON archiflow.diagrams
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

-- Trigger to update modified_at on sites table
CREATE TRIGGER update_sites_modified_at
    BEFORE UPDATE ON archiflow.sites
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

-- Function to create a new version when diagram is updated
CREATE OR REPLACE FUNCTION archiflow.create_diagram_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    -- Only create version if diagram_data actually changed
    IF OLD.diagram_data IS DISTINCT FROM NEW.diagram_data THEN
        -- Get next version number
        SELECT COALESCE(MAX(version_number), 0) + 1
        INTO next_version
        FROM archiflow.diagram_versions
        WHERE diagram_id = NEW.id;

        -- Insert new version
        INSERT INTO archiflow.diagram_versions (
            diagram_id,
            version_number,
            version_type,
            diagram_xml,
            change_summary,
            created_by
        )
        VALUES (
            NEW.id,
            next_version,
            CASE WHEN NEW.status = 'live' THEN 'publish' ELSE 'manual' END,
            OLD.diagram_data,  -- Save the OLD version
            COALESCE(NEW.description, 'Version ' || next_version),
            COALESCE(NEW.modified_by, 'system')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create version on diagram update
CREATE TRIGGER create_version_on_diagram_update
    BEFORE UPDATE ON archiflow.diagrams
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.create_diagram_version();

-- =====================================================
-- PART 2: Network Device Schema
-- =====================================================

-- Network Devices Table
CREATE TABLE IF NOT EXISTS archiflow.network_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN (
        'router', 'switch', 'firewall', 'server',
        'load_balancer', 'access_point', 'workstation',
        'cloud', 'internet', 'database', 'storage'
    )),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(255) UNIQUE,
    asset_id VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
    location VARCHAR(255),
    rack_position VARCHAR(50),
    site_id INTEGER REFERENCES archiflow.sites(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    modified_by VARCHAR(100) DEFAULT 'system'
);

-- IP Allocations Table
CREATE TABLE IF NOT EXISTS archiflow.ip_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    subnet CIDR,
    vlan_id INTEGER,
    interface_name VARCHAR(50),
    mac_address MACADDR,
    is_primary BOOLEAN DEFAULT false,
    allocation_type VARCHAR(50) DEFAULT 'static' CHECK (allocation_type IN ('static', 'dhcp', 'reserved')),
    dns_servers INET[],
    gateway INET,
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ip_address, vlan_id)
);

-- Port Connections Table
CREATE TABLE IF NOT EXISTS archiflow.port_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    source_port VARCHAR(50) NOT NULL,
    target_device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    target_port VARCHAR(50) NOT NULL,
    connection_type VARCHAR(50) DEFAULT 'ethernet' CHECK (connection_type IN (
        'ethernet', 'fiber', 'wireless', 'vpn', 'internet', 'serial', 'console'
    )),
    bandwidth VARCHAR(20),
    duplex VARCHAR(20) CHECK (duplex IN ('full', 'half', 'auto')),
    vlan_ids INTEGER[],
    is_trunk BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_device_id, source_port),
    UNIQUE(target_device_id, target_port),
    CHECK (source_device_id != target_device_id)
);

-- Device Templates Table
CREATE TABLE IF NOT EXISTS archiflow.device_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    device_type VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    default_ports INTEGER DEFAULT 24,
    port_naming_pattern VARCHAR(100),
    icon_style TEXT,
    default_width INTEGER DEFAULT 80,
    default_height INTEGER DEFAULT 60,
    category VARCHAR(50) DEFAULT 'network' CHECK (category IN ('network', 'compute', 'security', 'infrastructure')),
    image_url VARCHAR(500),  -- Added for device images
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- IP Pools Table
CREATE TABLE IF NOT EXISTS archiflow.ip_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    network CIDR NOT NULL UNIQUE,
    gateway INET,
    dns_servers INET[],
    vlan_id INTEGER,
    site_id INTEGER REFERENCES archiflow.sites(id),
    pool_type VARCHAR(50) DEFAULT 'dynamic' CHECK (pool_type IN ('static', 'dynamic', 'reserved')),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW()
);

-- VLANs Table
CREATE TABLE IF NOT EXISTS archiflow.vlans (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    site_id INTEGER REFERENCES archiflow.sites(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW()
);

-- Device Diagram Mapping Table
CREATE TABLE IF NOT EXISTS archiflow.device_diagram_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    diagram_id UUID REFERENCES archiflow.diagrams(id) ON DELETE CASCADE,
    cell_id VARCHAR(255) NOT NULL,
    x_position NUMERIC,
    y_position NUMERIC,
    width NUMERIC,
    height NUMERIC,
    style TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, diagram_id)
);

-- IP Addresses Table (for IP allocation tracking)
CREATE TABLE IF NOT EXISTS archiflow.ip_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES archiflow.ip_pools(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    is_gateway BOOLEAN DEFAULT false,
    is_reserved BOOLEAN DEFAULT false,
    device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE SET NULL,
    device_name VARCHAR(255),
    allocated_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pool_id, ip_address)
);

-- Device Counters Table (for auto-naming)
CREATE TABLE IF NOT EXISTS archiflow.device_counters (
    site_id INTEGER,
    device_type VARCHAR(50),
    prefix VARCHAR(10),
    last_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (site_id, device_type, prefix)
);

-- Schema Migrations Table (for version tracking)
CREATE TABLE IF NOT EXISTS archiflow.schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_network_devices_type ON archiflow.network_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_network_devices_status ON archiflow.network_devices(status);
CREATE INDEX IF NOT EXISTS idx_network_devices_site ON archiflow.network_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_network_devices_asset ON archiflow.network_devices(asset_id);

CREATE INDEX IF NOT EXISTS idx_ip_allocations_device ON archiflow.ip_allocations(device_id);
CREATE INDEX IF NOT EXISTS idx_ip_allocations_ip ON archiflow.ip_allocations(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_allocations_vlan ON archiflow.ip_allocations(vlan_id);

CREATE INDEX IF NOT EXISTS idx_port_connections_source ON archiflow.port_connections(source_device_id);
CREATE INDEX IF NOT EXISTS idx_port_connections_target ON archiflow.port_connections(target_device_id);

CREATE INDEX IF NOT EXISTS idx_device_diagram_device ON archiflow.device_diagram_mapping(device_id);
CREATE INDEX IF NOT EXISTS idx_device_diagram_diagram ON archiflow.device_diagram_mapping(diagram_id);

CREATE INDEX IF NOT EXISTS idx_ip_addresses_pool_id ON archiflow.ip_addresses(pool_id);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_device_id ON archiflow.ip_addresses(device_id);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_ip ON archiflow.ip_addresses(ip_address);

-- =====================================================
-- Triggers
-- =====================================================
CREATE TRIGGER update_network_devices_modified_at
    BEFORE UPDATE ON archiflow.network_devices
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

CREATE TRIGGER update_ip_allocations_modified_at
    BEFORE UPDATE ON archiflow.ip_allocations
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

CREATE TRIGGER update_port_connections_modified_at
    BEFORE UPDATE ON archiflow.port_connections
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

-- =====================================================
-- Functions for IP Management
-- =====================================================

-- Function to populate IP addresses for a pool
CREATE OR REPLACE FUNCTION archiflow.populate_pool_ips(p_pool_id UUID)
RETURNS void AS $$
DECLARE
    v_pool RECORD;
    v_network INET;
    v_broadcast INET;
    v_current_ip INET;
    v_gateway_ip INET;
BEGIN
    -- Get pool details
    SELECT * INTO v_pool FROM archiflow.ip_pools WHERE id = p_pool_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pool not found';
    END IF;

    -- Calculate network range
    v_network := network(v_pool.network);
    v_broadcast := broadcast(v_pool.network);
    v_gateway_ip := v_pool.gateway;

    -- Start from first usable IP
    v_current_ip := v_network + 1;

    -- Loop through all IPs in the range
    WHILE v_current_ip < v_broadcast LOOP
        INSERT INTO archiflow.ip_addresses (
            pool_id,
            ip_address,
            is_gateway,
            is_reserved
        ) VALUES (
            p_pool_id,
            v_current_ip,
            v_current_ip = v_gateway_ip,
            v_current_ip = v_gateway_ip OR v_current_ip = v_network OR v_current_ip = v_broadcast
        ) ON CONFLICT (pool_id, ip_address) DO NOTHING;

        v_current_ip := v_current_ip + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get next device number
CREATE OR REPLACE FUNCTION archiflow.get_next_device_number(
    p_site_id INTEGER,
    p_device_type VARCHAR,
    p_prefix VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
BEGIN
    INSERT INTO archiflow.device_counters (site_id, device_type, prefix, last_number)
    VALUES (p_site_id, p_device_type, p_prefix, 1)
    ON CONFLICT (site_id, device_type, prefix)
    DO UPDATE SET last_number = device_counters.last_number + 1
    RETURNING last_number INTO v_next_number;

    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup orphaned IPs
CREATE OR REPLACE FUNCTION archiflow.cleanup_orphaned_ips()
RETURNS INTEGER AS $$
DECLARE
    released_count INTEGER;
BEGIN
    WITH released AS (
        UPDATE archiflow.ip_addresses
        SET
            device_id = NULL,
            device_name = NULL,
            allocated_at = NULL
        WHERE
            device_name IS NOT NULL
            AND (
                device_id IS NULL
                OR device_id NOT IN (
                    SELECT id FROM archiflow.network_devices
                )
            )
        RETURNING 1
    )
    SELECT COUNT(*) INTO released_count FROM released;

    RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get next available IP from pool
CREATE OR REPLACE FUNCTION archiflow.get_next_available_ip(pool_id UUID)
RETURNS INET AS $$
DECLARE
    pool_network CIDR;
    pool_gateway INET;
    next_ip INET;
    ip INET;
BEGIN
    -- Get pool details
    SELECT network, gateway INTO pool_network, pool_gateway
    FROM archiflow.ip_pools
    WHERE id = pool_id;

    IF pool_network IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find first available IP (skip network, broadcast, and gateway)
    FOR ip IN
        SELECT generate_series(
            (pool_network::inet + 1)::inet,
            (broadcast(pool_network)::inet - 1)::inet,
            1
        )::inet
    LOOP
        -- Skip gateway IP
        IF ip = pool_gateway THEN
            CONTINUE;
        END IF;

        -- Check if IP is not allocated
        IF NOT EXISTS (
            SELECT 1 FROM archiflow.ip_allocations
            WHERE ip_address = ip
        ) THEN
            RETURN ip;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check port availability
CREATE OR REPLACE FUNCTION archiflow.is_port_available(
    device_id UUID,
    port_name VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM archiflow.port_connections
        WHERE (source_device_id = device_id AND source_port = port_name)
           OR (target_device_id = device_id AND target_port = port_name)
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Sample Data
-- =====================================================

-- Insert sample sites
INSERT INTO archiflow.sites (id, name, slug, site_code, status, description)
VALUES
    (1, 'Main Data Center', 'main-dc', 'MAIN', 'active', 'Primary data center location'),
    (2, 'Backup Site', 'backup-site', 'BACKUP', 'active', 'Disaster recovery site'),
    (3, 'Cloud Region US-East', 'cloud-us-east', 'CLOUD', 'active', 'AWS US-East-1 region')
ON CONFLICT (id) DO UPDATE SET site_code = EXCLUDED.site_code;

-- Insert Device Templates
INSERT INTO archiflow.device_templates (name, device_type, manufacturer, model, default_ports, port_naming_pattern, icon_style, default_width, default_height, category, image_url)
VALUES
    ('Cisco Router', 'router', 'Cisco', 'ISR4000', 4, 'GigabitEthernet0/{n}', 'shape=mxgraph.cisco.routers.router;fillColor=#0066CC;strokeColor=#001847;', 80, 80, 'network', NULL),
    ('Cisco Catalyst Switch', 'switch', 'Cisco', 'Catalyst', 48, 'GigabitEthernet1/0/{n}', 'shape=mxgraph.cisco.switches.layer_2_switch;fillColor=#FFB366;strokeColor=#6D4C13;', 100, 60, 'network', NULL),
    ('Cisco C9200-24P', 'switch', 'Cisco', 'C9200-24P', 24, 'GigabitEthernet1/0/{port}', NULL, 340, 35, 'network', '/images/devices/cisco-c9200-24p-real.svg'),
    ('Fortinet Firewall', 'firewall', 'Fortinet', 'FortiGate', 8, 'port{n}', 'shape=mxgraph.cisco.security.firewall;fillColor=#FF6666;strokeColor=#660000;', 80, 80, 'security', NULL),
    ('Dell Server', 'server', 'Dell', 'PowerEdge', 4, 'eth{n}', 'shape=mxgraph.cisco.servers.standard_host;fillColor=#66FF66;strokeColor=#006600;', 60, 80, 'compute', NULL),
    ('F5 Load Balancer', 'load_balancer', 'F5', 'BIG-IP', 8, '1.{n}', 'shape=mxgraph.cisco.misc.load_balancer;fillColor=#99CCFF;strokeColor=#003366;', 80, 60, 'network', NULL),
    ('Cisco Access Point', 'access_point', 'Cisco', 'Aironet', 1, 'eth0', 'shape=mxgraph.cisco.wireless.access_point;fillColor=#CCFFCC;strokeColor=#339933;', 60, 60, 'network', NULL),
    ('Workstation', 'workstation', 'Generic', 'Desktop', 1, 'eth0', 'shape=mxgraph.cisco.computers_and_peripherals.pc;fillColor=#E6E6E6;strokeColor=#666666;', 60, 60, 'compute', NULL),
    ('Cloud Service', 'cloud', 'AWS', 'EC2', 0, '', 'shape=cloud;fillColor=#F0F0F0;strokeColor=#666666;', 120, 80, 'infrastructure', NULL),
    ('Internet Gateway', 'internet', 'Generic', 'Gateway', 1, 'wan0', 'shape=mxgraph.cisco.storage.cloud;fillColor=#CCCCFF;strokeColor=#6666FF;', 100, 60, 'infrastructure', NULL),
    ('PostgreSQL Database', 'database', 'PostgreSQL', 'PostgreSQL', 1, 'eth0', 'shape=cylinder3;fillColor=#FFE6CC;strokeColor=#D79B00;', 60, 80, 'compute', NULL)
ON CONFLICT (name) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    default_width = EXCLUDED.default_width,
    default_height = EXCLUDED.default_height;

-- Insert Sample VLANs
INSERT INTO archiflow.vlans (id, name, description, site_id)
VALUES
    (1, 'Default', 'Default VLAN', 1),
    (10, 'Management', 'Management Network', 1),
    (20, 'Production', 'Production Servers', 1),
    (30, 'Development', 'Development Environment', 1),
    (40, 'DMZ', 'Demilitarized Zone', 1),
    (50, 'Guest', 'Guest Network', 1),
    (100, 'Storage', 'Storage Network', 1)
ON CONFLICT (id) DO NOTHING;

-- Insert Sample IP Pools
INSERT INTO archiflow.ip_pools (name, network, gateway, vlan_id, site_id, pool_type, description)
VALUES
    ('Management Network', '192.168.1.0/24', '192.168.1.1', 10, 1, 'static', 'Management network pool'),
    ('Production Servers', '10.10.20.0/24', '10.10.20.1', 20, 1, 'static', 'Production server pool'),
    ('Development Network', '10.10.30.0/24', '10.10.30.1', 30, 1, 'dynamic', 'Development environment pool'),
    ('DMZ Network', '172.16.40.0/24', '172.16.40.1', 40, 1, 'static', 'DMZ network pool'),
    ('Guest Network', '192.168.50.0/24', '192.168.50.1', 50, 1, 'dynamic', 'Guest WiFi pool')
ON CONFLICT (network) DO NOTHING;

-- Populate IPs for all existing pools
DO $$
DECLARE
    v_pool RECORD;
BEGIN
    FOR v_pool IN SELECT id FROM archiflow.ip_pools LOOP
        PERFORM archiflow.populate_pool_ips(v_pool.id);
    END LOOP;
END;
$$;

-- Create a sample diagram
INSERT INTO archiflow.diagrams (
    site_id,
    site_name,
    title,
    description,
    diagram_data,
    status,
    created_by
)
VALUES (
    1,
    'Main Data Center',
    'Sample Network Topology',
    'Initial network diagram for testing',
    '<mxfile><diagram id="sample" name="Network">
        <mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169">
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
            </root>
        </mxGraphModel>
    </diagram></mxfile>',
    'draft',
    'system'
)
ON CONFLICT DO NOTHING;

-- Record initial migration
INSERT INTO archiflow.schema_migrations (version, name)
VALUES (1, '001_complete_initial_schema')
ON CONFLICT (version) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA archiflow TO archiflow_user;
