-- Allow public uploads to the quote-uploads bucket
create policy "Allow public uploads to quote-uploads"
on storage.objects for insert
to public
with check ( bucket_id = 'quote-uploads' );

-- Ensure generic public access just in case
create policy "Allow public usage of quote-uploads"
on storage.objects for select
to public
using ( bucket_id = 'quote-uploads' );
