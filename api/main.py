import itertools
import os
from community import community_louvain
from flask import Flask, jsonify, request
from flask_cors import CORS
import networkx as nx
from scipy.spatial.distance import pdist, squareform
from sklearn.neighbors import NearestNeighbors
from tokenizer import tokenize
import word_vectors
import weight_functions

app = Flask(__name__)
CORS(app)


def count_words(words):
    word_count = {}
    for word in words:
        if word not in word_count:
            word_count[word] = 0
        word_count[word] += 1
    return word_count

def weight_function(word_count, model_frequency, weight_type):
    if weight_type == 'tf':
        return weight_functions.Tf(word_count)
    if weight_type == 'tf-idf':
        return weight_functions.TfIdf(word_count, model_frequency)
    raise Exception('Unsupported weight type')


def w2v_knn_graph_en(word_count, max_words, n_neighbors, lang, distance_metric, weight_type):
    words = list(word_count.keys())
    model_frequency = word_vectors.find_word_frequency(words, lang)
    weight = weight_function(word_count, model_frequency, weight_type)
    words = [word for word in words if word in model_frequency]
    words.sort(key=lambda word: weight(word), reverse=True)
    words = words[:max_words]
    wv = word_vectors.find_word_vectors(words, lang)
    distance_matrix = squareform(pdist(wv, distance_metric))
    knn = NearestNeighbors(n_neighbors=n_neighbors,
                           algorithm='ball_tree').fit(wv)
    knn_graph = knn.kneighbors_graph(wv).toarray()

    graph = nx.Graph()
    indices = list(range(len(words)))
    for i, word in enumerate(words):
        graph.add_node(i, word=word, weight=weight(word))
    for i, j in itertools.combinations(indices, 2):
        if knn_graph[i, j]:
            graph.add_edge(i, j, weight=distance_matrix[i, j])
    return graph


def cluster_words(graph):
    dendrogram = community_louvain.generate_dendrogram(graph, randomize=False)
    dendrogram.append({k: 0 for k in set(dendrogram[-1].values())})
    data = []
    for i, layer in enumerate(dendrogram):
        for (k, v) in sorted(layer.items()):
            item = {
                'id': f'{i}-{k}',
                'parentId': f'{i + 1}-{v}',
            }
            if i == 0:
                item['word'] = graph.nodes[k]['word']
                item['weight'] = graph.nodes[k]['weight']
            data.append(item)
    data.append({
        'id': f'{len(dendrogram)}-0',
        'parentId': None
    })
    return data


@app.route("/knn_graph", methods=['POST'])
def knn_graph():
    text = request.data.decode()
    max_words = int(request.args.get('words', 100))
    n_neighbors = int(request.args.get('n_neighbors', 10))
    weight_type = request.args.get('weight', 'tf-idf')
    lang = request.args.get('lang', 'en')

    app.logger.info('start')
    word_count = count_words(tokenize(text, lang))
    app.logger.info('tokenize')
    graph = w2v_knn_graph_en(
        word_count, max_words, n_neighbors,
        lang=lang, distance_metric='cosine', weight_type=weight_type
    )
    app.logger.info('graph construction')
    data = cluster_words(graph)
    app.logger.info('clustering')

    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
