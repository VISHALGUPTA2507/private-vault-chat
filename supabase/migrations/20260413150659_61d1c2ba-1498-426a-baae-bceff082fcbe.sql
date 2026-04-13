-- Allow authenticated users to find admin user IDs (needed for chat)
CREATE POLICY "Users can find admins"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'admin'::app_role);