import { useState, useCallback } from 'react';
import { MAX_CONVERSATION_HISTORY } from '../config';

/**
 * Custom hook for managing conversation history
 *
 * Tracks exchanges for contextual queries and provides
 * methods to add, clear, and format history for API requests.
 */
export default function useConversationHistory(maxSize = MAX_CONVERSATION_HISTORY) {
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);

  /**
   * Add a new exchange to history
   */
  const addExchange = useCallback((question, sql, summary = null) => {
    setHistory(prev => {
      const newHistory = [...prev, { question, sql, summary }];
      // Keep only the most recent exchanges
      return newHistory.slice(-maxSize);
    });
  }, [maxSize]);

  /**
   * Add a user message to the chat
   */
  const addUserMessage = useCallback((content) => {
    setMessages(prev => [...prev, {
      type: 'user',
      content,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  /**
   * Add an assistant message to the chat
   */
  const addAssistantMessage = useCallback((content) => {
    setMessages(prev => [...prev, {
      type: 'assistant',
      content,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  /**
   * Add an error message to the chat
   */
  const addErrorMessage = useCallback((content) => {
    setMessages(prev => [...prev, {
      type: 'error',
      content: `Error: ${content}`,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  /**
   * Clear all history and messages
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setMessages([]);
  }, []);

  /**
   * Get history formatted for API request
   */
  const getHistoryForApi = useCallback(() => {
    return history.map(({ question, sql }) => ({
      question,
      sql
    }));
  }, [history]);

  /**
   * Check if conversation has any history
   */
  const hasHistory = history.length > 0;

  /**
   * Get the number of exchanges
   */
  const exchangeCount = history.length;

  return {
    // State
    history,
    messages,
    hasHistory,
    exchangeCount,

    // Actions
    addExchange,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    clearHistory,
    getHistoryForApi
  };
}
