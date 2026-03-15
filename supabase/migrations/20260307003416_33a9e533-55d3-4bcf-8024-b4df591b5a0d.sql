
-- Allow users to delete their own profiles
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- Allow users to delete their own roles
CREATE POLICY "Users can delete own roles" ON public.user_roles FOR DELETE USING (auth.uid() = user_id);
