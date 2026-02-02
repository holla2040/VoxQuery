import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'voxquery_favorites';
const MAX_FAVORITES = 20;

/**
 * Custom hook for managing favorite queries
 *
 * Stores favorites in localStorage with a maximum limit.
 */
export default function useFavorites() {
  const [favorites, setFavorites] = useState([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  }, []);

  /**
   * Add a query to favorites
   */
  const addFavorite = useCallback((question) => {
    setFavorites(prev => {
      // Don't add duplicates
      if (prev.some(f => f.question === question)) {
        return prev;
      }

      const newFavorite = {
        id: Date.now(),
        question,
        createdAt: new Date().toISOString()
      };

      const newFavorites = [newFavorite, ...prev].slice(0, MAX_FAVORITES);
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, [saveFavorites]);

  /**
   * Remove a query from favorites
   */
  const removeFavorite = useCallback((id) => {
    setFavorites(prev => {
      const newFavorites = prev.filter(f => f.id !== id);
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, [saveFavorites]);

  /**
   * Check if a question is in favorites
   */
  const isFavorite = useCallback((question) => {
    return favorites.some(f => f.question === question);
  }, [favorites]);

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback((question) => {
    const existing = favorites.find(f => f.question === question);
    if (existing) {
      removeFavorite(existing.id);
    } else {
      addFavorite(question);
    }
  }, [favorites, addFavorite, removeFavorite]);

  /**
   * Clear all favorites
   */
  const clearFavorites = useCallback(() => {
    saveFavorites([]);
  }, [saveFavorites]);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    hasFavorites: favorites.length > 0
  };
}
