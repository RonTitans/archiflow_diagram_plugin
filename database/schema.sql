-- ArchiFlow Network Diagram Plugin Database Schema
-- PostgreSQL schema for storing network diagrams with version control

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

-- Insert sample sites for testing
INSERT INTO archiflow.sites (id, name, slug, status, description)
VALUES
    (1, 'Main Data Center', 'main-dc', 'active', 'Primary data center location'),
    (2, 'Backup Site', 'backup-site', 'active', 'Disaster recovery site'),
    (3, 'Cloud Region US-East', 'cloud-us-east', 'active', 'AWS US-East-1 region')
ON CONFLICT (id) DO NOTHING;

-- Create a sample diagram for testing
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
);

-- Grant permissions (adjust as needed)
GRANT ALL PRIVILEGES ON SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA archiflow TO archiflow_user;