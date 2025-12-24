-- Enable pg_cron extension (Supabase Pro)
create extension if not exists pg_cron;

-- Schedule nightly cleanup of 'quote-uploads' bucket
-- Deletes files older than 30 days
select cron.schedule('cleanup-quote-uploads', '0 3 * * *', $$
    delete from storage.objects
    where bucket_id = 'quote-uploads'
    and created_at < now() - interval '30 days';
$$);
