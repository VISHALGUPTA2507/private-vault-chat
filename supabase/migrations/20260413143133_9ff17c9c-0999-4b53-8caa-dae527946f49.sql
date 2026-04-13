
-- Add file_password column for password-protected files
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS file_password text DEFAULT NULL;

-- Add is_broadcast column for broadcast messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;

-- Allow admins to delete messages
CREATE POLICY "Admins can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all messages (insert broadcasts, etc.)
CREATE POLICY "Admins can insert messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
