-- Per-bucket policy: visibility (public/private), upload size cap, MIME
-- whitelist. Buckets exist in MinIO, but their dashboard-enforced policies
-- live here. Buckets without a row use the defaults baked into the app.

CREATE TABLE _dashboard.bucket_policies (
	bucket          text PRIMARY KEY,
	visibility      text NOT NULL DEFAULT 'private'
		CHECK (visibility IN ('public', 'private')),
	max_upload_mb   integer NOT NULL DEFAULT 25 CHECK (max_upload_mb > 0),
	-- NULL means "all MIME types allowed". An empty array would mean "nothing
	-- allowed" which is rarely useful — use NULL to express "no restriction".
	allowed_mime    text[],
	updated_at      timestamptz NOT NULL DEFAULT now(),
	updated_by      uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

GRANT ALL ON _dashboard.bucket_policies TO dashboard_admin;
