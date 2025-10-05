-- Migration 002: Complete IP Management and Device Features
-- This migration adds all the features we implemented today

-- 1. Add image_url to device_templates if not exists
ALTER TABLE archiflow.device_templates
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- 2. Add site_code to sites table
ALTER TABLE archiflow.sites
ADD COLUMN IF NOT EXISTS site_code VARCHAR(10);

-- 3. Update site codes
UPDATE archiflow.sites SET site_code =
    CASE
        WHEN slug = 'main-dc' THEN 'MAIN'
        WHEN slug = 'backup-site' THEN 'BACKUP'
        WHEN slug = 'cloud-us-east' THEN 'CLOUD'
        WHEN slug = 'dc1' THEN 'DC1'
        WHEN slug = 'dc2' THEN 'DC2'
        ELSE UPPER(LEFT(REPLACE(slug, '-', ''), 4))
    END
WHERE site_code IS NULL;

-- 4. Create IP addresses table for IP allocation
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

-- 5. Create device counters table for auto-naming
CREATE TABLE IF NOT EXISTS archiflow.device_counters (
    site_id INTEGER,
    device_type VARCHAR(50),
    prefix VARCHAR(10),
    last_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (site_id, device_type, prefix)
);

-- 6. Function to populate IP addresses for a pool
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

-- 7. Populate IPs for existing pools
DO $$
DECLARE
    v_pool RECORD;
BEGIN
    FOR v_pool IN SELECT id FROM archiflow.ip_pools LOOP
        PERFORM archiflow.populate_pool_ips(v_pool.id);
    END LOOP;
END;
$$;

-- 8. Function to get next device number
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

-- 9. Cleanup functions for orphaned IPs
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

-- 10. Add Cisco C9200-24P template
INSERT INTO archiflow.device_templates (
    name,
    device_type,
    manufacturer,
    model,
    default_ports,
    port_naming_pattern,
    category,
    default_width,
    default_height,
    image_url,
    metadata
) VALUES (
    'Cisco C9200-24P',
    'switch',
    'Cisco',
    'C9200-24P',
    24,
    'GigabitEthernet1/0/{port}',
    'network',
    340,
    35,
    '/images/devices/cisco-c9200-24p-real.svg',
    '{"power": "PoE+", "ports_speed": "1Gbps", "uplink_ports": 4}'::jsonb
) ON CONFLICT (name) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    default_width = EXCLUDED.default_width,
    default_height = EXCLUDED.default_height;

-- 11. Migration tracking
CREATE TABLE IF NOT EXISTS archiflow.schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);

-- Record this migration
INSERT INTO archiflow.schema_migrations (version, name)
VALUES (2, '002_ip_management_and_devices')
ON CONFLICT (version) DO NOTHING;