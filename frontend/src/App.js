import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Upload,
  Sparkles,
  Zap,
  Copy,
  Download,
  Volume2,
  VolumeX,
  Check,
  Clock,
  Tag,
  Sliders,
  History,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import './index.css';

const API_BASE_URL = 'http://localhost:5001/api';

export function App() {
  const [activeInputTab, setActiveInputTab] = useState('upload'); // 'upload' | 'paste'
  const [activeResultTab, setActiveResultTab] = useState('summary'); // 'summary' | 'bullets' | 'takeaways' | 'analytics'
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  
  const [summaryType, setSummaryType] = useState('executive');
  const [length, setLength] = useState('standard');
  const [focusKeyword, setFocusKeyword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('summarizai_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveToHistory = (item) => {
    const updated = [item, ...history.slice(0, 9)]; // Keep last 10
    setHistory(updated);
    localStorage.setItem('summarizai_history', JSON.stringify(updated));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleSummarize = async () => {
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      let res;
      if (activeInputTab === 'upload') {
        if (!selectedFile) {
          setError('Please select a file to summarize.');
          setLoading(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('summary_type', summaryType);
        formData.append('length', length);
        if (focusKeyword.trim()) formData.append('focus_keyword', focusKeyword);
        
        res = await axios.post(`${API_BASE_URL}/summarize`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        if (!pastedText.trim()) {
          setError('Please enter text to summarize.');
          setLoading(false);
          return;
        }

        res = await axios.post(`${API_BASE_URL}/summarize`, {
          text: pastedText,
          filename: 'Pasted Document',
          summary_type: summaryType,
          length,
          focus_keyword: focusKeyword
        });
      }

      if (res.data && res.data.success) {
        setResult(res.data);
        saveToHistory({
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          filename: res.data.filename,
          summaryText: res.data.summaryText,
          stats: res.data.stats
        });
      } else {
        setError(res.data.message || 'Summarization failed.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Server connection error. Ensure Python backend is running on http://localhost:5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/export-txt`, {
        filename: result.filename,
        summaryText: result.summaryText,
        bulletPoints: result.bulletPoints,
        keyInsights: result.keyInsights
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${result.filename}_Summary.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSpeech = () => {
    if (!result || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(result.summaryText);
      utterance.rate = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <div className="app-wrapper">
      {/* Header Bar */}
      <header className="app-header">
        <div className="container nav-container">
          <div className="brand-logo">
            <div className="brand-icon">
              <Sparkles size={22} />
            </div>
            <span>Summariz<span className="gradient-text">AI</span></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="badge-pill badge-live">● Engine Active</span>
            <button 
              className="btn-action"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History size={16} /> History ({history.length})
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="hero-section">
        <h1 className="hero-title">
          Distill Complex Documents into <span className="gradient-text">Instant Clarity</span>
        </h1>
        <p className="hero-subtitle">
          AI-powered document summarizer for PDF, TXT, and DOCX files. Get executive summaries, high-impact bullet points, and key takeaways in seconds.
        </p>
      </section>

      <main className="container">
        {/* Main 2-Column Grid */}
        <div className="main-grid">
          {/* Left Panel: Input & Controls */}
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <FileText size={18} color="var(--primary-indigo)" /> Document Input
              </div>
              <div className="tab-group">
                <button
                  className={`tab-btn ${activeInputTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setActiveInputTab('upload')}
                >
                  <Upload size={14} /> Upload File
                </button>
                <button
                  className={`tab-btn ${activeInputTab === 'paste' ? 'active' : ''}`}
                  onClick={() => setActiveInputTab('paste')}
                >
                  <FileText size={14} /> Paste Text
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {activeInputTab === 'upload' ? (
                <div
                  className="dropzone"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.txt,.docx,.doc,.md"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div className="dropzone-icon">
                    {selectedFile ? <FileCheck size={28} color="var(--accent-emerald)" /> : <Upload size={28} />}
                  </div>
                  {selectedFile ? (
                    <div>
                      <h4 style={{ color: 'var(--accent-emerald)', fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                        {selectedFile.name}
                      </h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                        Drop your document here, or <span className="gradient-text">browse</span>
                      </h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Supports PDF, TXT, DOCX, MD (Max 25MB)
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    className="text-input-area"
                    placeholder="Paste full text or document content here to summarize..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Words: {pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0}</span>
                    <span>Chars: {pastedText.length}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="controls-grid">
              <div className="control-item">
                <label><Sliders size={12} /> Summary Mode</label>
                <select
                  className="select-input"
                  value={summaryType}
                  onChange={(e) => setSummaryType(e.target.value)}
                >
                  <option value="executive">Executive Summary</option>
                  <option value="bullet_points">Key Bullet Points</option>
                  <option value="detailed">Comprehensive Analysis</option>
                </select>
              </div>

              <div className="control-item">
                <label><Clock size={12} /> Target Length</label>
                <select
                  className="select-input"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                >
                  <option value="concise">Concise (~15%)</option>
                  <option value="standard">Standard (~30%)</option>
                  <option value="detailed">Detailed (~50%)</option>
                </select>
              </div>

              <div className="control-item">
                <label><Tag size={12} /> Focus Topic (Optional)</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Revenue, Risk"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div style={{ margin: '1rem 1.25rem 0', padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div style={{ padding: '1.25rem' }}>
              <button
                className="btn-primary"
                onClick={handleSummarize}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner" /> Analyzing & Summarizing...
                  </>
                ) : (
                  <>
                    <Zap size={18} /> Generate AI Summary
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Output & Analytics */}
          <div className={`glass-panel ${result ? 'glass-panel-glow' : ''}`}>
            <div className="panel-header">
              <div className="panel-title">
                <Sparkles size={18} color="var(--primary-cyan)" /> AI Summary Output
              </div>
              {result && (
                <div className="action-bar">
                  <button className="btn-action" onClick={handleCopy} title="Copy Summary">
                    {copied ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button className="btn-action" onClick={handleDownload} title="Export TXT">
                    <Download size={14} /> Export
                  </button>
                  <button className="btn-action" onClick={handleToggleSpeech} title="Read Aloud">
                    {isSpeaking ? <VolumeX size={14} color="var(--accent-amber)" /> : <Volume2 size={14} />}
                    {isSpeaking ? 'Stop' : 'Listen'}
                  </button>
                </div>
              )}
            </div>

            <div className="summary-content">
              {!result && !loading && (
                <div style={{ height: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <FileText size={32} color="var(--text-dim)" />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Summary Generated Yet</h3>
                  <p style={{ fontSize: '0.9rem', maxWidth: '340px' }}>Upload a PDF/TXT document or paste text on the left panel, then click "Generate AI Summary".</p>
                </div>
              )}

              {loading && (
                <div style={{ height: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-indigo)' }}>
                  <div className="spinner" style={{ width: 36, height: 36, borderWidth: 4, marginBottom: '1.25rem' }} />
                  <p style={{ fontWeight: 600, fontSize: '1rem' }}>Parsing text semantics & ranking key sentences...</p>
                </div>
              )}

              {result && (
                <div>
                  {/* Results Sub-Tabs */}
                  <div className="tab-group" style={{ marginBottom: '1.25rem' }}>
                    <button
                      className={`tab-btn ${activeResultTab === 'summary' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('summary')}
                    >
                      Summary
                    </button>
                    <button
                      className={`tab-btn ${activeResultTab === 'bullets' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('bullets')}
                    >
                      Bullets ({result.bulletPoints?.length || 0})
                    </button>
                    <button
                      className={`tab-btn ${activeResultTab === 'takeaways' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('takeaways')}
                    >
                      Key Takeaways
                    </button>
                  </div>

                  {/* Summary Text View */}
                  {activeResultTab === 'summary' && (
                    <div className="summary-text">
                      {result.summaryText}
                    </div>
                  )}

                  {/* Bullets View */}
                  {activeResultTab === 'bullets' && (
                    <div className="bullet-list">
                      {result.bulletPoints.map((bp, idx) => (
                        <div key={idx} className="bullet-item">
                          <div className="bullet-dot" />
                          <span>{bp.replace(/^•\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Takeaways View */}
                  {activeResultTab === 'takeaways' && (
                    <div>
                      {result.keyInsights.map((ki, idx) => (
                        <div key={idx} className="takeaway-card">
                          <Zap size={16} color="var(--primary-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{ki}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Keywords Tag Cloud */}
                  {result.keywords && result.keywords.length > 0 && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Top Extracted Entities & Keywords
                      </div>
                      <div>
                        {result.keywords.map((kw, i) => (
                          <span key={i} className="keyword-tag">
                            #{kw.keyword} <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({kw.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats Cards */}
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-lbl">Original Words</div>
                      <div className="stat-val">{result.stats.originalWordCount}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-lbl">Summary Words</div>
                      <div className="stat-val" style={{ color: 'var(--primary-cyan)' }}>{result.stats.summaryWordCount}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-lbl">Time Saved</div>
                      <div className="stat-val" style={{ color: 'var(--accent-emerald)' }}>{result.stats.timeSavedPercent}%</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-lbl">Tone</div>
                      <div className="stat-val" style={{ fontSize: '0.95rem', marginTop: '0.5rem', color: 'var(--primary-indigo)' }}>
                        {result.sentiment?.sentiment || 'Neutral'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Modal / Drawer */}
        {showHistory && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '3rem' }}>
            <div className="panel-header" style={{ padding: '0 0 1rem 0' }}>
              <div className="panel-title">
                <History size={18} color="var(--primary-indigo)" /> Recent Summaries History
              </div>
              <button className="btn-action" onClick={() => setShowHistory(false)}>Close</button>
            </div>
            {history.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No recent summaries stored in browser history.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {history.map((item) => (
                  <div key={item.id} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary-cyan)' }}>{item.filename}</span>
                      <span>{item.timestamp}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineClamp: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                      {item.summaryText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
