/**
 * VoxQuery Configuration
 */

// Lambda Function URL - update after deployment
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://gfnzz6ybdekl3ngmycq4u2rzx40onfpw.lambda-url.us-west-2.on.aws';

// Feature flags
export const FEATURES = {
  VOICE_INPUT: true,
  CHART_VISUALIZATION: true,
  MAP_VISUALIZATION: true,
  CONVERSATION_HISTORY: true,
  FAVORITES: true,
  CANNED_QUERIES: true,
};

// Conversation settings
export const MAX_CONVERSATION_HISTORY = 5;

// Audio settings
export const AUDIO_CONFIG = {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 16000,
};

// Canned queries for quick access
export const CANNED_QUERIES = [
  {
    label: 'All Employees',
    question: 'Show me all employees',
    icon: '👥',
  },
  {
    label: 'By Department',
    question: 'How many employees are in each department?',
    icon: '📊',
  },
  {
    label: 'Salary Analysis',
    question: 'What is the average salary by department?',
    icon: '💰',
  },
  {
    label: 'Location Map',
    question: 'Show all employees on a map',
    icon: '🗺️',
  },
  {
    label: 'Top Earners',
    question: 'Who are the top 10 highest paid employees?',
    icon: '🏆',
  },
  {
    label: 'Recent Hires',
    question: 'Show employees hired in the last year',
    icon: '🆕',
  },
];
