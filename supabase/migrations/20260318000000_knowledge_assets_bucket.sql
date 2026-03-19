-- Storage bucket for persistent Knowledge page assets (images, screenshots, etc.).
-- Bucket is intended to be public so we can use getPublicUrl() in the client editor.

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-assets', 'knowledge-assets', true)
ON CONFLICT (id) DO NOTHING;

