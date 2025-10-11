-- NetBox Cache Tables
-- These tables store cached data from NetBox for performance and offline access

-- Cache table for NetBox sites
CREATE TABLE IF NOT EXISTS archiflow.netbox_sites (
    id SERIAL PRIMARY KEY,
    netbox_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    description TEXT,
    facility VARCHAR(255),
    time_zone VARCHAR(255),
    physical_address TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    custom_fields JSONB,
    synced_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_netbox_site_id UNIQUE (netbox_id)
);

-- Cache table for NetBox device types
CREATE TABLE IF NOT EXISTS archiflow.netbox_device_types (
    id SERIAL PRIMARY KEY,
    netbox_id INTEGER NOT NULL UNIQUE,
    manufacturer_name VARCHAR(255) NOT NULL,
    manufacturer_slug VARCHAR(255),
    model VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    part_number VARCHAR(255),
    u_height DECIMAL(4,2),
    is_full_depth BOOLEAN DEFAULT true,
    description TEXT,
    front_image_url TEXT,
    rear_image_url TEXT,
    custom_fields JSONB,
    synced_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_netbox_device_type_id UNIQUE (netbox_id)
);

-- Cache table for NetBox IP prefixes (IP pools)
CREATE TABLE IF NOT EXISTS archiflow.netbox_prefixes (
    id SERIAL PRIMARY KEY,
    netbox_id INTEGER NOT NULL UNIQUE,
    prefix VARCHAR(50) NOT NULL,
    family INTEGER NOT NULL, -- 4 for IPv4, 6 for IPv6
    site_id INTEGER REFERENCES archiflow.netbox_sites(netbox_id),
    site_name VARCHAR(255),
    vlan_id INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    role_name VARCHAR(255),
    is_pool BOOLEAN DEFAULT false,
    description TEXT,
    custom_fields JSONB,
    synced_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_netbox_prefix_id UNIQUE (netbox_id)
);

-- Cache table for NetBox VLANs
CREATE TABLE IF NOT EXISTS archiflow.netbox_vlans (
    id SERIAL PRIMARY KEY,
    netbox_id INTEGER NOT NULL UNIQUE,
    vid INTEGER NOT NULL, -- VLAN ID number
    name VARCHAR(255) NOT NULL,
    site_id INTEGER REFERENCES archiflow.netbox_sites(netbox_id),
    site_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    role_name VARCHAR(255),
    description TEXT,
    custom_fields JSONB,
    synced_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_netbox_vlan_id UNIQUE (netbox_id)
);

-- Cache table for NetBox device roles
CREATE TABLE IF NOT EXISTS archiflow.netbox_device_roles (
    id SERIAL PRIMARY KEY,
    netbox_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    color VARCHAR(6),
    vm_role BOOLEAN DEFAULT false,
    description TEXT,
    custom_fields JSONB,
    synced_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_netbox_device_role_id UNIQUE (netbox_id)
);

-- Table to track sync status
CREATE TABLE IF NOT EXISTS archiflow.netbox_sync_status (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'sites', 'device_types', 'prefixes', 'vlans', 'device_roles'
    last_sync_at TIMESTAMP DEFAULT NOW(),
    sync_status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'in_progress'
    sync_message TEXT,
    records_synced INTEGER DEFAULT 0,
    CONSTRAINT unique_entity_type UNIQUE (entity_type)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_netbox_sites_slug ON archiflow.netbox_sites(slug);
CREATE INDEX IF NOT EXISTS idx_netbox_device_types_slug ON archiflow.netbox_device_types(slug);
CREATE INDEX IF NOT EXISTS idx_netbox_prefixes_site_id ON archiflow.netbox_prefixes(site_id);
CREATE INDEX IF NOT EXISTS idx_netbox_vlans_vid ON archiflow.netbox_vlans(vid);
CREATE INDEX IF NOT EXISTS idx_netbox_vlans_site_id ON archiflow.netbox_vlans(site_id);
CREATE INDEX IF NOT EXISTS idx_netbox_device_roles_slug ON archiflow.netbox_device_roles(slug);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA archiflow TO archiflow_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_user;
