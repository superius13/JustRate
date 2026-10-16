import { supabase } from '@/lib/supabase';

export type Group = {
  id: string;
  name: string;
  invite_code: string;
};

export type GroupMember = {
  user_id: string;
  display_name: string;
  joined_at: string;
};

export type FriendRating = {
  user_id: string;
  display_name: string;
  /** From 1 to 10 in steps of 0.5. */
  overall: number;
  review: string | null;
  updated_at: string;
};

const GROUP_COLUMNS = 'id, name, invite_code';

/** Raised by join_group in the database when no group has the code. */
export class InvalidInviteCodeError extends Error {}

/** The user's group, or null. One group per person for now; the oldest wins if there are more. */
export async function fetchMyGroup(userId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`joined_at, group:groups!inner(${GROUP_COLUMNS})`)
    .eq('user_id', userId)
    .order('joined_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as { group: Group } | null)?.group ?? null;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, joined_at, profile:profiles!inner(display_name)')
    .eq('group_id', groupId)
    .order('joined_at');
  if (error) throw error;
  type Row = { user_id: string; joined_at: string; profile: { display_name: string } };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    user_id: row.user_id,
    joined_at: row.joined_at,
    display_name: row.profile.display_name,
  }));
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase.rpc('create_group', { group_name: name });
  if (error) throw error;
  return pickGroup(data);
}

export async function joinGroup(code: string): Promise<Group> {
  const { data, error } = await supabase.rpc('join_group', { code: code.trim().toUpperCase() });
  if (error) {
    if (/invalid invite code/i.test(error.message)) throw new InvalidInviteCodeError(error.message);
    throw error;
  }
  return pickGroup(data);
}

export async function leaveGroup(userId: string, groupId: string) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Ratings of a title by people who share a group with the user; access rules hide everyone else. */
export async function fetchFriendRatings(userId: string, titleId: string): Promise<FriendRating[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('user_id, overall, review, updated_at, profile:profiles!inner(display_name)')
    .eq('title_id', titleId)
    .neq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  type Row = Omit<FriendRating, 'display_name'> & { profile: { display_name: string } };
  return ((data ?? []) as unknown as Row[]).map(({ profile, ...rating }) => ({
    ...rating,
    overall: Number(rating.overall),
    display_name: profile.display_name,
  }));
}

/** A function returning a table row comes back as the row itself, but some clients wrap it in a list. */
function pickGroup(data: unknown): Group {
  const row = (Array.isArray(data) ? data[0] : data) as Group;
  return { id: row.id, name: row.name, invite_code: row.invite_code };
}
