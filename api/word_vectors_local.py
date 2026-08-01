"""
ローカルテスト用のword_vectors.py代替
Gensimの事前訓練済みモデルを使用
"""
import numpy as np
import gensim.downloader as api

# グローバルにモデルをロード（一度だけ）
_model = None

def _get_model():
    global _model
    if _model is None:
        print("Word2Vecモデルをダウンロード中... (初回のみ、時間がかかる場合があります)")
        # glove-wiki-gigaword-100 は比較的小さいモデル
        _model = api.load('glove-wiki-gigaword-100')
        print("モデルのロード完了")
    return _model


def find_word_vectors(words, lang='en'):
    """単語ベクトルを取得"""
    model = _get_model()
    vectors = []
    for word in words:
        word_lower = word.lower()
        if word_lower in model:
            vectors.append(model[word_lower])
        else:
            # 単語がモデルにない場合はランダムベクトル
            vectors.append(np.random.randn(100))
    return np.array(vectors)


def find_word_frequency(words, lang='en'):
    """
    単語の頻度を取得
    実際のDBがないのでモデル内の存在をチェックし、
    存在する単語には仮の頻度を返す
    """
    model = _get_model()
    frequency = {}
    for word in words:
        word_lower = word.lower()
        if word_lower in model:
            # モデルに存在する単語には仮の頻度を設定
            frequency[word] = 1000  # 仮の頻度
        else:
            # 存在しない単語には低い頻度（2以上でmath.log(x)が0にならないようにする）
            frequency[word] = 2
    return frequency
