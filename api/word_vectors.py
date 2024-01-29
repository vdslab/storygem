import gensim

model = gensim.downloader.load('word2vec-google-news-300')


def find_word_vectors(words, lang):
    if lang == 'en':
        return [model[word] for word, _ in words]
    raise Exception('Unsupported language')
