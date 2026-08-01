#!/usr/bin/env python3
"""
api/dog.txt を入力としてmain.pyのknn_graph関数をローカルで実行するスクリプト
"""
import json
import sys
import os

# main.pyと同じディレクトリからインポートできるようにする
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import count_words, cluster_words
from tokenizer import tokenize
import word_vectors_local as word_vectors
from scipy.spatial.distance import pdist, squareform
from sklearn.neighbors import NearestNeighbors
import networkx as nx
import itertools
import weight_functions


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


def main():
    # dog.txtの内容を読み込む
    with open('dog.txt', 'r', encoding='utf-8') as f:
        text = f.read()
    
    # パラメータ設定
    max_words = 30
    n_neighbors = 10
    weight_type = 'tf-idf'
    lang = 'en'
    
    print(f"テキスト処理開始...")
    print(f"パラメータ: max_words={max_words}, n_neighbors={n_neighbors}, weight_type={weight_type}, lang={lang}")
    
    # トークン化
    print("トークン化中...")
    word_count = count_words(tokenize(text, lang))
    print(f"ユニーク単語数: {len(word_count)}")
    
    # グラフ構築
    print("グラフ構築中...")
    graph = w2v_knn_graph_en(
        word_count, max_words, n_neighbors,
        lang=lang, distance_metric='cosine', weight_type=weight_type
    )
    print(f"グラフノード数: {graph.number_of_nodes()}, エッジ数: {graph.number_of_edges()}")
    
    # クラスタリング
    print("クラスタリング中...")
    data = cluster_words(graph)
    print(f"データ要素数: {len(data)}")
    
    # 結果を保存
    output_file = 'dog_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ 実行完了！結果を {output_file} に保存しました")
    print(f"  - 総データ要素数: {len(data)}")
    print(f"  - グラフノード数: {graph.number_of_nodes()}")
    print(f"  - グラフエッジ数: {graph.number_of_edges()}")

if __name__ == '__main__':
    main()
