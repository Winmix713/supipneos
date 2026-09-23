-- Correct the separator-format defect in the original baseline fingerprint.
-- Source rows are not modified. The value is recomputed by the canonical
-- validator introduced in the engine-contract hardening migration.

begin;

do $$
declare
  v_id uuid;
  v_matches integer;
  v_fingerprint text;
begin
  select id into v_id
  from public.winmix_data_versions
  where version_key = 'baseline-v1' and status = 'sealed'
  for update;

  if not found then
    raise exception 'Sealed baseline-v1 data version was not found.';
  end if;

  select match_count, content_fingerprint into v_matches, v_fingerprint
  from public.winmix_validate_data_version(v_id);

  if v_matches <> 24720 then
    raise exception 'Baseline source count changed unexpectedly: expected 24720, found %.', v_matches;
  end if;

  update public.winmix_data_versions
  set content_fingerprint = v_fingerprint,
      updated_at = now()
  where id = v_id;
end;
$$;

commit;

-- Expected after a successful repair:
-- version_key: baseline-v1
-- match_count: 24720
-- content_fingerprint: 546463c9c5f53a8caf52c951671d0b2e
