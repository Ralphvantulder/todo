-- ============================================================
-- To do · toegang voor een aparte Claude-gebruiker
-- Voer uit in Supabase → SQL Editor, NADAT todo-schema.sql is uitgevoerd en je in
-- Authentication → Users de Claude-gebruiker hebt aangemaakt.
-- Pas het adres hieronder aan als je een ander adres kiest. Gebruik je het
-- Supabase-project van het CRM, dan bestaat claude-crm@tulderconsultancy.nl al:
-- vul dan dat adres in.
--
-- Wat dit doet: die ene gebruiker ziet en bewerkt dezelfde taken en notities als jij.
-- Alles wat hij toevoegt, wordt van jou. Jouw eigen toegang verandert niet.
-- Intrekken: delete from public.todo_toegang;  (of verwijder de gebruiker in Authentication → Users)
-- ============================================================

do $$
declare
  claude_mail text := 'claude-todo@tulderconsultancy.nl';
  c uuid; e uuid; n int;
begin
  select id into c from auth.users where lower(email) = lower(claude_mail);
  if c is null then raise exception 'Gebruiker % bestaat nog niet. Maak hem eerst aan in Authentication → Users.', claude_mail; end if;
  select count(*) into n from auth.users where id <> c;
  if n <> 1 then raise exception 'Verwacht precies één ander account (het jouwe), gevonden: %. Niets gewijzigd.', n; end if;
  select id into e from auth.users where id <> c;
  insert into public.todo_toegang (gast, eigenaar) values (c, e)
    on conflict (gast) do update set eigenaar = excluded.eigenaar;
  raise notice 'Klaar: % heeft nu toegang tot jouw to do''s en notities.', claude_mail;
end $$;
