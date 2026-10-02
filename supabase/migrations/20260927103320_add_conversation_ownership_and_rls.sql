alter table public.conversations
    add column user_id uuid not null
    references auth.users (id) on delete cascade;

create index if not exists conversations_user_id_created_at_idx
    on public.conversations (user_id, created_at desc);

grant select, insert on public.conversations, public.messages to authenticated;

create policy conversations_select_own
    on public.conversations
    for select
    to authenticated
    using (user_id = (select auth.uid()));

create policy conversations_insert_own
    on public.conversations
    for insert
    to authenticated
    with check (user_id = (select auth.uid()));

create policy messages_select_own_conversations
    on public.messages
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.conversations
            where conversations.id = messages.conversation_id
              and conversations.user_id = (select auth.uid())
        )
    );

create policy messages_insert_own_conversations
    on public.messages
    for insert
    to authenticated
    with check (
        exists (
            select 1
            from public.conversations
            where conversations.id = messages.conversation_id
              and conversations.user_id = (select auth.uid())
        )
    );
