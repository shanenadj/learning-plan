// src/CampaignDashboard.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Define reusable purple/darkerPurple colors:
const purple = '#6B46C1'
const darkerPurple = '#5939A7'
const inputFocusStyle = {
  outline: 'none',
  boxShadow: `0 0 0 2px ${purple}`,
  borderColor: purple,
}

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
  const [uploadedPath, setUploadedPath]           = useState('')   // storage key in "campaign-files"
  const [insertError, setInsertError]             = useState(null)

  // ─── Generate‐Output state ─────────────────────────────────────────────────
  const [generating, setGenerating]               = useState(false)
  const [finalUrl, setFinalUrl]                   = useState('')
  const [generateError, setGenerateError]         = useState(null)

  // ─── “Files + Outputs” list state ──────────────────────────────────────────
  const [campaignFiles, setCampaignFiles]         = useState([])   // array of { id, file_name, storage_path, file_type, inputUrl, outputUrl }
  const [loadingFiles, setLoadingFiles]           = useState(false)
  const [filesError, setFilesError]               = useState(null)

  // ─── Fetch all campaigns belonging to this user ───────────────────────────
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

  // ─── Create a new campaign ───────────────────────────────────────────────
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
      .insert([{ user_id: session.user.id, name: newCampaignName.trim() }])
      .select('id, name')
      .single()

    setCreatingCampaign(false)

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      setCreateError(campaignError.message)
      return
    }

    setCampaigns([campaignData, ...campaigns])
    setNewCampaignName('')
    setSelectedCampaignId(campaignData.id)
  }

  // ─── Start editing an existing campaign ──────────────────────────────────
  const startEditing = (id, name) => {
    setEditingId(id)
    setEditingName(name)
    setUpdateError(null)
  }

  // ─── Update campaign name ───────────────────────────────────────────────
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

    setCampaigns(campaigns.map((c) => (c.id === data.id ? data : c)))
    setEditingId(null)
    setEditingName('')
  }

  // ─── Delete a campaign ────────────────────────────────────────────────────
  const deleteCampaign = async (id) => {
    const ok = window.confirm(
      'Are you sure you want to delete this campaign and all its files?'
    )
    if (!ok) return

    // 1) Delete all metadata rows for this campaign first:
    const { error: metaDeleteError } = await supabase
      .from('file_metadata')
      .delete()
      .eq('campaign_id', id)

    if (metaDeleteError) {
      console.error('Failed to delete associated metadata:', metaDeleteError)
      alert('Failed to delete campaign metadata: ' + metaDeleteError.message)
      return
    }

    // 2) Now delete the campaign itself:
    const { error: campaignError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)

    if (campaignError) {
      console.error('Failed to delete campaign:', campaignError)
      alert('Failed to delete campaign: ' + campaignError.message)
      return
    }

    // 3) Update local state, clear selection if needed:
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    if (selectedCampaignId === id) {
      setSelectedCampaignId(null)
      setImmediateUrl('')
      setUploadedPath('')
      setFinalUrl('')
      setCampaignFiles([])
    }
  }

  // ─── Handle file selection ────────────────────────────────────────────────
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null)
  }

  // ─── Upload file to “campaign-files” and insert metadata ─────────────────
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

    // Build a unique storage key under "campaign-files"
    const fileExt = selectedFile.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${session.user.id}/${fileName}`

    // 1) Upload to Supabase Storage → bucket = "campaign-files"
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

    // 2) Generate a public URL to the just‐uploaded file:
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

    setUploadedPath(uploadData.path)

    // 3) Insert metadata into "file_metadata" table:
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
    } else {
      // After a successful upload and metadata insert, re‐fetch the files list:
      fetchFilesForCampaign(selectedCampaignId)
    }
  }

  // ─── On‐demand: call edge function to copy into “campaign-outputs” ─────────
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

    // Once the output is available, re‐fetch the files so the new output link appears:
    fetchFilesForCampaign(selectedCampaignId)
  }

  // ─── Fetch all “input” + “output” URLs for a selected campaign ───────────────
  const fetchFilesForCampaign = async (campaignId) => {
    if (!session || !campaignId) {
      setCampaignFiles([])
      return
    }
    setLoadingFiles(true)
    setFilesError(null)

    // 1) Pull every row in file_metadata for this campaign
    const { data, error } = await supabase
      .from('file_metadata')
      .select('id, file_name, file_type, storage_path')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false }) // assume you have a created_at
                                                 // column in file_metadata

    if (error) {
      console.error('Error fetching campaign files:', error)
      setFilesError(error.message)
      setCampaignFiles([])
      setLoadingFiles(false)
      return
    }

    // 2) For each returned metadata row, generate:
    //    - a public link for the input under "campaign-files"
    //    - a public link for the output under "campaign-outputs" (if it exists)
    const withUrls = await Promise.all(
      data.map(async (row) => {
        // Input URL from campaign-files
        const {
          data: { publicUrl: inputUrl },
        } = supabase
          .storage
          .from('campaign-files')
          .getPublicUrl(row.storage_path)

        // Output URL from campaign-outputs (use the same storage_path key)
        const {
          data: { publicUrl: outputUrl },
        } = supabase
          .storage
          .from('campaign-outputs')
          .getPublicUrl(row.storage_path)

        return {
          id:           row.id,
          file_name:    row.file_name,
          file_type:    row.file_type,
          storage_path: row.storage_path,
          inputUrl,   // always has a link to the just‐uploaded file
          outputUrl,  // may be a 404 if it’s not been generated yet—but showing the URL is okay
        }
      })
    )

    setCampaignFiles(withUrls)
    setLoadingFiles(false)
  }

  // Whenever the selected campaign changes, re‐fetch that campaign’s files:
  useEffect(() => {
    if (selectedCampaignId) {
      fetchFilesForCampaign(selectedCampaignId)
    } else {
      setCampaignFiles([])
    }
  }, [selectedCampaignId, session])

  // ─── Common styles ───────────────────────────────────────────────────────────
  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '1rem',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    padding: '1rem',
    transition: 'box-shadow 0.2s',
  }

  const cardHover = {
    boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
  }

  const selectedBorder = {
    border: `2px solid ${purple}`,
  }

  const buttonBase = {
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  }

  return (
    <div style={{ maxWidth: '768px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Campaign Dashboard
      </h1>

      {/* ─── CAMPAIGN CRUD UI ───────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
          Your Campaigns
        </h2>

        {campaignError && (
          <div
            style={{
              backgroundColor: '#FFD2D2',
              border: '1px solid #FF4C4C',
              color: '#900',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            Error loading campaigns: {campaignError}
          </div>
        )}

        {loadingCampaigns ? (
          <p style={{ color: '#555' }}>Loading campaigns…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {campaigns.length === 0 && (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No campaigns yet.</p>
            )}

            {campaigns.map((c) => {
              const isSelected = selectedCampaignId === c.id
              return (
                <div
                  key={c.id}
                  style={{
                    ...cardStyle,
                    ...(isSelected ? selectedBorder : {}),
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = cardHover.boxShadow
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = cardStyle.boxShadow
                  }}
                >
                  {editingId === c.id ? (
                    // ↳ Editing state
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        style={{
                          flex: 1,
                          border: '1px solid #ccc',
                          borderRadius: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          ...inputFocusStyle,
                        }}
                      />
                      <button
                        onClick={updateCampaign}
                        disabled={updatingCampaign}
                        style={{
                          ...buttonBase,
                          backgroundColor: purple,
                          opacity: updatingCampaign ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = darkerPurple)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = purple)}
                      >
                        {updatingCampaign ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    // ↳ Display state
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500, color: '#333' }}>{c.name}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => startEditing(c.id, c.name)}
                          style={{
                            ...buttonBase,
                            backgroundColor: '#DAA520', // gold-ish for Edit
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCampaign(c.id)}
                          style={{
                            ...buttonBase,
                            backgroundColor: '#E53E3E', // red for Delete
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCampaignId(c.id)
                            setImmediateUrl('')
                            setUploadedPath('')
                            setFinalUrl('')
                            // Clear out the files list before re-fetching
                            setCampaignFiles([])
                          }}
                          style={{
                            ...buttonBase,
                            backgroundColor: isSelected ? darkerPurple : purple,
                            opacity: isSelected ? 0.8 : 1,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = darkerPurple)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = purple)}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  )}

                  {updateError && editingId === c.id && (
                    <p style={{ color: '#E53E3E', marginTop: '0.5rem' }}>{updateError}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Create new campaign */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: 'white',
            borderRadius: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: '#444' }}>
            Create New Campaign
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="New campaign name"
              value={newCampaignName}
              onChange={handleNewCampaignChange}
              style={{
                flex: 1,
                border: '1px solid #ccc',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                ...inputFocusStyle,
              }}
            />
            <button
              onClick={createCampaign}
              disabled={creatingCampaign}
              style={{
                ...buttonBase,
                backgroundColor: creatingCampaign ? '#AAA' : purple,
                cursor: creatingCampaign ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!creatingCampaign) e.currentTarget.style.backgroundColor = darkerPurple
              }}
              onMouseLeave={(e) => {
                if (!creatingCampaign) e.currentTarget.style.backgroundColor = purple
              }}
            >
              {creatingCampaign ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
          {createError && <p style={{ color: '#E53E3E', marginTop: '0.5rem' }}>{createError}</p>}
        </div>
      </section>

      {/* ─── FILE UPLOAD & GENERATE OUTPUT ───────────────────────────────────────────── */}
      {selectedCampaignId && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: '#444' }}>
            Selected Campaign ID:{' '}
            <span style={{ fontFamily: 'monospace', color: purple }}>{selectedCampaignId}</span>
          </h2>

          <div
            style={{
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '1rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              marginBottom: '2rem',
            }}
          >
            {/* File chooser & Upload button */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
              <input
                type="file"
                onChange={handleFileChange}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  ...inputFocusStyle,
                }}
              />
              <button
                onClick={uploadFile}
                disabled={uploading}
                style={{
                  ...buttonBase,
                  backgroundColor: uploading ? '#AAA' : purple,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!uploading) e.currentTarget.style.backgroundColor = darkerPurple
                }}
                onMouseLeave={(e) => {
                  if (!uploading) e.currentTarget.style.backgroundColor = purple
                }}
              >
                {uploading ? 'Uploading…' : 'Upload File'}
              </button>
            </div>
            {insertError && <p style={{ color: '#E53E3E', marginBottom: '1rem' }}>{insertError}</p>}

            {/* Show link to the uploaded file in “campaign-files” */}
            {immediateUrl && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: '#333' }}>
                  Uploaded File Is Live
                </h3>
                <a
                  href={immediateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: purple, textDecoration: 'underline' }}
                >
                  {immediateUrl}
                </a>
              </div>
            )}

            {/* Generate Output button (only after a file is uploaded) */}
            {uploadedPath && (
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={generateOutput}
                  disabled={generating}
                  style={{
                    ...buttonBase,
                    backgroundColor: generating ? '#AAA' : purple,
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!generating) e.currentTarget.style.backgroundColor = darkerPurple
                  }}
                  onMouseLeave={(e) => {
                    if (!generating) e.currentTarget.style.backgroundColor = purple
                  }}
                >
                  {generating ? 'Processing…' : 'Generate Output'}
                </button>
                {generateError && <p style={{ color: '#E53E3E', marginTop: '0.5rem' }}>{generateError}</p>}
              </div>
            )}

            {/* Show link to the processed copy in “campaign-outputs” */}
            {finalUrl && (
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: '#333' }}>
                  Your Final Download
                </h3>
                <a
                  href={finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: purple, textDecoration: 'underline' }}
                >
                  Download Processed File
                </a>
              </div>
            )}
          </div>

          {/* ─── LIST OF ALL INPUTS + OUTPUTS FOR THIS CAMPAIGN ─────────────────────────── */}
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: '#444' }}>
              Files for this Campaign
            </h2>

            {filesError && (
              <div
                style={{
                  backgroundColor: '#FFD2D2',
                  border: '1px solid #FF4C4C',
                  color: '#900',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                Error loading files: {filesError}
              </div>
            )}

            {loadingFiles ? (
              <p style={{ color: '#555' }}>Loading files…</p>
            ) : (
              <>
                {campaignFiles.length === 0 ? (
                  <p style={{ color: '#777', fontStyle: 'italic' }}>
                    No files uploaded for this campaign yet.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {campaignFiles.map((f) => (
                      <li key={f.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500, color: '#333' }}>{f.file_name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* Input link */}
                            <a
                              href={f.inputUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: purple, textDecoration: 'underline', fontSize: '0.9rem' }}
                            >
                              View Input
                            </a>
                            {/* Output link */}
                            <a
                              href={f.outputUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: darkerPurple, textDecoration: 'underline', fontSize: '0.9rem' }}
                            >
                              View Output
                            </a>
                          </div>
                        </div>
                        <div style={{ color: '#555', fontSize: '0.85rem' }}>
                          File type: {f.file_type || '–'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
