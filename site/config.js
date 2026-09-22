// Fill these in after you create a free project at https://supabase.com
// Dashboard -> Project Settings -> API -> "Project URL" and "anon public" key.
// The anon key is safe to ship in client code -- it only grants what your
// Row Level Security policies in supabase/schema.sql allow.
export const SUPABASE_URL = 'https://ufdjxclfuagueeozhhxj.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_QTuJbQllqfSkDX3MzwlNaA_W6_I360Q';

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Kaspi Gold transfer details shown on the payment page -- free, no
// merchant account needed. Student sends the money in their own Kaspi app,
// a teacher confirms it arrived and marks them paid from admin.html.
// Fill in a real Kaspi-linked phone number and the name the transfer
// should show as the recipient (Kaspi displays this for verification).
export const KASPI_PHONE = '+7 708 717 28 50';
export const KASPI_NAME = 'Абдирахман Санжар';
