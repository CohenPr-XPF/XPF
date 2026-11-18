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
    source <- sprintf("https://github.com/%s", xpf_data_repo)
    # GitHub tarballs come from `git archive`, which records the commit in
    # the pax header and gives every file the commit's timestamp.
    commit <- tarball_commit(tarball)
    date <- format(max(file.mtime(files)), "%Y-%m-%d")
  } else {
    if (!dir.exists(path)) stop(sprintf("No such directory: %s", path), call. = FALSE)
    sub <- file.path(path, "xpfcorpus", "data", "languages")
    if (dir.exists(sub)) path <- sub
    files <- list.files(path, pattern = "\\.json$", full.names = TRUE)
    files <- files[basename(files) != "index.json"]
    if (length(files) == 0) stop(sprintf("No language files in %s", path), call. = FALSE)
    source <- normalizePath(path)
    git <- git_commit(path)
    commit <- git$commit
    date <- git$date
    ref <- NA_character_
  }

  # Install as lang_<code>.json: a bare code can be a name Windows reserves
  # (con.json for Constanza). Build the new copy first and swap it in, so a
  # failure leaves the old data in place.
  new <- file.path(staging, "new")
  dir.create(file.path(new, "languages"), recursive = TRUE)
  ok <- file.copy(files, file.path(new, "languages", paste0("lang_", basename(files))))
  if (!all(ok)) stop("Could not copy the language files.", call. = FALSE)
  write.dcf(data.frame(
    Data = "XPF Corpus language rules",
    License = "CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/)",
    Source = source, Ref = ref, Commit = commit, Date = date,
    Languages = length(files),
    Installed = format(Sys.time(), "%Y-%m-%d %H:%M:%S %Z"),
    stringsAsFactors = FALSE
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
  if (!quiet) {
    message(sprintf("Installed %d languages in %s", length(files), dir))
    message(data_version_line())
  }
  invisible(dir)
}

# The commit a `git archive` tarball was made from: its first header is a
# pax global header whose "comment" record holds the commit id.
tarball_commit <- function(tarball) {
  con <- gzfile(tarball, "rb")
  on.exit(close(con))
  head <- rawToChar(readBin(con, "raw", 1024)[-(1:512)], multiple = TRUE)
  head <- paste(head[head != "\001" & nzchar(head)], collapse = "")
  m <- regmatches(head, regexpr("comment=[0-9a-f]{40}", head))
  if (length(m)) sub("comment=", "", m) else NA_character_
}

# Commit and date of a local git checkout, if it is one; "+" marks
# uncommitted changes to the language files.
git_commit <- function(path) {
  none <- list(commit = NA_character_, date = NA_character_)
  git <- Sys.which("git")
  if (!nzchar(git)) return(none)
  run <- function(...) suppressWarnings(tryCatch(
    system2(git, c("-C", shQuote(path), ...), stdout = TRUE, stderr = FALSE),
    error = function(e) character()))
  out <- run("log", "-1", "--format=%H%x20%cs", "--", ".")
  if (length(out) != 1 || !grepl("^[0-9a-f]{40} ", out)) return(none)
  dirty <- length(run("status", "--porcelain", "--", ".")) > 0
  parts <- strsplit(out, " ")[[1]]
  list(commit = paste0(parts[1], if (dirty) "+"), date = parts[2])
}

#' Which version of the corpus rules is installed
#'
#' Reports where the installed language data came from: the xpfcorpus
#' commit and its date, as recorded by [xpf_download()]. Cite this with
#' your results, since transcriptions can change between versions of the
#' rules. [citation()] for this package includes it.
#'
#' @return A list with elements `source`, `ref`, `commit` (a trailing `+`
#'   means a local copy with uncommitted changes), `date`, `languages`,
#'   `installed` and `license`, or `NULL` if no data is installed.
#' @export
#' @examples
#' xpf_data_info()
xpf_data_info <- function() {
  f <- file.path(xpf_data_dir(), "PROVENANCE")
  if (!xpf_has_data() || !file.exists(f)) return(NULL)
  d <- tryCatch(read.dcf(f), error = function(e) NULL)
  get <- function(k) if (!is.null(d) && k %in% colnames(d) && !is.na(d[1, k]) && d[1, k] != "NA") gsub("\\s*\n\\s*", " ", unname(d[1, k])) else NA_character_
  list(source = get("Source"), ref = get("Ref"), commit = get("Commit"),
       date = get("Date"), languages = as.integer(get("Languages")),
       installed = get("Installed"), license = get("License"))
}

# One line naming the installed rules, for messages.
data_version_line <- function() {
  info <- xpf_data_info()
  if (is.null(info)) {
    return("XPF Corpus rules not installed; run xpf_download() (CC BY-NC-SA 4.0).")
  }
  commit <- if (is.na(info$commit)) "unknown commit" else paste("commit", substr(info$commit, 1, 7))
  if (!is.na(info$commit) && endsWith(info$commit, "+")) commit <- paste(commit, "with local changes")
  date <- if (is.na(info$date)) "" else sprintf(" (%s)", info$date)
  sprintf("XPF Corpus rules: %s%s, %d languages. Cite with citation(\"xpfcorpus\").",
          commit, date, info$languages)
}

.onAttach <- function(libname, pkgname) {
  packageStartupMessage(data_version_line())
}
