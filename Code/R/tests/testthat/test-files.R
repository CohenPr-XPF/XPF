test_that("YAML rules keep literal values: quotes, y/n, digits", {
  skip_if_not_installed("yaml")
  toy <- xpf_transcriber("toy", file = test_path("fixtures", "toy.yaml"))
  expect_identical(toy$name, "Toy")
  expect_true(all(xpf_verify(toy)$ok))
  # a bare double quote is a grapheme mapped to nothing (Hebrew gershayim)
  expect_identical(xpf_transcribe('a"l', toy), "a l")
  expect_identical(xpf_transcribe("ny", toy), "n j")
})

test_that("JSON rules may map a bare double quote", {
  f <- withr_local_tempfile(fileext = ".json")
  writeLines('{"metadata":{"code":"q"},"scripts":{"s":{"rules":{"match":[
    {"from":"\\"","to":""},{"from":"a","to":"a"},{"from":"l","to":"l"}]}}}}', f)
  expect_identical(xpf_transcribe('a"l', xpf_transcriber("q", file = f)), "a l")
})

test_that("legacy .rules and .verify.csv files load", {
  toy <- xpf_transcriber("toy", file = test_path("fixtures", "toy.rules"),
                         verify_file = test_path("fixtures", "toy.verify.csv"))
  expect_identical(nrow(toy$verify), 3L)
  expect_true(all(xpf_verify(toy)$ok))
  expect_identical(xpf_transcribe("a,s", toy), "a , s")
})

test_that("failed verification stops with the failing words", {
  bad <- withr_local_tempfile(fileext = ".csv")
  writeLines(c("ase,a s e", "sa,s a"), bad)
  err <- expect_error(
    xpf_transcriber("toy", file = test_path("fixtures", "toy.rules"), verify_file = bad),
    class = "xpf_verification_error")
  expect_match(conditionMessage(err), "'ase' -> 'a z e'", fixed = TRUE)
  expect_identical(nrow(err$failures), 1L)
  expect_s3_class(
    xpf_transcriber("toy", file = test_path("fixtures", "toy.rules"),
                    verify_file = bad, verify = FALSE),
    "xpf_transcriber")
})
