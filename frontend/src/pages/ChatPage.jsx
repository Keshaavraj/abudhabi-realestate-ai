import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaPaperPlane, FaImage, FaTrash, FaHome, FaStop, FaTachometerAlt, FaPlay, FaPause, FaMicrophone, FaBolt } from 'react-icons/fa';
import './ChatPage.css';

const GROQ_API_KEY  = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_BASE     = 'https://api.groq.com/openai/v1';
const BACKEND_URL   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/** Fetch live ADREC market context from the backend (silent fallback if unavailable). */
async function fetchAdrecContext() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/adrec-context`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.available ? data.context : null;
  } catch {
    return null; // backend not running (e.g. GitHub Pages) — graceful fallback
  }
}

function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSpeed, setVoiceSpeed] = useState(1.4);
  const [metrics, setMetrics] = useState({
    lastResponseTime: 0,
    avgResponseTime: 0,
    totalTokens: 0,
    messagesCount: 0
  });

  const [audioSrc, setAudioSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const utteranceRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const stopCurrentAudio = () => {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setAudioSrc(null);
    setIsPlaying(false);
  };

  const toggleAudio = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    }
  };

  const abortOngoingRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Resize image to max 512px before upload to speed up LLaVA
  const resizeImage = (file, maxPx = 512) => new Promise((resolve) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    };
    img.src = url;
  });

  // Consume an SSE stream and call onToken for each token; returns full content
  const readSSEStream = async (response, onToken) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) {
            fullContent += token;
            onToken(fullContent);
          }
        } catch (_) {}
      }
    }
    return fullContent;
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    if (isLoading) return;

    stopCurrentAudio();
    abortOngoingRequest();

    abortControllerRef.current = new AbortController();

    const userMessage = {
      role: 'user',
      content: inputText,
      image: selectedImage ? URL.createObjectURL(selectedImage) : null
    };

    const messageText = inputText;
    const messageImage = selectedImage;

    setInputText('');
    setSelectedImage(null);
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const startTime = Date.now();

    try {
      let fullContent = '';

      // Add empty assistant message — works for both text and image
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const onToken = (content) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content };
          return updated;
        });
      };

      if (messageImage) {
        // Resize image, convert to base64, then stream via GROQ vision
        const resized = await resizeImage(messageImage);
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(resized);
        });

        const response = await fetch(`${GROQ_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: `You are a specialized Abu Dhabi real estate assistant. Only analyze images related to real estate (properties, buildings, interiors, land, or neighborhoods in Abu Dhabi). If the image is not real estate related, politely decline and ask for a property image instead.\n\nFor real estate images, provide professional analysis covering: property type, estimated location in Abu Dhabi if recognizable, condition, notable features, and market relevance.\n\nCite sources inline:\n- Transaction data & price indices → ADREC (https://adrec.gov.ae/en/property_and_index/adrec-dashboard)\n- Listing prices & rental rates → PropertyFinder (https://www.propertyfinder.ae)\n- Cost of living & quality-of-life context → Numbeo (https://www.numbeo.com/property-investment/country_result.jsp?country=United+Arab+Emirates)\n\nFormat: (Source: [Name] — [URL])\n\nUser query: ${messageText || 'Describe this property'}` },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
              ]
            }],
            stream: true
          }),
          signal: abortControllerRef.current.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        fullContent = await readSSEStream(response, onToken);
      } else {
        // Fetch live ADREC data to ground the response (non-blocking — fallback if unavailable)
        const adrecContext = await fetchAdrecContext();

        // Text chat — SSE streaming via GROQ
        const response = await fetch(`${GROQ_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [
              {
                role: 'system',
                content: `You are a specialized Abu Dhabi real estate assistant. You ONLY respond to questions about Abu Dhabi real estate — property buying, selling, renting, investing, pricing, neighborhoods, communities, legal processes, fees, and market trends.

If the user asks anything unrelated to Abu Dhabi real estate, respond exactly: "I'm specialized in Abu Dhabi real estate only. Please ask me about properties, prices, neighborhoods, or the Abu Dhabi market."

Always cite your data sources inline using the following references:

1. ADREC (Abu Dhabi Real Estate Centre) — https://adrec.gov.ae/en/property_and_index/adrec-dashboard
   Use for: official transaction volumes, registered sales, price per sqm indices, mortgage data, and government-verified market statistics.

2. PropertyFinder — https://www.propertyfinder.ae
   Use for: current listing prices, rental rates, available units, and neighborhood-level supply/demand.

3. Numbeo — https://www.numbeo.com/property-investment/country_result.jsp?country=United+Arab+Emirates
   Use for: cost of living context, rent-to-income ratios, and quality-of-life metrics that affect property decisions.

Format citations as: (Source: [Name] — [URL])
Example: "Average rent in Al Reem Island for a 1BR is AED 70,000–90,000/year (Source: PropertyFinder — https://www.propertyfinder.ae)"

Be professional, accurate, and always cite the relevant source when using market figures.${adrecContext ? `\n\n${adrecContext}` : ''}`
              },
              { role: 'user', content: messageText }
            ],
            stream: true
          }),
          signal: abortControllerRef.current.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        fullContent = await readSSEStream(response, onToken);
      }

      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: fullContent, responseTime };
        return updated;
      });
      const tokenEstimate = fullContent.split(' ').length * 1.3;
      setMetrics(prev => ({
        lastResponseTime: responseTime,
        avgResponseTime: ((prev.avgResponseTime * prev.messagesCount) + responseTime) / (prev.messagesCount + 1),
        totalTokens: prev.totalTokens + Math.round(tokenEstimate),
        messagesCount: prev.messagesCount + 1
      }));

      // Unblock UI before TTS
      setIsLoading(false);

      // Text-to-speech via browser Web Speech API — no API key, no CORS issues
      if (voiceEnabled && fullContent && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          // Strip markdown symbols before speaking
          const ttsText = fullContent.replace(/[#*`>\[\]_~]/g, '').slice(0, 300);
          const utterance = new SpeechSynthesisUtterance(ttsText);
          utterance.rate = voiceSpeed;
          utterance.lang = 'en-US';
          utterance.onstart = () => { setIsPlaying(true); setAudioSrc('active'); };
          utterance.onend = () => { setIsPlaying(false); setAudioSrc(null); };
          utterance.onerror = () => { setIsPlaying(false); setAudioSrc(null); };
          utteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        } catch (ttsError) {
          console.error('TTS Error:', ttsError);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        console.log('Request canceled');
        return;
      }

      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request.'
      }]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
    }
  };

  const clearChat = () => {
    stopCurrentAudio();
    abortOngoingRequest();
    setMessages([]);
    setSelectedImage(null);
    setMetrics({
      lastResponseTime: 0,
      avgResponseTime: 0,
      totalTokens: 0,
      messagesCount: 0
    });
  };


  return (
    <div className="chat-page">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <h2>🏠 Real Estate AI</h2>
          <div className="sidebar-header-btns">
            <button className="home-btn" onClick={() => navigate('/')}>
              <FaHome /> Home
            </button>
            <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
        </div>

        <div className="metrics-panel">
          <h3>📊 Performance Metrics</h3>
          <div className="metric-item">
            <span className="metric-label">Last Response</span>
            <span className="metric-value">{metrics.lastResponseTime.toFixed(2)}s</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Avg Response</span>
            <span className="metric-value">{metrics.avgResponseTime.toFixed(2)}s</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Total Tokens</span>
            <span className="metric-value">{metrics.totalTokens}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Messages</span>
            <span className="metric-value">{metrics.messagesCount}</span>
          </div>
        </div>

        <div className="model-info">
          <h3>Active Models</h3>
          {[
            { name: 'GPT-OSS 20B',       type: 'Text Chat'       },
            { name: 'Llama 4 Scout 17B', type: 'Vision'          },
            { name: 'Browser TTS',       type: 'Text-to-Speech'  },
          ].map((m) => (
            <div key={m.name} className="model-card">
              <span className="model-card-dot" />
              <div>
                <div className="model-name">{m.name}</div>
                <div className="model-type">{m.type}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-options">
          <button className="option-btn" onClick={() => fileInputRef.current.click()}>
            <FaImage /> Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />

          <div className="voice-controls">
            <h4>🔊 Voice Controls</h4>

            <div className="toggle-option">
              <label>
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => setVoiceEnabled(e.target.checked)}
                />
                Enable Voice
              </label>
            </div>

            <div className="speed-control">
              <label>Speed: {voiceSpeed}x</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={voiceSpeed}
                onChange={(e) => {
                  const s = parseFloat(e.target.value);
                  setVoiceSpeed(s);
                }}
              />
            </div>

            {audioSrc && (
              <div className="audio-controls">
                <button className="control-btn" onClick={toggleAudio}>
                  {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                <button className="control-btn" onClick={stopCurrentAudio}>
                  <FaStop />
                </button>
              </div>
            )}
          </div>

          <button className="option-btn danger" onClick={clearChat}>
            <FaTrash /> Clear Chat
          </button>
        </div>

        {selectedImage && (
          <div className="selected-image-preview">
            <p>Selected Image:</p>
            <img src={URL.createObjectURL(selectedImage)} alt="Selected" />
            <button onClick={() => setSelectedImage(null)}>Remove</button>
          </div>
        )}
      </div>

      <div className="main-chat">
        <div className="chat-header">
          <div className="chat-header-left">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <div>
              <h1>Abu Dhabi Real Estate Assistant</h1>
              <p>Ask about properties, prices, locations, and more!</p>
            </div>
          </div>
          <div className="header-status">
            <span className="status-dot"></span>
            <span>Models Active</span>
          </div>
        </div>

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <div className="welcome-icon">🏙️</div>
              <h2>Abu Dhabi Real Estate AI</h2>
              <p>Ask about properties, prices, neighbourhoods, or upload an image</p>
              <div className="quick-actions">
                <h3>Try asking</h3>
                {[
                  { e: '🏘️', q: 'What are the best neighborhoods in Abu Dhabi?' },
                  { e: '💰', q: 'What is the average rent in Al Reem Island?' },
                  { e: '🏎️', q: 'Tell me about properties near Ferrari World' },
                  { e: '🌊', q: 'Luxury apartments with sea view on the Corniche' },
                  { e: '📈', q: 'Best areas for property investment in Abu Dhabi' },
                ].map(({ e, q }) => (
                  <button key={q} onClick={() => setInputText(q)}>{e} {q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="msg-avatar">{msg.role === 'user' ? '👤' : '🏙️'}</div>
              <div className="message-content">
                {msg.image && <img src={msg.image} alt="Uploaded" className="message-image" />}
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
                {msg.responseTime && (
                  <div className="message-meta">
                    <FaBolt size={10} />
                    <span>{msg.responseTime.toFixed(2)}s</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message assistant">
              <div className="msg-avatar">🏙️</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about properties, prices, locations..."
            disabled={isLoading}
          />
          <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && !selectedImage)}>
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
