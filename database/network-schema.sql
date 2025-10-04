-- ArchiFlow Network Devices Schema Extension
-- Adds network device management capabilities to the ArchiFlow plugin

-- Ensure we're using the archiflow schema
SET search_path TO archiflow;

-- =====================================================
-- Network Devices Table
-- =====================================================
-- Stores information about network devices (routers, switches, firewalls, etc.)
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
    metadata JSONB DEFAULT '{}', -- Additional custom properties
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    modified_by VARCHAR(100) DEFAULT 'system'
);

-- =====================================================
-- IP Allocations Table
-- =====================================================
-- Manages IP address assignments to devices
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
    UNIQUE(ip_address, vlan_id) -- Prevent duplicate IP in same VLAN
);

-- =====================================================
-- Port Connections Table
-- =====================================================
-- Tracks physical and logical connections between devices
CREATE TABLE IF NOT EXISTS archiflow.port_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    source_port VARCHAR(50) NOT NULL,
    target_device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    target_port VARCHAR(50) NOT NULL,
    connection_type VARCHAR(50) DEFAULT 'ethernet' CHECK (connection_type IN (
        'ethernet', 'fiber', 'wireless', 'vpn', 'internet', 'serial', 'console'
    )),
    bandwidth VARCHAR(20), -- e.g., '1G', '10G', '40G'
    duplex VARCHAR(20) CHECK (duplex IN ('full', 'half', 'auto')),
    vlan_ids INTEGER[],
    is_trunk BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_device_id, source_port),
    UNIQUE(target_device_id, target_port),
    CHECK (source_device_id != target_device_id) -- Prevent self-connections
);

-- =====================================================
-- Device Templates Table
-- =====================================================
-- Pre-defined templates for common network devices
CREATE TABLE IF NOT EXISTS archiflow.device_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    device_type VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    default_ports INTEGER DEFAULT 24,
    port_naming_pattern VARCHAR(100), -- e.g., 'GigabitEthernet0/{n}'
    icon_style TEXT, -- Draw.io style string
    default_width INTEGER DEFAULT 80,
    default_height INTEGER DEFAULT 60,
    category VARCHAR(50) DEFAULT 'network' CHECK (category IN ('network', 'compute', 'security', 'infrastructure')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- IP Pools Table
-- =====================================================
-- Define IP address pools for allocation
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

-- =====================================================
-- VLANs Table
-- =====================================================
-- VLAN definitions
CREATE TABLE IF NOT EXISTS archiflow.vlans (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    site_id INTEGER REFERENCES archiflow.sites(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Device Diagram Mapping Table
-- =====================================================
-- Maps devices to their representation in diagrams
CREATE TABLE IF NOT EXISTS archiflow.device_diagram_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES archiflow.network_devices(id) ON DELETE CASCADE,
    diagram_id UUID REFERENCES archiflow.diagrams(id) ON DELETE CASCADE,
    cell_id VARCHAR(255) NOT NULL, -- Draw.io cell ID
    x_position NUMERIC,
    y_position NUMERIC,
    width NUMERIC,
    height NUMERIC,
    style TEXT, -- Draw.io style string
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, diagram_id)
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

-- =====================================================
-- Triggers
-- =====================================================

-- Update modified_at timestamp for network_devices
CREATE TRIGGER update_network_devices_modified_at
    BEFORE UPDATE ON archiflow.network_devices
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

-- Update modified_at timestamp for ip_allocations
CREATE TRIGGER update_ip_allocations_modified_at
    BEFORE UPDATE ON archiflow.ip_allocations
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

-- Update modified_at timestamp for port_connections
CREATE TRIGGER update_port_connections_modified_at
    BEFORE UPDATE ON archiflow.port_connections
    FOR EACH ROW
    EXECUTE FUNCTION archiflow.update_modified_column();

-- =====================================================
-- Functions
-- =====================================================

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

    RETURN NULL; -- No available IPs
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
-- Insert Default Device Templates
-- =====================================================
INSERT INTO archiflow.device_templates (name, device_type, manufacturer, default_ports, port_naming_pattern, icon_style, default_width, default_height, category)
VALUES
    ('Cisco Router', 'router', 'Cisco', 4, 'GigabitEthernet0/{n}', 'shape=mxgraph.cisco.routers.router;fillColor=#0066CC;strokeColor=#001847;', 80, 80, 'network'),
    ('Cisco Catalyst Switch', 'switch', 'Cisco', 48, 'GigabitEthernet1/0/{n}', 'shape=mxgraph.cisco.switches.layer_2_switch;fillColor=#FFB366;strokeColor=#6D4C13;', 100, 60, 'network'),
    ('Fortinet Firewall', 'firewall', 'Fortinet', 8, 'port{n}', 'shape=mxgraph.cisco.security.firewall;fillColor=#FF6666;strokeColor=#660000;', 80, 80, 'security'),
    ('Dell Server', 'server', 'Dell', 4, 'eth{n}', 'shape=mxgraph.cisco.servers.standard_host;fillColor=#66FF66;strokeColor=#006600;', 60, 80, 'compute'),
    ('F5 Load Balancer', 'load_balancer', 'F5', 8, '1.{n}', 'shape=mxgraph.cisco.misc.load_balancer;fillColor=#99CCFF;strokeColor=#003366;', 80, 60, 'network'),
    ('Cisco Access Point', 'access_point', 'Cisco', 1, 'eth0', 'shape=mxgraph.cisco.wireless.access_point;fillColor=#CCFFCC;strokeColor=#339933;', 60, 60, 'network'),
    ('Workstation', 'workstation', 'Generic', 1, 'eth0', 'shape=mxgraph.cisco.computers_and_peripherals.pc;fillColor=#E6E6E6;strokeColor=#666666;', 60, 60, 'compute'),
    ('Cloud Service', 'cloud', 'AWS', 0, '', 'shape=cloud;fillColor=#F0F0F0;strokeColor=#666666;', 120, 80, 'infrastructure'),
    ('Internet Gateway', 'internet', 'Generic', 1, 'wan0', 'shape=mxgraph.cisco.storage.cloud;fillColor=#CCCCFF;strokeColor=#6666FF;', 100, 60, 'infrastructure'),
    ('PostgreSQL Database', 'database', 'PostgreSQL', 1, 'eth0', 'shape=cylinder3;fillColor=#FFE6CC;strokeColor=#D79B00;', 60, 80, 'compute')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Insert Sample VLANs
-- =====================================================
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

-- =====================================================
-- Insert Sample IP Pools
-- =====================================================
INSERT INTO archiflow.ip_pools (name, network, gateway, vlan_id, site_id, pool_type, description)
VALUES
    ('Management Network', '192.168.1.0/24', '192.168.1.1', 10, 1, 'static', 'Management network pool'),
    ('Production Servers', '10.10.20.0/24', '10.10.20.1', 20, 1, 'static', 'Production server pool'),
    ('Development Network', '10.10.30.0/24', '10.10.30.1', 30, 1, 'dynamic', 'Development environment pool'),
    ('DMZ Network', '172.16.40.0/24', '172.16.40.1', 40, 1, 'static', 'DMZ network pool'),
    ('Guest Network', '192.168.50.0/24', '192.168.50.1', 50, 1, 'dynamic', 'Guest WiFi pool')
ON CONFLICT (network) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA archiflow TO archiflow_user;