# Installing data from a local directory: the same code path as a download
# after the tarball is unpacked, with no network.
make_source <- function() {
  src <- file.path(tempfile("src-"), "xpfcorpus", "data", "languages")
  dir.create(src, recursive = TRUE)
  file.copy(system.file("extdata", "toy.json", package = "xpfcorpus"), file.path(src, "toy.json"))
  writeLines("{}", file.path(src, "index.json"))
  dirname(dirname(dirname(src)))
}

test_that("xpf_download(path =) installs language files under lang_ names", {
  dir <- tempfile("data-")
  old <- options(xpfcorpus.data_dir = dir)
  on.exit(options(old))
  expect_false(xpf_has_data())
  expect_error(xpf_languages(), "xpf_download")
  expect_message(xpf_download(path = make_source()), "Installed 1 languages")
  expect_true(xpf_has_data())
  expect_true(file.exists(file.path(dir, "languages", "lang_toy.json")))
  expect_false(file.exists(file.path(dir, "languages", "lang_index.json")))
  expect_match(xpf_data_info()$license, "CC BY-NC-SA")
  expect_identical(xpf_data_info()$languages, 1L)
  expect_identical(xpf_languages()$code, "toy")
  expect_identical(xpf_transcribe("casa", "toy"), "k a z a")
})

test_that("reinstalling replaces the old data and the caches", {
  dir <- tempfile("data-")
  old <- options(xpfcorpus.data_dir = dir)
  on.exit(options(old))
  xpf_download(path = make_source(), quiet = TRUE)
  expect_identical(xpf_transcribe("casa", "toy"), "k a z a")
  # a different toy: s is always /s/
  src <- make_source()
  f <- file.path(src, "xpfcorpus", "data", "languages", "toy.json")
  j <- jsonlite::fromJSON(f, simplifyVector = FALSE)
  j$scripts$latin$rules$sub[[2]]$to <- "s"
  j$scripts$latin$verify <- list()
  writeLines(jsonlite::toJSON(j, auto_unbox = TRUE), f, useBytes = TRUE)
  xpf_download(path = src, quiet = TRUE)
  expect_identical(xpf_transcribe("casa", "toy"), "k a s a")
})

test_that("xpf_data_dir() follows the option and the environment variable", {
  old <- options(xpfcorpus.data_dir = NULL)
  on.exit(options(old))
  old_env <- Sys.getenv("XPFCORPUS_DATA")
  on.exit(Sys.setenv(XPFCORPUS_DATA = old_env), add = TRUE)
  Sys.setenv(XPFCORPUS_DATA = "/some/where")
  expect_identical(xpf_data_dir(), "/some/where")
  options(xpfcorpus.data_dir = "/else/where")
  expect_identical(xpf_data_dir(), "/else/where")
  Sys.setenv(XPFCORPUS_DATA = "")
  options(xpfcorpus.data_dir = NULL)
  expect_identical(xpf_data_dir(), tools::R_user_dir("xpfcorpus", "data"))
})

# A throwaway git repository laid out like xpfcorpus, holding the toy language.
make_git_source <- function() {
  skip_if(!nzchar(Sys.which("git")), "git not available")
  src <- make_source()
  git <- function(...) system2("git", c("-C", shQuote(src), ...), stdout = TRUE, stderr = TRUE)
  git("init", "-q")
  git("-c", "user.name=t", "-c", "user.email=t@example.org", "add", ".")
  git("-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "-m", "toy")
  list(dir = src, commit = git("rev-parse", "HEAD"), git = git)
}

test_that("the commit is read from a git-archive tarball, as GitHub serves", {
  g <- make_git_source()
  tarball <- tempfile(fileext = ".tar.gz")
  system2("git", c("-C", shQuote(g$dir), "archive", "--format=tar.gz",
                   "--prefix=xpfcorpus-main/", "-o", shQuote(tarball), "HEAD"))
  expect_identical(xpfcorpus:::tarball_commit(tarball), g$commit)
})

test_that("installing from a git checkout records its commit, and local changes", {
  g <- make_git_source()
  dir <- tempfile("data-")
  old <- options(xpfcorpus.data_dir = dir)
  on.exit(options(old))
  xpf_download(path = g$dir, quiet = TRUE)
  info <- xpf_data_info()
  expect_identical(info$commit, g$commit)
  expect_match(info$date, "^\\d{4}-\\d{2}-\\d{2}$")
  expect_match(xpfcorpus:::data_version_line(), substr(g$commit, 1, 7), fixed = TRUE)

  write("\n", file.path(g$dir, "xpfcorpus", "data", "languages", "toy.json"), append = TRUE)
  xpf_download(path = g$dir, quiet = TRUE)
  expect_identical(xpf_data_info()$commit, paste0(g$commit, "+"))
  expect_match(xpfcorpus:::data_version_line(), "with local changes")
})

test_that("citation() names the installed rules, and works without them", {
  dir <- tempfile("data-")
  old <- options(xpfcorpus.data_dir = dir)
  on.exit(options(old))
  expect_null(xpf_data_info())
  expect_match(xpfcorpus:::data_version_line(), "xpf_download")
  keys <- function() vapply(unclass(citation("xpfcorpus")), function(b) attr(b, "key"), "")
  expect_identical(keys(), c("XPF2021manual", "xpfcorpusR"))

  g <- make_git_source()
  xpf_download(path = g$dir, quiet = TRUE)
  expect_identical(keys(), c("XPF2021manual", "xpfcorpusRules", "xpfcorpusR"))
  rules <- format(citation("xpfcorpus")[2], style = "text")
  expect_match(rules, g$commit, fixed = TRUE)
})
