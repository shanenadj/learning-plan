import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function CampaignDashboard({ session }) {
  // ─── Campaign CRUD state ────────────────────────────────────────────────────
  const [campaigns, setCampaigns]               = useState([])    
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [campaignError, setCampaignError]       = useState(null)

  // Create new campaign
  const [newCampaignName, setNewCampaignName]   = useState('')
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [createError, setCreateError]           = useState(null)

  // Edit existing campaign
  const [editingId, setEditingId]               = useState(null)
  const [editingName, setEditingName]           = useState('')
  const [updatingCampaign, setUpdatingCampaign] = useState(false)
  const [updateError, setUpdateError]           = useState(null)

  // Selected campaign
  const [selectedCampaignId, setSelectedCampaignId] = useState(null)

  // ─── File upload & metadata state ───────────────────────────────────────────
  const [selectedFile, setSelectedFile]           = useState(null)
  const [uploading, setUploading]                 = useState(false)
  const [immediateUrl, setImmediateUrl]           = useState('')
  const [uploadedPath, setUploadedPath]           = useState('')   
  const [insertError, setInsertError]             = useState(null)

  // ─── Generate‐Output state ─────────────────────────────────────────────────
  const [generating, setGenerating]               = useState(false)
  const [finalUrl, setFinalUrl]                   = useState('')
  const [generateError, setGenerateError]         = useState(null)

  // ─── 1) Fetch all campaigns belonging to this user ───────────────────────────
  const fetchCampaigns = async () => {
    if (!session) return
    setLoadingCampaigns(true)
    setCampaignError(null)

    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('user_id', session.user.id)
      .order('name', { ascending: true })

    setLoadingCampaigns(false)

    if (error) {
      console.error('Error fetching campaigns:', error)
      setCampaignError(error.message)
    } else {
      setCampaigns(data)
    }
  }

  useEffect(() => {
    if (session) fetchCampaigns()
  }, [session])

  // ─── 2) Create a new campaign ───────────────────────────────────────────────
  const handleNewCampaignChange = (e) => {
    setNewCampaignName(e.target.value)
  }

  const createCampaign = async () => {
    if (!newCampaignName.trim()) {
      alert('Please enter a campaign name.')
      return
    }
    if (!session) {
      alert('You must be logged in to create a campaign.')
      return
    }

    setCreatingCampaign(true)
    setCreateError(null)

    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .insert([
        { user_id: session.user.id, name: newCampaignName.trim() },
      ])
      .select('id, name')
      .single()

    setCreatingCampaign(false)

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      setCreateError(campaignError.message)
      return
    }

    // Add the newly created campaign to our list and clear input
    setCampaigns([ campaignData, ...campaigns ])
    setNewCampaignName('')
    setSelectedCampaignId(campaignData.id)
  }

  // ─── 3) Start editing an existing campaign ──────────────────────────────────
  const startEditing = (id, name) => {
    setEditingId(id)
    setEditingName(name)
    setUpdateError(null)
  }

  // ─── 4) Update campaign name ───────────────────────────────────────────────
  const updateCampaign = async () => {
    if (!editingName.trim()) {
      alert('Name cannot be empty.')
      return
    }
    setUpdatingCampaign(true)
    setUpdateError(null)

    const { data, error } = await supabase
      .from('campaigns')
      .update({ name: editingName.trim() })
      .eq('id', editingId)
      .select('id, name')
      .single()

    setUpdatingCampaign(false)

    if (error) {
      console.error('Error updating campaign:', error)
      setUpdateError(error.message)
      return
    }

    // Replace the old campaign in state
    setCampaigns(campaigns.map((c) => (c.id === data.id ? data : c)))
    setEditingId(null)
    setEditingName('')
  }

  // ─── 5) Delete a campaign ────────────────────────────────────────────────────
  const deleteCampaign = async (id) => {
    const ok = window.confirm('Are you sure you want to delete this campaign and all its files?')
    if (!ok) return

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting campaign:', error)
      alert('Failed to delete campaign: ' + error.message)
      return
    }

    // Remove from local state
    setCampaigns(campaigns.filter((c) => c.id !== id))

    // If we were viewing this campaign, clear selection & file UI
    if (selectedCampaignId === id) {
      setSelectedCampaignId(null)
      setImmediateUrl('')
      setUploadedPath('')
      setFinalUrl('')
    }
  }

  // ─── 6) Handle file selection ────────────────────────────────────────────────
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null)
  }

  // ─── 7) Upload file to “campaign-files” and insert metadata ─────────────────
  const uploadFile = async () => {
    if (!selectedFile) {
      alert('Please select a file first.')
      return
    }
    if (!session) {
      alert('You must be logged in to upload files.')
      return
    }
    if (!selectedCampaignId) {
      alert('No campaign selected.')
      return
    }

    setUploading(true)
    setInsertError(null)

    // Build a unique key under “campaign-files”
    const fileExt  = selectedFile.name.split('.').pop()                   // e.g. "pdf"
    const fileName = `${Date.now()}.${fileExt}`                            // e.g. "1749035000000.pdf"
    const filePath = `${session.user.id}/${fileName}`                      // e.g. "067e1f06‐…/1749035000000.pdf"

    // Upload to storage bucket “campaign-files”
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('campaign-files')
      .upload(filePath, selectedFile, {
        cacheControl: '3600',
        upsert: false,
      })

    setUploading(false)

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      alert('Upload failed: ' + uploadError.message)
      return
    }

    // Generate a public URL for the just‐uploaded file
    const {
      data: { publicUrl: liveUrl },
      error: urlErr1,
    } = supabase
      .storage
      .from('campaign-files')
      .getPublicUrl(uploadData.path)

    if (!urlErr1) {
      setImmediateUrl(liveUrl)
    } else {
      console.warn('Could not fetch live URL:', urlErr1)
    }

    // Save the raw storage path so “Generate Output” can use it later
    setUploadedPath(uploadData.path)

    // Insert metadata into “file_metadata”
    const { error: metaError } = await supabase
      .from('file_metadata')
      .insert([
        {
          user_id:      session.user.id,
          campaign_id:  selectedCampaignId,
          file_name:    fileName,
          file_type:    selectedFile.type,
          storage_path: uploadData.path,
        },
      ])

    if (metaError) {
      console.error('Could not insert metadata:', metaError)
      setInsertError(metaError.message)
      alert('Upload succeeded, but failed to save metadata.')
    }
  }

  // ─── 8) On‐demand: call edge function to copy into “campaign-outputs” ─────────
  const generateOutput = async () => {
    if (!uploadedPath) {
      alert('No uploaded file to process.')
      return
    }
    if (!session) {
      alert('You must be logged in to generate output.')
      return
    }

    setGenerating(true)
    setGenerateError(null)

    let resp
    try {
      resp = await fetch(
        'https://koervonzcjptsnmqnvmg.supabase.co/functions/v1/generate-output',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            filePath: uploadedPath,
            userId:   session.user.id,
          }),
        }
      )
    } catch (networkErr) {
      console.error('Network error calling edge function:', networkErr)
      setGenerating(false)
      setGenerateError('Network error. Try again.')
      return
    }

    let functionResponse = {}
    try {
      functionResponse = await resp.json()
    } catch (parseErr) {
      console.error('Failed to parse edge function response JSON:', parseErr)
      setGenerating(false)
      setGenerateError('Invalid response from server.')
      return
    }

    if (!resp.ok || !functionResponse.publicUrl) {
      console.error('Edge function returned error:', functionResponse)
      setGenerating(false)
      setGenerateError('Processing failed. Check console for details.')
      return
    }

    setFinalUrl(functionResponse.publicUrl)
    setGenerating(false)
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Campaign Dashboard</h1>

      {/* ─── CAMPAIGN CRUD UI ───────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>Your Campaigns</h2>
        {campaignError && (
          <p style={{ color: 'red' }}>Error loading campaigns: {campaignError}</p>
        )}

        {loadingCampaigns ? (
          <p>Loading…</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {campaigns.map((c) => (
              <li key={c.id} style={{ marginBottom: '0.5rem' }}>
                {editingId === c.id ? (
                  // ↳ Editing state
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <button
                      onClick={updateCampaign}
                      disabled={updatingCampaign}
                      style={{ marginRight: '0.5rem' }}
                    >
                      {updatingCampaign ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                    {updateError && (
                      <p style={{ color: 'red', marginTop: '0.25rem' }}>
                        {updateError}
                      </p>
                    )}
                  </>
                ) : (
                  // ↳ Display state
                  <>
                    <span style={{ marginRight: '1rem' }}>{c.name}</span>
                    <button
                      onClick={() => startEditing(c.id, c.name)}
                      style={{ marginRight: '0.5rem' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCampaign(c.id)}
                      style={{ marginRight: '0.5rem' }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCampaignId(c.id)
                        setImmediateUrl('')
                        setUploadedPath('')
                        setFinalUrl('')
                      }}
                    >
                      Select
                    </button>
                  </>
                )}
              </li>
            ))}
            {campaigns.length === 0 && <p>No campaigns yet.</p>}
          </ul>
        )}

        {/* Create new campaign */}
        <div style={{ marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="New campaign name"
            value={newCampaignName}
            onChange={handleNewCampaignChange}
            style={{ marginRight: '0.5rem' }}
          />
          <button onClick={createCampaign} disabled={creatingCampaign}>
            {creatingCampaign ? 'Creating…' : 'Create Campaign'}
          </button>
          {createError && (
            <p style={{ color: 'red', marginTop: '0.25rem' }}>
              Error: {createError}
            </p>
          )}
        </div>
      </section>

      {/* ─── FILE UPLOAD & GENERATE OUTPUT ───────────────────────────────────────────── */}
      {selectedCampaignId && (
        <section>
          <h2>Selected Campaign ID: {selectedCampaignId}</h2>

          {/* File chooser & Upload button */}
          <div style={{ marginBottom: '1rem' }}>
            <input type="file" onChange={handleFileChange} />
            <button
              onClick={uploadFile}
              disabled={uploading}
              style={{ marginLeft: '0.5rem' }}
            >
              {uploading ? 'Uploading…' : 'Upload File'}
            </button>
          </div>
          {insertError && (
            <p style={{ color: 'red', marginTop: '0.25rem' }}>
              Could not insert metadata: {insertError}
            </p>
          )}

          {/* Show link to the uploaded file in “campaign-files” */}
          {immediateUrl && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Uploaded File Is Live</h3>
              <a href={immediateUrl} target="_blank" rel="noopener noreferrer">
                {immediateUrl}
              </a>
            </div>
          )}

          {/* Generate Output button (only after a file is uploaded) */}
          {uploadedPath && (
            <div style={{ marginTop: '2rem' }}>
              <button onClick={generateOutput} disabled={generating}>
                {generating ? 'Processing…' : 'Generate Output'}
              </button>
              {generateError && (
                <p style={{ color: 'red', marginTop: '0.25rem' }}>
                  {generateError}
                </p>
              )}
            </div>
          )}

          {/* Show link to the processed copy in “campaign-outputs” */}
          {finalUrl && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Your Final Download</h3>
              <a href={finalUrl} target="_blank" rel="noopener noreferrer">
                Download Processed File
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
