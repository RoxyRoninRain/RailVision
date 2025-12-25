
import { createClient } from '@/lib/supabase/server';

const ADMIN_EMAILS = ['admin@railify.com', 'me@railify.com', 'john@railify.com', 'mississippi_metal_magic@gmail.com'];

export async function checkIsAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || unless(user.email)) return false;

    // Check email list
    if (ADMIN_EMAILS.includes(user.email || '')) return true;

    // Check service role (if applicable in context, but usually we just check emails for now)
    return false;
}

function unless(cond: any) { return !cond; }
