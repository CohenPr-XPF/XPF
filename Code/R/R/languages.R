# Bundled language data and language-code parsing.

languages_dir <- function() {
  dir <- file.path(xpf_data_dir(), "languages")
  if (!xpf_has_data()) {
    stop("The XPF Corpus language data is not installed. Run xpf_download() ",
         "to download it (CC BY-NC-SA 4.0), or see ?xpf_data_dir.", call. = FALSE)
  }
  dir
}

# Files are stored as lang_<code>.json: a bare code can be a name Windows
# reserves (con.json for Constanza).
language_file <- function(code) {
  f <- file.path(languages_dir(), paste0("lang_", code, ".json"))
  if (file.exists(f)) f else NULL
}

#' Languages available in the XPF corpus
#'
#' Lists every language in the installed corpus data (see [xpf_download()]),
#' with the scripts it can be written in and its metadata.
#'
#' Some languages are marked as *compromised*: their rules are known to be
#' imperfect, usually because the orthography does not fully determine the
#' pronunciation. The `compromised_note` column says why. They can still be
#' used, but check the note before relying on them.
#'
#' @return A data frame with one row per language and columns `code`,
#'   `name`, `family`, `macroarea`, `scripts` (comma-separated),
#'   `default_script` (`NA` when a language has several scripts and none is
#'   the default, in which case a script must be chosen), `compromised` and
#'   `compromised_note`.
#' @export
#' @examplesIf xpf_has_data()
#' langs <- xpf_languages()
#' head(langs[, c("code", "name", "scripts")])
#' langs[langs$code == "tt", ]
xpf_languages <- function() {
  dir <- languages_dir()
  if (is.null(.xpf$catalog) || !identical(attr(.xpf$catalog, "dir"), dir)) {
    files <- sort(list.files(dir, pattern = "^lang_.*\\.json$", full.names = TRUE))
    rows <- lapply(files, function(f) {
      d <- jsonlite::fromJSON(f, simplifyVector = FALSE)
      m <- d$metadata
      scripts <- names(d$scripts)
      note <- m$compromised$note
      data.frame(
        code = sub("^lang_(.*)\\.json$", "\\1", basename(f)),
        name = m$name %||% NA_character_,
        family = m$family %||% NA_character_,
        macroarea = m$macroarea %||% NA_character_,
        scripts = paste(scripts, collapse = ","),
        default_script = default_script(m, scripts) %||% NA_character_,
        compromised = !is.null(m$compromised),
        compromised_note = if (is.null(note)) NA_character_ else note,
        stringsAsFactors = FALSE
      )
    })
    catalog <- do.call(rbind, rows)
    attr(catalog, "dir") <- dir
    .xpf$catalog <- catalog
  }
  out <- .xpf$catalog
  attr(out, "dir") <- NULL
  out
}

default_script <- function(metadata, scripts) {
  if (!is.null(metadata$default_script)) return(metadata$default_script)
  if (length(scripts) == 1) return(scripts)
  NULL
}

`%||%` <- function(a, b) if (is.null(a)) b else a

# Script names: ISO 15924 codes and common names map to the names used in
# the language files. Mirrors xpfcorpus.io.language_code.normalize_script.
normalize_script <- function(script) {
  s <- tolower(script)
  map <- c(latn = "latin", cyrl = "cyrillic", syll = "syllabics",
           hebr = "hebrew", arab = "arabic", simplified = "hans",
           traditional = "hant")
  if (s %in% names(map)) unname(map[s]) else s
}

script_words <- c("latin", "cyrillic", "syllabics", "hebrew", "arabic",
                  "hans", "hant", "latn", "cyrl", "syll", "hebr", "arab")

# Split a BCP-47 style code ("es", "es-ES", "yi-Latn", "tt-cyrillic",
# "zh-Hans-CN") into language, script and region. Mirrors
# xpfcorpus.io.language_code.parse_language_code.
parse_language_code <- function(code, script = NULL) {
  parts <- strsplit(code, "-", fixed = TRUE)[[1]]
  language <- tolower(parts[1])
  ext_script <- NULL
  region <- NULL
  for (p in parts[-1]) {
    if (nchar(p) == 4 && grepl("^[A-Z]", p) && is.null(ext_script)) {
      ext_script <- normalize_script(p)
    } else if (tolower(p) %in% script_words && is.null(ext_script)) {
      ext_script <- normalize_script(p)
    } else if (grepl("^[A-Z]{2}$", p) && is.null(region)) {
      region <- p
    } else if (grepl("^[0-9]{3}$", p) && is.null(region)) {
      region <- p
    }
  }
  if (!is.null(script)) ext_script <- normalize_script(script)
  list(language = language, script = ext_script, region = region)
}
