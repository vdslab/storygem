import nltk
from nltk.stem.wordnet import WordNetLemmatizer
import spacy
import string

def stopwords_ja():
    # https://github.com/stopwords-iso/stopwords-ja
    return set(["あそこ", "あっ", "あの", "あのかた", "あの人", "あり", "あります", "ある", "あれ", "い", "いう", "います", "いる", "う", "うち", "え", "お", "および", "おり", "おります", "か", "かつて", "から", "が", "き", "ここ", "こちら", "こと", "この", "これ", "これら", "さ", "さらに", "し", "しかし", "する", "ず", "せ", "せる", "そこ", "そして", "その", "その他", "その後", "それ", "それぞれ", "それで", "た", "ただし", "たち", "ため", "たり", "だ", "だっ", "だれ", "つ", "て", "で", "でき", "できる", "です", "では", "でも", "と", "という", "といった", "とき", "ところ", "として", "とともに", "とも", "と共に", "どこ", "どの", "な", "ない", "なお", "なかっ", "ながら", "なく", "なっ", "など", "なに", "なら", "なり", "なる", "なん", "に", "において", "における", "について", "にて", "によって", "により", "による", "に対して", "に対する", "に関する", "の", "ので", "のみ", "は", "ば", "へ", "ほか", "ほとんど", "ほど", "ます", "また", "または", "まで", "も", "もの", "ものの", "や", "よう", "より", "ら", "られ", "られる", "れ", "れる", "を", "ん", "何", "及び", "彼", "彼女", "我々", "特に", "私", "私達", "貴方", "貴方方"]+list(string.punctuation)+list(map(str, range(10))))


def stopwords_en():
    return set(nltk.corpus.stopwords.words('english'))+list(string.punctuation)+list(map(str, range(10)))


def tokenize(text, lang):
    if lang == 'ja':
        return tokenize_ja(text)
    if lang == 'en':
        return tokenize_en(text)
    raise Exception('Unsupported language')


def tokenize_en(text):
    stopwords = stopwords_en()
    lemmatizer = WordNetLemmatizer()
    for token, pos in nltk.pos_tag(nltk.word_tokenize(text)):
        word = None
        if pos.startswith('NN'):
            word = lemmatizer.lemmatize(token, 'n')
        elif pos.startswith('JJ'):
            word = lemmatizer.lemmatize(token, 'a')
        elif pos.startswith('VB'):
            word = lemmatizer.lemmatize(token, 'v')
        if word and word not in stopwords:
            yield word.lower()


def tokenize_ja(text):
    target_pos = ['名詞', '動詞', '形容詞']
    stopwords = stopwords_ja()
    nlp = spacy.load('ja_ginza')
    for sent in nlp(text).sents:
        for token in sent:
            if token.lemma_ not in stopwords:
                if any(token.tag_.startswith(pos) for pos in target_pos):
                    yield token.lemma_
