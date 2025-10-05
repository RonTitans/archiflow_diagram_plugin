-- Add site_code column to sites table
ALTER TABLE archiflow.sites
ADD COLUMN IF NOT EXISTS site_code VARCHAR(10);

-- Update existing sites with codes
UPDATE archiflow.sites SET site_code =
    CASE
        WHEN slug = 'hq' THEN 'HQ'
        WHEN slug = 'branch-nyc' THEN 'NYC'
        WHEN slug = 'branch-london' THEN 'LON'
        ELSE UPPER(LEFT(slug, 3))
    END
WHERE site_code IS NULL;

-- Add sample sites if none exist
INSERT INTO archiflow.sites (id, name, slug, site_code, description) VALUES
(1, 'Headquarters', 'hq', 'HQ', 'Main headquarters'),
(2, 'New York Branch', 'branch-nyc', 'NYC', 'New York office'),
(3, 'London Branch', 'branch-london', 'LON', 'London office'),
(4, 'Data Center 1', 'dc1', 'DC1', 'Primary data center'),
(5, 'Data Center 2', 'dc2', 'DC2', 'Secondary data center')
ON CONFLICT (id) DO UPDATE
SET site_code = EXCLUDED.site_code;

-- Create a sequence for device numbering per site and type
CREATE TABLE IF NOT EXISTS archiflow.device_counters (
    site_id INTEGER,
    device_type VARCHAR(50),
    prefix VARCHAR(10),
    last_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (site_id, device_type, prefix)
);

-- Function to get next device number
CREATE OR REPLACE FUNCTION archiflow.get_next_device_number(
    p_site_id INTEGER,
    p_device_type VARCHAR,
    p_prefix VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
BEGIN
    -- Insert or update the counter
    INSERT INTO archiflow.device_counters (site_id, device_type, prefix, last_number)
    VALUES (p_site_id, p_device_type, p_prefix, 1)
    ON CONFLICT (site_id, device_type, prefix)
    DO UPDATE SET last_number = device_counters.last_number + 1
    RETURNING last_number INTO v_next_number;

    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;