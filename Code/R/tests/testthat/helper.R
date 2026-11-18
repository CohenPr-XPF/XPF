# A temp file removed when the calling test ends, without depending on withr.
withr_local_tempfile <- function(fileext = "", env = parent.frame()) {
  f <- tempfile(fileext = fileext)
  do.call(on.exit, list(substitute(unlink(f), list(f = f)), add = TRUE), envir = env)
  f
}
