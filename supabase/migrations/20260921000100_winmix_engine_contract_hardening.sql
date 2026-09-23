-- WinMix central engine contract hardening.
-- Safe to apply after 20260921000000_winmix_central_engine_v1.sql.

begin;

create or replace function public.winmix_validate_data_version(p_data_version_id uuid)
returns table (match_count integer, content_fingerprint text)
language sql
security definer
set search_path = public
as $$
  select
    count(m.id)::integer as match_count,
    md5(coalesce(string_agg(
      concat_ws('|', s.league, s.season_index, m.match_no, m.kickoff_iso,
        m.home_team_id, m.away_team_id, m.ht_home_score, m.ht_away_score,
        m.home_score, m.away_score),
      E'\n' order by s.league, s.season_index, m.match_no
    ), '')) as content_fingerprint
  from public.winmix_seasons s
  join public.winmix_matches m on m.season_id = s.id
  where s.data_version_id = p_data_version_id
  group by s.data_version_id;
$$;

revoke all on function public.winmix_validate_data_version(uuid) from public, anon, authenticated;
grant execute on function public.winmix_validate_data_version(uuid) to service_role;

-- Contract v6 persists the B1 λ values used by score-market outputs. The old
-- v5 snapshot remains immutable for audit, while this creates the runnable
-- successor against the exact same sealed input and parameter values.
insert into public.winmix_parameter_snapshots (
  data_version_id, model_version, feature_schema_version, pipeline_contract_version,
  history_scope, experiments, weights, manual_weight_overrides, settings
)
select
  ps.data_version_id, ps.model_version, ps.feature_schema_version, 6,
  ps.history_scope, ps.experiments, ps.weights, ps.manual_weight_overrides, ps.settings
from public.winmix_parameter_snapshots ps
join public.winmix_data_versions dv on dv.id = ps.data_version_id
where dv.version_key = 'baseline-v1'
  and ps.pipeline_contract_version = 5
on conflict (data_version_id, parameters_fingerprint) do nothing;

create or replace function public.winmix_promote_engine_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.winmix_engine_runs;
  v_expected_matches integer;
  v_feature_count integer;
  v_prediction_count integer;
  v_team_state_count integer;
  v_calibration_count integer;
begin
  select * into v_run from public.winmix_engine_runs where id = p_run_id for update;
  if not found then raise exception 'WinMix engine run % does not exist.', p_run_id; end if;
  if v_run.status <> 'succeeded' then raise exception 'Only a succeeded WinMix engine run can be promoted.'; end if;

  select match_count into v_expected_matches from public.winmix_data_versions where id = v_run.data_version_id;
  select count(*) into v_feature_count from public.winmix_match_features where run_id = p_run_id;
  select count(*) into v_prediction_count from public.winmix_predictions where run_id = p_run_id;
  select count(*) into v_team_state_count from public.winmix_team_state_snapshots where run_id = p_run_id;
  select count(*) into v_calibration_count from public.winmix_calibration_results where run_id = p_run_id;

  if v_feature_count <> v_expected_matches or v_prediction_count <> v_expected_matches then
    raise exception 'Run output coverage is incomplete: expected %, features %, predictions %.',
      v_expected_matches, v_feature_count, v_prediction_count;
  end if;
  if v_team_state_count = 0 or v_calibration_count = 0 then
    raise exception 'Run cannot be promoted without team-state and calibration outputs.';
  end if;

  update public.winmix_engine_runs set is_current = false where is_current;
  update public.winmix_data_versions set is_current = false where is_current;
  update public.winmix_engine_runs
    set is_current = true, finished_at = coalesce(finished_at, now())
    where id = p_run_id;
  update public.winmix_data_versions set is_current = true where id = v_run.data_version_id;
  update public.winmix_engine_jobs set status = 'succeeded', finished_at = now()
    where id = v_run.job_id and status = 'running';

  return;
end;
$$;

revoke all on function public.winmix_promote_engine_run(uuid) from public, anon, authenticated;
grant execute on function public.winmix_promote_engine_run(uuid) to service_role;

-- An interrupted worker must not leave a job permanently unavailable. A later
-- authorized scheduler invocation can retry it after this explicit lease.
create or replace function public.winmix_requeue_expired_engine_jobs(p_lease_seconds integer default 1800)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.winmix_engine_jobs
  set status = 'queued', claimed_at = null, claimed_by = null,
      last_error_code = 'LEASE_EXPIRED', last_error_message = 'Worker lease expired; queued for retry.',
      started_at = null
  where status = 'running'
    and claimed_at < now() - make_interval(secs => greatest(p_lease_seconds, 60));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.winmix_requeue_expired_engine_jobs(integer) from public, anon, authenticated;
grant execute on function public.winmix_requeue_expired_engine_jobs(integer) to service_role;

notify pgrst, 'reload schema';
commit;
