"""
Conversation context management for multi-turn queries.
Formats conversation history for inclusion in Bedrock prompts.
"""

from typing import List, Dict, Optional

# Maximum number of exchanges to include
MAX_HISTORY_SIZE = 5


class ConversationContext:
    """Manages conversation history for contextual queries."""

    def __init__(self, max_size: int = MAX_HISTORY_SIZE):
        self.max_size = max_size
        self.history: List[Dict] = []

    def add_exchange(self, question: str, sql: str, summary: str = None):
        """
        Add a question/answer exchange to history.

        Args:
            question: The user's question
            sql: The generated SQL query
            summary: Optional summary of results
        """
        exchange = {
            "question": question,
            "sql": sql,
            "summary": summary
        }
        self.history.append(exchange)

        # Trim to max size
        if len(self.history) > self.max_size:
            self.history = self.history[-self.max_size:]

    def clear(self):
        """Clear all conversation history."""
        self.history = []

    def format_for_prompt(self) -> str:
        """
        Format conversation history for inclusion in a Bedrock prompt.

        Returns:
            Formatted string of previous exchanges
        """
        if not self.history:
            return ""

        lines = ["Previous conversation:"]

        for i, exchange in enumerate(self.history, 1):
            lines.append(f"\n[Exchange {i}]")
            lines.append(f"User: {exchange['question']}")
            lines.append(f"SQL: {exchange['sql']}")
            if exchange.get('summary'):
                lines.append(f"Result: {exchange['summary']}")

        lines.append("\n")
        lines.append("Use this context to understand references like:")
        lines.append("- 'that', 'those', 'them' → refer to results from previous query")
        lines.append("- 'filter further', 'narrow down' → add WHERE conditions to previous query")
        lines.append("- 'sort by', 'order by' → modify ORDER BY of previous query")
        lines.append("- 'now show', 'what about' → may be building on previous context")

        return "\n".join(lines)

    def to_list(self) -> List[Dict]:
        """Return history as list for JSON serialization."""
        return self.history.copy()

    @classmethod
    def from_list(cls, history_list: List[Dict], max_size: int = MAX_HISTORY_SIZE):
        """
        Create ConversationContext from a list of exchanges.

        Args:
            history_list: List of exchange dicts
            max_size: Maximum history size

        Returns:
            ConversationContext instance
        """
        context = cls(max_size=max_size)
        for exchange in history_list[-max_size:]:
            context.history.append({
                "question": exchange.get("question", ""),
                "sql": exchange.get("sql", ""),
                "summary": exchange.get("summary")
            })
        return context


def format_history_for_prompt(conversation_history: List[Dict]) -> str:
    """
    Utility function to format conversation history for Bedrock prompt.

    Args:
        conversation_history: List of previous exchanges

    Returns:
        Formatted context string
    """
    if not conversation_history:
        return ""

    context = ConversationContext.from_list(conversation_history)
    return context.format_for_prompt()


def detect_contextual_reference(question: str) -> Dict:
    """
    Detect if a question contains references to previous context.

    Args:
        question: The user's question

    Returns:
        Dict with:
            - has_reference: Whether the question refers to previous context
            - reference_type: Type of reference (pronoun, modifier, continuation)
            - keywords: List of detected reference keywords
    """
    question_lower = question.lower()

    # Pronouns referring to previous results
    pronouns = ['that', 'those', 'them', 'these', 'it', 'this']

    # Modifiers that build on previous query
    modifiers = ['further', 'more', 'also', 'additionally', 'but', 'except',
                 'only', 'just', 'instead', 'rather']

    # Continuation phrases
    continuations = ['now show', 'now filter', 'what about', 'how about',
                     'can you also', 'sort by', 'order by', 'group by',
                     'limit to', 'narrow down', 'expand to']

    detected = {
        "has_reference": False,
        "reference_type": None,
        "keywords": []
    }

    # Check for pronouns
    for pronoun in pronouns:
        if f" {pronoun} " in f" {question_lower} " or question_lower.startswith(f"{pronoun} "):
            detected["has_reference"] = True
            detected["reference_type"] = "pronoun"
            detected["keywords"].append(pronoun)

    # Check for modifiers
    for modifier in modifiers:
        if modifier in question_lower:
            detected["has_reference"] = True
            detected["reference_type"] = detected["reference_type"] or "modifier"
            detected["keywords"].append(modifier)

    # Check for continuation phrases
    for phrase in continuations:
        if phrase in question_lower:
            detected["has_reference"] = True
            detected["reference_type"] = "continuation"
            detected["keywords"].append(phrase)

    return detected
