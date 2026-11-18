# A temp file removed when the calling test ends, without depending on withr.
withr_local_tempfile <- function(fileext = "", env = parent.frame()) {
  f <- tempfile(fileext = fileext)
  do.call(on.exit, list(substitute(unlink(f), list(f = f)), add = TRUE), envir = env)
  f
}

# Corpus data for the tests, in a temporary directory so the user's own
# xpf_data_dir() is never touched. From XPFCORPUS_TEST_DATA (a local
# xpfcorpus checkout or a directory of language files) if set; otherwise
# downloaded, except on CRAN. If neither works, the corpus tests skip.
options(xpfcorpus.data_dir = file.path(tempdir(), "xpfcorpus-test-data"))
local({
  src <- Sys.getenv("XPFCORPUS_TEST_DATA")
  try(if (nzchar(src)) {
    xpf_download(path = src, quiet = TRUE)
  } else if (identical(Sys.getenv("NOT_CRAN"), "true")) {
    xpf_download(quiet = TRUE)
  }, silent = TRUE)
})

skip_if_no_data <- function() {
  if (!xpf_has_data()) skip("XPF Corpus language data not available")
}
