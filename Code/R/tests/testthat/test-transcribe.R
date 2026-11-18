test_that("Spanish words come out as expected", {
  expect_identical(
    xpf_transcribe(c("perro", "guitarra", "chico"), "es"),
    c("p e r o", "ɡ i t̪ a r a", "tʃ i k o")
  )
})

test_that("sep controls the output shape", {
  expect_identical(xpf_transcribe("perro", "es", sep = "_"), "p_e_r_o")
  expect_identical(xpf_transcribe("perro", "es", sep = ""), "pero")
  expect_identical(xpf_transcribe(c("la", "si"), "es", sep = NULL),
                   list(c("l", "a"), c("s", "i")))
})

test_that("NA, empty input, names and factors are handled", {
  expect_identical(xpf_transcribe(c("la", NA), "es"), c("l a", NA))
  expect_identical(xpf_transcribe(character(), "es"), character())
  expect_identical(xpf_transcribe(c(a = "la"), "es"), c(a = "l a"))
  expect_identical(xpf_transcribe(factor("la"), "es"), "l a")
  expect_identical(xpf_transcribe(NA_character_, "es", sep = NULL), list(NA_character_))
  expect_error(xpf_transcribe(1, "es"), "character")
})

test_that("a transcriber object can be reused", {
  es <- xpf_transcriber("es")
  expect_s3_class(es, "xpf_transcriber")
  expect_identical(xpf_transcribe("la", es), "l a")
  expect_output(print(es), "Spanish")
})

test_that("scripts are resolved like the Python package", {
  expect_error(xpf_transcriber("tt"), "several scripts")
  expect_identical(xpf_transcriber("tt", "cyrillic")$script, "cyrillic")
  expect_identical(xpf_transcriber("tt-Cyrl")$script, "cyrillic")
  expect_identical(xpf_transcriber("tt-latin")$script, "latin")
  expect_identical(xpf_transcriber("tt-Latn", script = "Cyrl")$script, "cyrillic")
  expect_error(xpf_transcriber("es", "cyrillic"), "not found")
  expect_identical(xpf_transcriber("mk")$script, "cyrillic")
})

test_that("unknown languages and missing variants are reported", {
  expect_error(xpf_transcriber("zzz"), "not found")
  expect_warning(tr <- xpf_transcriber("es-ES"), "variant")
  expect_identical(tr$language, "es")
})

test_that("language codes are parsed like the Python package", {
  p <- xpfcorpus:::parse_language_code
  expect_identical(p("es"), list(language = "es", script = NULL, region = NULL))
  expect_identical(p("es-ES")$region, "ES")
  expect_identical(p("yi-Latn")$script, "latin")
  expect_identical(p("zh-Hans-CN")[c("script", "region")], list(script = "hans", region = "CN"))
  expect_identical(p("yi-Latn", "hebrew")$script, "hebrew")
})

test_that("xpf_languages() lists the bundled languages", {
  langs <- xpf_languages()
  expect_gt(nrow(langs), 150)
  expect_true(all(c("es", "tt", "eu", "con") %in% langs$code))
  expect_identical(langs$default_script[langs$code == "tt"], NA_character_)
  expect_type(langs$compromised, "logical")
  expect_false(anyDuplicated(langs$code) > 0)
})

test_that("a transcriber from another session is rejected", {
  es <- xpf_transcriber("es")
  es$id <- "stale_1"
  expect_error(xpf_transcribe("la", es), "earlier R session")
})

test_that("Georgian capitals (Mtavruli) are lower-cased on every V8 build", {
  # \u1CA4\u1CA3\u1CA0\u1C98 is the all-caps form of \u10e4\u10e3\u10e0\u10d8
  expect_identical(xpf_transcribe("\u1CA4\u1CA3\u1CA0\u1C98", "ka"),
                   xpf_transcribe("\u10e4\u10e3\u10e0\u10d8", "ka"))
  expect_false(grepl("@", xpf_transcribe("\u1CA4\u1CA3\u1CA0\u1C98", "ka")))
})
