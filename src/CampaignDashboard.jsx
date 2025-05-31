import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function CampaignDashboard({ session }) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null);
  useEffect(() => {
    fetchCampaigns()

    const channel = supabase
  .channel('public:campaigns')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'campaigns' },
    payload => {
      console.log('Realtime change:', payload)
      fetchCampaigns()
    }
  )
  .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchCampaigns = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('campaigns').select('*')
    if (error) console.error('Error fetching:', error)
    else setCampaigns(data)
    setLoading(false)
  }
    const createCampaign = async () => {
      const name = prompt('Enter new campaign name:')
      if (name) {
        const { error } = await supabase.from('campaigns').insert([
          { name, user_id: session.user.id }
        ])
        if (error) {
          console.error('Error creating:', error)
          alert('Failed to create: ' + error.message)
        } else {
          fetchCampaigns()
        }
      }
    }  
  const editCampaign = async (id) => {
    const newName = prompt('Enter new campaign name:')
    if (newName) {
      const { error } = await supabase.from('campaigns').update({ name: newName }).eq('id', id)
      if (error) console.error('Error updating campaign:', error)
    }
  }
  
  const deleteCampaign = async (id) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', id)
    if (error) console.error('Error deleting:', error)
  }

// 1) keep this inside <CampaignDashboard />
const uploadFile = async () => {
  if (!selectedFile) {
    alert('Select a file first');
    return;
  }

  // ── get a *fresh* auth session ───────────────────────────────
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) {
    alert('You must be logged in to upload');
    return;
  }

  // ── build multipart/form-data body ───────────────────────────
  const fd = new FormData();
  fd.append('file', selectedFile);

  try {
    const res = await fetch(
      'https://koervonzcjptsnqmnvg.functions.supabase.co/upload-handler',
      {
        method: 'POST',
        headers: {
          // SB checks these two headers:
          'sb-project-ref' : 'koervonzcjptsnqmnvg',
          authorization    : `Bearer ${authSession.access_token}`,
        },
        body: fd
      },
    );

    if (!res.ok) {
      const text = await res.text();     // ← lowercase variable
      throw new Error(text);
    }

    alert('File uploaded successfully ✔');
  } catch (err) {
    console.error('Upload failed:', err);
    alert(`Upload failed: ${err.message}`);
  }
};

  
  return (
    <div>
      <h1>Campaign Dashboard</h1>
      <button onClick={createCampaign}>New Campaign</button>
     <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])}
/>
      <button onClick={uploadFile}>Upload File</button>
      <ul>
        {campaigns.map(c => (
          <li key={c.id}>
            {c.name}
            <button onClick={() => deleteCampaign(c.id)}>Delete</button>
            <button onClick={() => editCampaign(c.id)}>Edit</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
