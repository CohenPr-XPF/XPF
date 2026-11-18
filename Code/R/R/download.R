# Language data: not shipped with the package. The XPF Corpus data is under
# CC BY-NC-SA 4.0, so it is downloaded on request from the xpfcorpus
# repository and kept in a per-user data directory.

xpf_data_repo <- "CohenPr-XPF/xpfcorpus"

#' Where the language data is kept
#'
#' The language data is stored in a per-user directory,
#' `tools::R_user_dir("xpfcorpus", "data")` by default. Set the option
#' `xpfcorpus.data_dir` or the environment variable `XPFCORPUS_DATA` to use
#' another directory.
#'
#' @return `xpf_data_dir()` returns the directory path, which need not
#'   exist yet. `xpf_has_data()` returns `TRUE` if language data is
#'   installed there.
#' @seealso [xpf_download()]
#' @export
#' @examples
#' xpf_data_dir()
#' xpf_has_data()
xpf_data_dir <- function() {
  dir <- getOption("xpfcorpus.data_dir")
  if (is.null(dir)) dir <- Sys.getenv("XPFCORPUS_DATA")
  if (!nzchar(dir)) dir <- tools::R_user_dir("xpfcorpus", "data")
  dir
}

#' @rdname xpf_data_dir
#' @export
xpf_has_data <- function() {
  length(list.files(file.path(xpf_data_dir(), "languages"), pattern = "^lang_.*\\.json$")) > 0
}

#' Download the XPF Corpus language data
#'
#' The language rules are not included in the package: they are part of the
#' XPF Corpus, which is distributed under the Creative Commons
#' Attribution-NonCommercial-ShareAlike 4.0 license (CC BY-NC-SA 4.0). This
#' function downloads them from the xpfcorpus repository on GitHub
#' (<https://github.com/CohenPr-XPF/xpfcorpus>), once, into
#' [xpf_data_dir()]. Run it again to update. By downloading the data you
#' accept its license.
#'
#' @param ref The version of the data: a branch, tag or commit of the
#'   xpfcorpus repository.
#' @param path Instead of downloading, copy the language files from this
#'   local directory: a checkout of the xpfcorpus repository, or any
#'   directory holding its `<code>.json` language files.
#' @param dir Where to install the data. Defaults to [xpf_data_dir()].
#' @param quiet If `TRUE`, print no messages.
#'
#' @return The installation directory, invisibly.
#' @export
#' @examplesIf interactive()
#' xpf_download()
#' xpf_transcribe("perro", "es")
xpf_download <- function(ref = "main", path = NULL, dir = xpf_data_dir(),
                         quiet = FALSE) {
  stopifnot(is.character(ref), length(ref) == 1, nzchar(ref))
  staging <- tempfile("xpfcorpus-")
  on.exit(unlink(staging, recursive = TRUE), add = TRUE)
  dir.create(staging)

  if (is.null(path)) {
    url <- sprintf("https://codeload.github.com/%s/tar.gz/%s", xpf_data_repo, ref)
    tarball <- file.path(staging, "data.tar.gz")
    if (!quiet) message("Downloading XPF Corpus language data (", ref, ") ...")
    status <- tryCatch(
      utils::download.file(url, tarball, mode = "wb", quiet = TRUE),
      error = function(e) e, warning = function(w) w)
    if (!identical(status, 0L)) {
      msg <- if (inherits(status, "condition")) conditionMessage(status) else paste("status", status)
      stop(sprintf("Could not download %s: %s", url, msg), call. = FALSE)
    }
    members <- utils::untar(tarball, list = TRUE)
    wanted <- grep("/xpfcorpus/data/languages/[^/]+\\.json$", members, value = TRUE)
    if (length(wanted) == 0) {
      stop(sprintf("No language files found in %s (ref '%s').", url, ref), call. = FALSE)
    }
    utils::untar(tarball, files = wanted, exdir = staging)
    files <- file.path(staging, wanted)
    source <- sprintf("https://github.com/%s, ref %s", xpf_data_repo, ref)
  } else {
    if (!dir.exists(path)) stop(sprintf("No such directory: %s", path), call. = FALSE)
    sub <- file.path(path, "xpfcorpus", "data", "languages")
    if (dir.exists(sub)) path <- sub
    files <- list.files(path, pattern = "\\.json$", full.names = TRUE)
    files <- files[basename(files) != "index.json"]
    if (length(files) == 0) stop(sprintf("No language files in %s", path), call. = FALSE)
    source <- normalizePath(path)
  }

  # Install as lang_<code>.json: a bare code can be a name Windows reserves
  # (con.json for Constanza). Build the new copy first and swap it in, so a
  # failure leaves the old data in place.
  new <- file.path(staging, "new")
  dir.create(file.path(new, "languages"), recursive = TRUE)
  ok <- file.copy(files, file.path(new, "languages", paste0("lang_", basename(files))))
  if (!all(ok)) stop("Could not copy the language files.", call. = FALSE)
  writeLines(c(
    "XPF Corpus language data, CC BY-NC-SA 4.0",
    "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    paste("source:", source),
    paste("installed:", format(Sys.time(), "%Y-%m-%d %H:%M:%S %Z")),
    paste("languages:", length(files))
  ), file.path(new, "PROVENANCE"))

  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  old <- file.path(dir, "languages")
  if (dir.exists(old)) unlink(old, recursive = TRUE)
  if (!file.rename(file.path(new, "languages"), old)) {
    # rename fails across file systems; fall back to copying
    dir.create(old)
    file.copy(list.files(file.path(new, "languages"), full.names = TRUE), old)
  }
  file.copy(file.path(new, "PROVENANCE"), file.path(dir, "PROVENANCE"), overwrite = TRUE)

  # Anything loaded from the old data is stale now.
  .xpf$catalog <- NULL
  .xpf$transcribers <- list()
  if (!quiet) message(sprintf("Installed %d languages in %s", length(files), dir))
  invisible(dir)
}
