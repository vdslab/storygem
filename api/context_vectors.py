import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict
import word_vectors as wv

def compute_context_vectors(words, text, window_size=5):
    word_positions = defaultdict(list)
    words_set = set(words)
    
    tokens = text.split()
    
    for i, token in enumerate(tokens):
        if token.lower() in words_set:
            word_positions[token.lower()].append(i)
    
    vectors_dict = wv._load_word_vectors('en')
    word_vectors = {w: vectors_dict.get(w, np.zeros(300)) for w in words_set}
    
    context_vectors = {}
    for word in words_set:
        if word in word_positions and word in word_vectors:
            context_vector = np.zeros_like(word_vectors[word])
            count = 0
            
            for pos in word_positions[word]:
                start = max(0, pos - window_size)
                end = min(len(tokens), pos + window_size + 1)
                
                for i in range(start, end):
                    if i != pos and tokens[i].lower() in word_vectors:
                        context_vector += word_vectors[tokens[i].lower()]
                        count += 1
            
            if count > 0:
                context_vector /= count
                context_vectors[word] = context_vector
    
    return context_vectors

def compute_contextual_distance(word1, word2, context_vectors):
    if word1 in context_vectors and word2 in context_vectors:
        similarity = cosine_similarity(
            context_vectors[word1].reshape(1, -1),
            context_vectors[word2].reshape(1, -1)
        )[0][0]
        
        if similarity <= 0:
            return 10.0
        
        return 1.0 / similarity
    
    return 10.0

def build_temporal_graph(words, text, context_vectors, n_neighbors=10):
    word_order = {}
    words_set = set(words)
    
    tokens = text.split()
    
    for i, token in enumerate(tokens):
        if token.lower() in words_set and token.lower() not in word_order:
            word_order[token.lower()] = i
    
    distances = {}
    for i, word1 in enumerate(words):
        if word1 not in context_vectors:
            continue
        
        for word2 in words[i+1:]:
            if word2 not in context_vectors:
                continue
            
            distance = compute_contextual_distance(word1, word2, context_vectors)
            
            if word1 in word_order and word2 in word_order:
                temporal_factor = 1.0 + 0.1 * abs(word_order[word1] - word_order[word2])
                distance *= temporal_factor
            
            distances[(word1, word2)] = distance
    
    edges = []
    for word1 in words:
        if word1 not in context_vectors:
            continue
        
        neighbors = []
        for word2 in words:
            if word1 == word2 or word2 not in context_vectors:
                continue
            
            if (word1, word2) in distances:
                distance = distances[(word1, word2)]
            else:
                distance = distances[(word2, word1)]
            
            neighbors.append((word2, distance))
        
        neighbors.sort(key=lambda x: x[1])
        
        for word2, distance in neighbors[:n_neighbors]:
            edges.append((word1, word2, distance))
    
    return edges

def hierarchical_clustering(words, edges, n_clusters=10):
    import networkx as nx
    from sklearn.cluster import AgglomerativeClustering
    
    G = nx.Graph()
    for word in words:
        G.add_node(word)
    
    for word1, word2, weight in edges:
        G.add_edge(word1, word2, weight=weight)
    
    distance_matrix = np.zeros((len(words), len(words)))
    for i, word1 in enumerate(words):
        for j, word2 in enumerate(words):
            if i == j:
                distance_matrix[i, j] = 0
            elif G.has_edge(word1, word2):
                distance_matrix[i, j] = G[word1][word2]['weight']
            else:
                distance_matrix[i, j] = 10.0
    
    clustering = AgglomerativeClustering(
        n_clusters=n_clusters,
        affinity='precomputed',
        linkage='average'
    )
    cluster_labels = clustering.fit_predict(distance_matrix)
    
    clusters = {}
    for i, word in enumerate(words):
        clusters[word] = int(cluster_labels[i])
    
    return clusters
