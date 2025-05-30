import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CampaignDashboard from './CampaignDashboard'

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Check initial session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth state changes (login, logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Cleanup listener on component unmount
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="App">
      {session ? (
  <>
    <button onClick={() => supabase.auth.signOut()}>Log Out</button>
    <CampaignDashboard session={session} />
  </>
) : (
  <Auth />
)}
    </div>
  )
}
// Test commit by Shane
export default App