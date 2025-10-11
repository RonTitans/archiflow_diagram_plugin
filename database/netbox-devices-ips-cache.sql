-- NetBox Devices and IP Addresses Cache Tables
-- These tables store synced devices and IPs from NetBox for real-time availability checking

-- Cache table for NetBox devices (for name checking)
CREATE TABLE IF NOT EXISTS archiflow.netbox_devices (
    id SERIAL PRIMARY KEY,
    netbox_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    device_type_name VARCHAR(255),
    device_role_name VARCHAR(255),
    site_id INTEGER,
    site_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    primary_ip4 VARCHAR(50),
    primary_ip6 VARCHAR(100),
    serial VARCHAR(255),
    asset_tag VARCHAR(255),
    platform_name VARCHAR(255),
    rack_name VARCHAR(255),
    position DECIMAL(5,2),
    custom_fields JSONB,
    synced_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_netbox_device_id UNIQUE (netbox_id)
);

-- Cache table for NetBox IP addresses (for allocation checking)
CREATE TABLE IF NOT EXISTS archiflow.netbox_ip_addresses (
    id SERIAL PRIMARY KEY,
    netbox_id INTEGER NOT NULL UNIQUE,
    address VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    assigned_object_type VARCHAR(100),
    assigned_object_id INTEGER,
    device_name VARCHAR(255),
    interface_name VARCHAR(255),
    dns_name VARCHAR(255),
    description TEXT,
    custom_fields JSONB,
    synced_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_netbox_ip_id UNIQUE (netbox_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_netbox_devices_name ON archiflow.netbox_devices(name);
CREATE INDEX IF NOT EXISTS idx_netbox_devices_site_id ON archiflow.netbox_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_netbox_devices_status ON archiflow.netbox_devices(status);

CREATE INDEX IF NOT EXISTS idx_netbox_ip_addresses_address ON archiflow.netbox_ip_addresses(address);
CREATE INDEX IF NOT EXISTS idx_netbox_ip_addresses_device_name ON archiflow.netbox_ip_addresses(device_name);
CREATE INDEX IF NOT EXISTS idx_netbox_ip_addresses_status ON archiflow.netbox_ip_addresses(status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON archiflow.netbox_devices TO archiflow_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON archiflow.netbox_ip_addresses TO archiflow_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_user;

-- Create function to get next device counter from NetBox cache
CREATE OR REPLACE FUNCTION archiflow.get_next_device_counter(
    p_prefix VARCHAR,
    p_site_code VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_max_number INTEGER := 0;
    v_pattern VARCHAR;
    v_device_name VARCHAR;
    v_number INTEGER;
BEGIN
    v_pattern := p_prefix || '-' || p_site_code || '-%';

    -- Check NetBox devices cache
    FOR v_device_name IN
        SELECT name FROM archiflow.netbox_devices
        WHERE name LIKE v_pattern
    LOOP
        -- Extract number from device name (e.g., SW-MAIN-03 -> 3)
        v_number := NULLIF(regexp_replace(v_device_name, '^.*-(\d+)$', '\1'), '')::INTEGER;
        IF v_number IS NOT NULL AND v_number > v_max_number THEN
            v_max_number := v_number;
        END IF;
    END LOOP;

    -- Also check local network_devices table
    FOR v_device_name IN
        SELECT name FROM archiflow.network_devices
        WHERE name LIKE v_pattern
    LOOP
        v_number := NULLIF(regexp_replace(v_device_name, '^.*-(\d+)$', '\1'), '')::INTEGER;
        IF v_number IS NOT NULL AND v_number > v_max_number THEN
            v_max_number := v_number;
        END IF;
    END LOOP;

    -- Return next available number
    RETURN v_max_number + 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE archiflow.netbox_devices IS 'Cached device names from NetBox for duplicate name checking';
COMMENT ON TABLE archiflow.netbox_ip_addresses IS 'Cached IP allocations from NetBox for availability checking';
COMMENT ON FUNCTION archiflow.get_next_device_counter IS 'Get next available device counter for auto-naming (checks NetBox + local DB)';
