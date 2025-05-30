import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { user, error: authError } = await supabase.auth.getUser(req)

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) {
    return new Response('No file uploaded', { status: 400 })
  }

  const bucket = 'campaign-files'
  const filePath = `user-${user.id}/${file.name}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file.stream())

  if (uploadError) {
    return new Response('Upload failed', { status: 500 })
  }

  return new Response('Upload successful!', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
  
})
