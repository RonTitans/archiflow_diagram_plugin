-- Create IP addresses table to store all IPs for each pool
-- This table pre-populates all possible IPs for each pool

SET search_path TO archiflow;

-- Create the ip_addresses table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ip_addresses_pool_id ON archiflow.ip_addresses(pool_id);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_device_id ON archiflow.ip_addresses(device_id);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_ip ON archiflow.ip_addresses(ip_address);

-- Function to populate IPs for a pool
CREATE OR REPLACE FUNCTION populate_pool_ips(pool_uuid UUID)
RETURNS void AS $$
DECLARE
    pool_record RECORD;
    ip_addr INET;
    network_addr INET;
    broadcast_addr INET;
    current_ip INET;
BEGIN
    -- Get pool details
    SELECT * INTO pool_record FROM archiflow.ip_pools WHERE id = pool_uuid;

    IF pool_record IS NULL THEN
        RAISE EXCEPTION 'Pool not found: %', pool_uuid;
    END IF;

    network_addr := network(pool_record.network);
    broadcast_addr := broadcast(pool_record.network);

    -- Generate IPs from network+1 to broadcast-1
    current_ip := network_addr + 1;

    WHILE current_ip < broadcast_addr LOOP
        -- Insert IP, marking gateway if it matches
        INSERT INTO archiflow.ip_addresses (pool_id, ip_address, is_gateway, is_reserved)
        VALUES (
            pool_uuid,
            current_ip,
            current_ip = pool_record.gateway,
            current_ip = pool_record.gateway  -- Gateway is reserved by default
        )
        ON CONFLICT (pool_id, ip_address) DO NOTHING;

        current_ip := current_ip + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Populate IPs for all existing pools
DO $$
DECLARE
    pool RECORD;
BEGIN
    FOR pool IN SELECT id, name FROM archiflow.ip_pools LOOP
        RAISE NOTICE 'Populating IPs for pool: %', pool.name;
        PERFORM populate_pool_ips(pool.id);
    END LOOP;
END $$;

-- Add some sample allocations for demonstration
-- Allocate a few IPs to show the allocation status working
UPDATE archiflow.ip_addresses
SET
    device_id = gen_random_uuid(),
    device_name = 'Web Server 01',
    allocated_at = NOW()
WHERE pool_id = (SELECT id FROM archiflow.ip_pools WHERE name = 'Production Servers' LIMIT 1)
    AND ip_address = '10.10.20.10'::inet;

UPDATE archiflow.ip_addresses
SET
    device_id = gen_random_uuid(),
    device_name = 'Database Server',
    allocated_at = NOW()
WHERE pool_id = (SELECT id FROM archiflow.ip_pools WHERE name = 'Production Servers' LIMIT 1)
    AND ip_address = '10.10.20.20'::inet;

UPDATE archiflow.ip_addresses
SET
    device_id = gen_random_uuid(),
    device_name = 'Dev Machine 01',
    allocated_at = NOW()
WHERE pool_id = (SELECT id FROM archiflow.ip_pools WHERE name = 'Development Network' LIMIT 1)
    AND ip_address = '10.10.30.50'::inet;

-- Grant permissions
GRANT ALL PRIVILEGES ON archiflow.ip_addresses TO archiflow_user;

-- Show summary
SELECT
    p.name as pool_name,
    p.network,
    COUNT(ip.id) as total_ips,
    COUNT(CASE WHEN ip.device_id IS NOT NULL THEN 1 END) as allocated_ips,
    COUNT(CASE WHEN ip.is_gateway THEN 1 END) as gateway_ips
FROM archiflow.ip_pools p
LEFT JOIN archiflow.ip_addresses ip ON p.id = ip.pool_id
GROUP BY p.id, p.name, p.network
ORDER BY p.name;