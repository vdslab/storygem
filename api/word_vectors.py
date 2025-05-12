import numpy as np
from collections import defaultdict

_word_vectors_cache = {}
_word_frequency_cache = {}

def _load_word_vectors(lang):
    if lang in _word_vectors_cache:
        return _word_vectors_cache[lang]
    
    # サンプルの単語ベクトルを生成（実際の実装では、事前学習済みの単語ベクトルファイルを読み込む）
    vectors = {}
    
    common_words = [
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
        "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
        "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
        "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
        "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
        "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
        "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
        "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
        "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
        "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
        "dog", "cat", "animal", "pet", "wolf", "canine", "breed", "domestic", "species", "human",
        "food", "water", "diet", "eat", "hunt", "prey", "wild", "nature", "environment", "habitat",
        "text", "word", "sentence", "paragraph", "document", "story", "book", "read", "write", "author",
        "visualization", "data", "graph", "chart", "plot", "image", "picture", "display", "show", "view",
        "algorithm", "compute", "calculate", "process", "analyze", "method", "technique", "approach", "system", "model"
    ]

    np.random.seed(42)
    for word in common_words:
        vectors[word] = np.random.randn(300).astype(np.float32)
    
    _word_vectors_cache[lang] = vectors
    return vectors

def _load_word_frequency(lang):
    if lang in _word_frequency_cache:
        return _word_frequency_cache[lang]
    
    frequency = {}
    
    vectors = _load_word_vectors(lang)
    
    np.random.seed(42)
    for i, word in enumerate(vectors.keys()):
        frequency[word] = 1000000 / (i + 100) 
    
    _word_frequency_cache[lang] = frequency
    return frequency

def find_word_vectors(words, lang):
    vectors = _load_word_vectors(lang)
    return [vectors.get(w, np.zeros(300)) for w in words if w in vectors]

def find_word_frequency(words, lang):
    frequency = _load_word_frequency(lang)
    return {w: frequency.get(w, 1.0) for w in words if w in frequency}
