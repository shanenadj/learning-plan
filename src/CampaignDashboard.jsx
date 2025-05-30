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

  if (loading) return <p>Loading campaigns...</p>
  const uploadFile = async (file) => {
    if (!session) {
      alert('You must be logged in to upload!');
      return;
    }
  
    try {
      const response = await fetch('https://koervonzcjptsmnqnvmg.functions.supabase.co/upload-handler', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,},
        body: file,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', errorText);
        alert('Upload failed: ' + errorText);
      } else {
        console.log('Upload successful!');
        alert('File uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file: ' + error.message);
    }
  };
  
  return (
    <div>
      <h1>Campaign Dashboard</h1>
      <button onClick={createCampaign}>New Campaign</button>
      <input 
  type="file" 
  onChange={(e) => setSelectedFile(e.target.files[0])} 
/>

<button onClick={() => {
  if (selectedFile) {
    uploadFile(selectedFile);
  } else {
    alert('Please select a file first!');
  }
}}>
  Upload File
</button>

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
