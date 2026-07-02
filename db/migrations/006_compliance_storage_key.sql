-- PDF storage moved from a local volume to S3/MinIO (post-MVP architecture
-- note). file_path held a local filesystem path; storage_key holds an S3
-- object key. Existing rows are pre-launch dev/test artifacts only — no
-- production data to preserve, so this is a clean cutover.
ALTER TABLE compliance.exports RENAME COLUMN file_path TO storage_key;
TRUNCATE TABLE compliance.exports;
