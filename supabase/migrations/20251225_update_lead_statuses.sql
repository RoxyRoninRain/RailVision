-- Update leads status constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads 
ADD CONSTRAINT leads_status_check 
CHECK (status IN ('New', 'Pending', 'Contacted', 'Sold', 'Backed Out', 'On Hold', 'Closed'));

-- Add comment to document statuses
COMMENT ON COLUMN leads.status IS 'Workflow status: New, Pending, Contacted, Sold, Backed Out, On Hold, Closed';
