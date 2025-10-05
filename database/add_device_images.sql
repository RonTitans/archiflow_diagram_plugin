-- Add image_url column to device_templates table
ALTER TABLE archiflow.device_templates
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Add Cisco C9200-24P switch template with image
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
    200,
    60,
    '/images/devices/cisco-c9200-24p.png',
    '{"power": "PoE+", "ports_speed": "1Gbps", "uplink_ports": 4}'::jsonb
) ON CONFLICT (name)
DO UPDATE SET
    image_url = EXCLUDED.image_url,
    default_width = EXCLUDED.default_width,
    manufacturer = EXCLUDED.manufacturer,
    model = EXCLUDED.model;

-- Update existing templates to have placeholder images if needed
UPDATE archiflow.device_templates
SET image_url = CASE
    WHEN device_type = 'router' THEN '/images/devices/generic-router.svg'
    WHEN device_type = 'switch' THEN '/images/devices/generic-switch.svg'
    WHEN device_type = 'firewall' THEN '/images/devices/generic-firewall.svg'
    WHEN device_type = 'server' THEN '/images/devices/generic-server.svg'
    ELSE NULL
END
WHERE image_url IS NULL;