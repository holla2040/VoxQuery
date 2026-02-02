import React from 'react';

/**
 * Mobile bottom tab navigation component
 */
export default function MobileNav({ activeTab, onTabChange, hasResults }) {
  return (
    <nav className="mobile-nav">
      <button
        className={`mobile-nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
        onClick={() => onTabChange('chat')}
      >
        <ChatIcon />
        <span>Chat</span>
      </button>

      <button
        className={`mobile-nav-tab ${activeTab === 'results' ? 'active' : ''}`}
        onClick={() => onTabChange('results')}
      >
        <ResultsIcon />
        <span>Results</span>
        {hasResults && activeTab !== 'results' && (
          <span className="nav-badge" />
        )}
      </button>
    </nav>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </svg>
  );
}

function ResultsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </svg>
  );
}
