
-- Create a security definer function to check hospital membership
-- This avoids infinite recursion in RLS policies on hospital_members
CREATE OR REPLACE FUNCTION public.get_user_hospital_account_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.hospital_members
  WHERE user_id = _user_id
$$;

-- Drop the recursive SELECT policy
DROP POLICY IF EXISTS "Members can read their own account memberships" ON public.hospital_members;

-- Create a non-recursive SELECT policy using the security definer function
CREATE POLICY "Members can read their own account memberships"
ON public.hospital_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR account_id IN (SELECT public.get_user_hospital_account_ids(auth.uid()))
);

-- Also fix the recursive DELETE policy on hospital_members
DROP POLICY IF EXISTS "Owners can delete account members" ON public.hospital_members;
CREATE POLICY "Owners can delete account members"
ON public.hospital_members
FOR DELETE
USING (
  account_id IN (
    SELECT public.get_user_hospital_account_ids(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.hospital_members hm
    WHERE hm.user_id = auth.uid()
      AND hm.account_id = hospital_members.account_id
      AND hm.role = 'owner'
  )
);

-- Fix the recursive UPDATE policy too
DROP POLICY IF EXISTS "Owners can update account members" ON public.hospital_members;
CREATE POLICY "Owners can update account members"
ON public.hospital_members
FOR UPDATE
USING (
  account_id IN (
    SELECT public.get_user_hospital_account_ids(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.hospital_members hm
    WHERE hm.user_id = auth.uid()
      AND hm.account_id = hospital_members.account_id
      AND hm.role = 'owner'
  )
);
