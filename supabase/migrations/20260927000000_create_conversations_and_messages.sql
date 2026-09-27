create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations (id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
    on public.messages (conversation_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
