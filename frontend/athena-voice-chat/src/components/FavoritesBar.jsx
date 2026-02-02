import React from 'react';

/**
 * Favorites bar component
 *
 * Displays saved favorite queries for quick access.
 */
export default function FavoritesBar({
  favorites,
  onSelect,
  onRemove,
  disabled = false
}) {
  if (!favorites || favorites.length === 0) {
    return null;
  }

  return (
    <div className="favorites-bar">
      <h4 className="favorites-title">Saved queries</h4>
      <div className="favorites-list">
        {favorites.map((fav) => (
          <div key={fav.id} className="favorite-item">
            <button
              className="favorite-btn"
              onClick={() => onSelect(fav.question)}
              disabled={disabled}
              title={fav.question}
            >
              {truncate(fav.question, 40)}
            </button>
            <button
              className="favorite-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(fav.id);
              }}
              title="Remove from favorites"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
