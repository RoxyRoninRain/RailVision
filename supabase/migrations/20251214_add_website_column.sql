ALTER TABLE profiles ADD COLUMN website text;
COMMENT ON COLUMN profiles.website IS 'The authorized domain for embedding the visualizer (e.g., https://example.com)';
