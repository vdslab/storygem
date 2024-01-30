DROP TABLE IF EXISTS words;
CREATE TABLE words (
  word TEXT,
  lang TEXT,
  frequency BIGINT,
  vector BYTEA,
  PRIMARY KEY (word, lang)
);