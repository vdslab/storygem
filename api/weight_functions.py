import math

class Tf:
    def __init__(self, word_count):
        self.word_count = word_count

    def __call__(self, word):
        return self.word_count[word]

class TfIdf:
    def __init__(self, word_count, model_frequency):
        self.word_count = word_count
        self.model_frequency = model_frequency

    def __call__(self, word):
        return self.word_count[word] / math.log(self.model_frequency[word])
