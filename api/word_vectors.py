import psycopg
import numpy as np

def find_word_vectors(words, lang):
    with psycopg.connect() as conn:
        sql = 'SELECT word, vector FROM words WHERE lang = %s AND word = ANY(%s)'
        vectors = {w: np.frombuffer(v) for w, v in conn.execute(sql, [lang, words])}
        return [vectors[w] for w in words]


def find_word_frequency(words, lang):
    with psycopg.connect() as conn:
        sql = 'SELECT word, frequency FROM words WHERE lang = %s AND word = ANY(%s)'
        return {w: c for w, c in conn.execute(sql, [lang, words])}
