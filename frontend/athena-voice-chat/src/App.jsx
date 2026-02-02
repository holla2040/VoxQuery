import React, { useState, useCallback } from 'react';
import ChatPanel from './components/ChatPanel';
import ChatInput from './components/ChatInput';
import ResultsPanel from './components/ResultsPanel';
import MapResult from './components/MapResult';
import ChartResult from './components/ChartResult';
import SurfaceResult from './components/SurfaceResult';
import PTTButton from './components/PTTButton';
import { sendTextQuery, sendVoiceQuery } from './services/api';
import { MAX_CONVERSATION_HISTORY } from './config';
import './App.css';

/**
 * Main application component
 */
function App() {
  // State
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [resultHistory, setResultHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [queryHistory, setQueryHistory] = useState([]);

  // Add query to history (avoid consecutive duplicates)
  const addToQueryHistory = useCallback((query) => {
    setQueryHistory(prev => {
      if (prev.length === 0 || prev[0] !== query) {
        return [query, ...prev];
      }
      return prev;
    });
  }, []);

  // Handle text query submission
  const handleSubmit = useCallback(async (question) => {
    setLoading(true);
    setError(null);

    // Add user message to chat
    const userMessage = {
      type: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Send query to backend
      const response = await sendTextQuery(question, conversationHistory);

      if (response.success) {
        // Append to result history
        setResultHistory(prev => [...prev, {
          ...response,
          query: question,
          timestamp: new Date().toISOString()
        }]);

        // Add assistant message with summary
        const assistantMessage = {
          type: 'assistant',
          content: response.summary || `Found ${response.row_count} results.`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Update conversation history
        const newHistory = [
          ...conversationHistory,
          { question, sql: response.sql }
        ].slice(-MAX_CONVERSATION_HISTORY);
        setConversationHistory(newHistory);
      } else {
        throw new Error(response.error || 'Query failed');
      }
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        type: 'error',
        content: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [conversationHistory]);

  // Handle follow-up question click
  const handleFollowUpClick = useCallback((question) => {
    handleSubmit(question);
  }, [handleSubmit]);

  // Clear conversation and start fresh
  const handleClearHistory = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    setResultHistory([]);
    setError(null);
  }, []);

  // Handle voice recording completion
  const handleRecordingComplete = useCallback(async (audioData) => {
    setIsTranscribing(true);
    setLoading(true);
    setError(null);

    try {
      // Send voice query to backend (transcribes and executes in one call)
      const response = await sendVoiceQuery(audioData.base64, conversationHistory, audioData.mimeType);

      if (response.success) {
        // Add user message with transcript
        const userMessage = {
          type: 'user',
          content: `🎤 ${response.transcript}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);

        // Append to result history
        setResultHistory(prev => [...prev, {
          ...response,
          query: response.transcript,
          timestamp: new Date().toISOString()
        }]);

        // Add assistant message
        const assistantMessage = {
          type: 'assistant',
          content: response.summary || `Found ${response.row_count} results.`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Update conversation history
        const newHistory = [
          ...conversationHistory,
          { question: response.transcript, sql: response.sql }
        ].slice(-MAX_CONVERSATION_HISTORY);
        setConversationHistory(newHistory);
      } else {
        throw new Error(response.error || 'Voice query failed');
      }
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        type: 'error',
        content: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTranscribing(false);
      setLoading(false);
    }
  }, [conversationHistory]);

  return (
    <div className="app">
      <div className="app-container">
        {/* Chat Panel - Left side */}
        <ChatPanel
          messages={messages}
          onClearHistory={handleClearHistory}
          onSubmit={handleSubmit}
          onAddToHistory={addToQueryHistory}
        >
          <ChatInput
            onSubmit={handleSubmit}
            disabled={loading || isTranscribing}
            placeholder="Ask a question about employees..."
            queryHistory={queryHistory}
            onAddToHistory={addToQueryHistory}
            /* Voice button temporarily disabled
            voiceButton={
              <PTTButton
                onRecordingComplete={handleRecordingComplete}
                disabled={loading || isTranscribing}
              />
            }
            */
          />
        </ChatPanel>

        {/* Results Panel - Right side */}
        <ResultsPanel
          resultHistory={resultHistory}
          loading={loading}
          error={error}
          MapResult={MapResult}
          ChartResult={ChartResult}
          SurfaceResult={SurfaceResult}
        />
      </div>
    </div>
  );
}

export default App;
