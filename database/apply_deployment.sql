-- Create trigger function for single deployment per site
CREATE OR REPLACE FUNCTION archiflow.check_single_deployment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deployment_status = 'deployed' THEN
        UPDATE archiflow.diagrams
        SET deployment_status = 'draft',
            deployed_at = NULL,
            deployed_by = NULL
        WHERE site_id = NEW.site_id
        AND id != NEW.id
        AND deployment_status = 'deployed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_single_deployment ON archiflow.diagrams;
CREATE TRIGGER ensure_single_deployment
BEFORE INSERT OR UPDATE ON archiflow.diagrams
FOR EACH ROW
EXECUTE FUNCTION archiflow.check_single_deployment();

-- Update existing data to have deployment_status
UPDATE archiflow.diagrams SET deployment_status = 'draft' WHERE deployment_status IS NULL;