
import { useState } from 'react';
import { supabase } from './supabase';
import './Auth.css';

export default function Auth() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        setMessage(
          data.session
            ? 'Account created successfully!'
            : 'Account created. Check your email to confirm your account.'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) setMessage(error.message);
  }

  async function handlePasswordReset() {
    if (!email) {
      setMessage('Enter your email address first.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    });

    setMessage(
      error ? error.message : 'Password reset link sent. Check your email.'
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>StudyMate AI</h1>
        <p className="auth-subtitle">Your personal AI study companion</p>

        <h2>{mode === 'signup' ? 'Create Account' : 'Welcome Back'}</h2>
        <p className="auth-description">
          {mode === 'signup'
            ? 'Create an account to get started.'
            : 'Sign in to continue learning.'}
        </p>

        <form onSubmit={handleSubmit}>
          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            minLength={6}
            required
          />

          {mode === 'signin' && (
            <button
              type="button"
              className="forgot-button"
              onClick={handlePasswordReset}
            >
              Forgot password?
            </button>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'signup'
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">OR</div>

        <button className="google-button" onClick={handleGoogleLogin}>
          Continue with Google
        </button>

        {message && <p className="auth-message">{message}</p>}

        <p className="auth-switch">
          {mode === 'signup'
            ? 'Already have an account?'
            : "Don't have an account?"}{' '}
          <button
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setMessage('');
            }}
          >
            {mode === 'signup' ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
