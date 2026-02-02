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
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

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
        // Update result
        setResult(response);

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
    setResult(null);
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

        // Update result
        setResult(response);

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
        >
          <ChatInput
            onSubmit={handleSubmit}
            disabled={loading || isTranscribing}
            placeholder="Ask a question about employees..."
            voiceButton={
              <PTTButton
                onRecordingComplete={handleRecordingComplete}
                disabled={loading || isTranscribing}
              />
            }
          />
        </ChatPanel>

        {/* Results Panel - Right side */}
        <ResultsPanel
          result={result}
          loading={loading}
          error={error}
          summary={result?.summary}
          followUps={result?.follow_ups}
          onFollowUpClick={handleFollowUpClick}
          mapComponent={
            result?.visualization_type === 'MAP' && (
              <MapResult
                rows={result.rows}
                mapConfig={result.map_config}
              />
            )
          }
          chartComponent={
            result?.visualization_type === 'CHART' && (
              <ChartResult
                rows={result.rows}
                columns={result.columns}
                chartConfig={result.chart_config}
              />
            )
          }
          surfaceComponent={
            result?.visualization_type === 'SURFACE' && (
              <SurfaceResult
                surfaceConfig={result.surface_config}
              />
            )
          }
        />
      </div>
    </div>
  );
}

export default App;
