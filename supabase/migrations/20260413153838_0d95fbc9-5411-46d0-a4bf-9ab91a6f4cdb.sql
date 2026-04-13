-- Allow admins to delete files permanently
CREATE POLICY "Admins can delete files"
ON public.files
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));