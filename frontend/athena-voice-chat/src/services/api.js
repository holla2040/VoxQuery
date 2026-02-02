/**
 * API service for VoxQuery backend
 */

import { API_BASE_URL } from '../config';

/**
 * Send a text query to the backend
 * @param {string} question - The natural language question
 * @param {Array} conversationHistory - Previous conversation exchanges
 * @returns {Promise<Object>} Query results
 */
export async function sendTextQuery(question, conversationHistory = []) {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      conversation_history: conversationHistory,
      new_chat: conversationHistory.length === 0,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Send a voice query to the backend
 * @param {string} audioBase64 - Base64 encoded audio data
 * @param {Array} conversationHistory - Previous conversation exchanges
 * @param {string} mimeType - Audio mime type (e.g., 'audio/webm;codecs=opus')
 * @returns {Promise<Object>} Query results with transcript
 */
export async function sendVoiceQuery(audioBase64, conversationHistory = [], mimeType = 'audio/webm') {
  const response = await fetch(`${API_BASE_URL}/voice-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_data: audioBase64,
      audio_format: mimeType,
      conversation_history: conversationHistory,
      new_chat: conversationHistory.length === 0,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get table schema for autocomplete
 * @returns {Promise<Object>} Schema information
 */
export async function getSchema() {
  const response = await fetch(`${API_BASE_URL}/schema`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch schema');
  }

  return response.json();
}

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
  });

  return response.json();
}
