-- Function to cleanup orphaned IP allocations
-- IPs that are allocated but not associated with any device in the diagrams

CREATE OR REPLACE FUNCTION archiflow.cleanup_orphaned_ips()
RETURNS INTEGER AS $$
DECLARE
    released_count INTEGER;
BEGIN
    -- Release IPs that are allocated but have no corresponding device in network_devices table
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

-- Also add a cleanup that runs periodically or on diagram load
CREATE OR REPLACE FUNCTION archiflow.cleanup_session_ips(p_session_id VARCHAR DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    released_count INTEGER;
BEGIN
    -- For now, just cleanup IPs that have been allocated for more than 1 hour
    -- and are not saved to any diagram
    WITH released AS (
        UPDATE archiflow.ip_addresses
        SET
            device_id = NULL,
            device_name = NULL,
            allocated_at = NULL
        WHERE
            device_name IS NOT NULL
            AND device_id IS NULL
            AND allocated_at < NOW() - INTERVAL '1 hour'
        RETURNING 1
    )
    SELECT COUNT(*) INTO released_count FROM released;

    RETURN released_count;
END;
$$ LANGUAGE plpgsql;