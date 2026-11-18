# Every bundled language and script must reproduce its verification words.
# This is the same check the Python package and Code/test-verify-all.sh run.
# The whole sweep takes about a second, so it runs on CRAN too: a V8 that
# treats some regular expression differently would show up here.
test_that("every language passes verification", {
  langs <- xpf_languages()
  for (i in seq_len(nrow(langs))) {
    for (script in strsplit(langs$scripts[i], ",")[[1]]) {
      v <- xpf_verify(langs$code[i], script)
      bad <- v[!v$ok, , drop = FALSE]
      expect(nrow(bad) == 0, sprintf(
        "%s/%s: %d of %d failed, e.g. '%s' -> '%s' (expected '%s')",
        langs$code[i], script, nrow(bad), nrow(v),
        bad$word[1], bad$transcribed[1], bad$expected[1]))
    }
  }
})
