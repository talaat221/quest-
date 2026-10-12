import { supabase } from './supabaseClient';
const timezone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
export async function farmCommand(action='read',args={}) {
  const {data,error}=await supabase.rpc('quest_farm',{p_action:action,p_timezone:timezone(),...args});
  if(error)throw new Error(error.message||'Your farm could not connect. Try again.');
  return data;
}
export async function loadFarmSummaries(ids) {
  const unique=[...new Set(ids.filter(Boolean))].slice(0,100);
  if(!unique.length)return [];
  const {data,error}=await supabase.rpc('get_quest_farms',{p_user_ids:unique});
  if(error)throw new Error(error.message||'Friend farms could not load.');
  return Array.isArray(data)?data:[];
}
