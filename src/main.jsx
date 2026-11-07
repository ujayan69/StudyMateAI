
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import Auth from './Auth';
import { supabase } from './supabase';

import './index.css';

function Main() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error:', error.message);
      }

      if (mounted) {
        setSession(data?.session ?? null);
        setLoading(false);
      }
    }

    checkSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#100b20',
          color: 'white',
          fontSize: '18px'
        }}
      >
        Loading StudyMate AI...
      </div>
    );
  }

  return session ? <App /> : <Auth />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
);
