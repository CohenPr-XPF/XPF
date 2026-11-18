#' Create a transcriber for one language
#'
#' Loads the rules for a language and script, ready for
#' [xpf_transcribe()]. Rules come from the data bundled with the package or
#' from a file of your own.
#'
#' @param language A language code from [xpf_languages()], such as `"es"`
#'   (the corpus data must be installed first, see [xpf_download()]).
#'   BCP-47 style codes are accepted: a script subtag selects the script
#'   (`"tt-Cyrl"`, `"tt-cyrillic"`), and a region subtag (`"es-ES"`) selects a
#'   regional variant if one is bundled, falling back to the base language
#'   with a warning if not. Ignored when `file` is given, except as a label.
#' @param script The script to use, such as `"latin"` or `"cyrillic"` (ISO
#'   15924 codes like `"Cyrl"` also work). Overrides any script in
#'   `language`. Needed only for languages with several scripts and no
#'   default.
#' @param verify If `TRUE` (the default), transcribe the language's
#'   verification words and stop with an error if any of them comes out
#'   wrong.
#' @param file Optional path to your own rules: an xpfcorpus language file
#'   (`.json`, or `.yaml`/`.yml`, which needs the \pkg{yaml} package), or a
#'   legacy XPF `.rules` file (CSV or TSV).
#' @param verify_file Optional path to a legacy `.verify.csv` file of words
#'   and their expected transcriptions. Used only with a `.rules` file.
#'
#' @return An object of class `xpf_transcriber`: a list holding the
#'   language code, script, metadata and verification words.
#' @seealso [xpf_transcribe()], [xpf_verify()], [xpf_languages()]
#' @export
#' @examples
#' # Rules from a file: a small made-up language shipped with the package
#' toy <- xpf_transcriber("toy", file = system.file("extdata", "toy.json", package = "xpfcorpus"))
#' toy
#' xpf_transcribe("mesa", toy)
#'
#' @examplesIf xpf_has_data()
#' # Corpus languages, after xpf_download()
#' es <- xpf_transcriber("es")
#' xpf_transcribe(c("perro", "guitarra"), es)
#' # Tatar is written in two scripts, neither the default
#' xpf_transcriber("tt", "cyrillic")$script
xpf_transcriber <- function(language, script = NULL, verify = TRUE,
                            file = NULL, verify_file = NULL) {
  stopifnot(is.character(language), length(language) == 1, !is.na(language))
  if (!is.null(script)) stopifnot(is.character(script), length(script) == 1)

  tr <- if (is.null(file)) {
    load_bundled(language, script)
  } else {
    load_file(language, script, file, verify_file)
  }
  class(tr) <- "xpf_transcriber"

  if (isTRUE(verify) && nrow(tr$verify) > 0) {
    res <- xpf_verify(tr)
    bad <- res[!res$ok, , drop = FALSE]
    if (nrow(bad) > 0) {
      shown <- utils::head(bad, 10)
      lines <- sprintf("  '%s' -> '%s' (expected: '%s')",
                       shown$word, shown$transcribed, shown$expected)
      more <- if (nrow(bad) > 10) sprintf("\n  ... and %d more", nrow(bad) - 10) else ""
      stop(structure(
        class = c("xpf_verification_error", "error", "condition"),
        list(message = sprintf(
          "%d of %d verification words failed for '%s':\n%s%s\nUse verify = FALSE to load the rules anyway.",
          nrow(bad), nrow(res), tr$language, paste(lines, collapse = "\n"), more),
          call = sys.call(-1), failures = bad)
      ))
    }
  }
  tr
}

# Ids embed a per-context token, so a transcriber saved in one R session
# and restored in another is recognised as stale rather than silently
# matching an unrelated language loaded under the same number.
new_id <- function() {
  xpf_context()
  .xpf$counter <- .xpf$counter + 1L
  paste0(.xpf$token, "_", .xpf$counter)
}

# Pick the script for a parsed language file, as xpfcorpus does.
resolve_script <- function(lang_data, script, language) {
  available <- names(lang_data$scripts)
  if (!is.null(script)) {
    if (!script %in% available) {
      stop(sprintf("Script '%s' not found for '%s'. Available: %s",
                   script, language, paste(available, collapse = ", ")),
           call. = FALSE)
    }
    return(script)
  }
  s <- default_script(lang_data$metadata %||% list(), available)
  if (is.null(s)) {
    stop(sprintf("'%s' is written in several scripts (%s); choose one with `script`.",
                 language, paste(available, collapse = ", ")),
         call. = FALSE)
  }
  s
}

verify_frame <- function(entries) {
  if (length(entries) == 0) {
    return(data.frame(word = character(), expected = character(),
                      comment = character(), stringsAsFactors = FALSE))
  }
  data.frame(
    word = vapply(entries, function(e) as.character(e$word %||% ""), ""),
    expected = vapply(entries, function(e) as.character(e$phonemes %||% ""), ""),
    comment = vapply(entries, function(e) as.character(e$comment %||% ""), ""),
    stringsAsFactors = FALSE
  )
}

# Build the transcriber from a parsed language object and its JSON text.
from_language_data <- function(lang_data, json_text, language, script,
                               variant = NULL, source) {
  script <- resolve_script(lang_data, script, language)
  id <- new_id()
  engine_load_json(id, json_text, script)
  m <- lang_data$metadata %||% list()
  list(
    id = id,
    language = language,
    script = script,
    variant = variant,
    name = m$name %||% NA_character_,
    family = m$family %||% NA_character_,
    compromised = if (is.null(m$compromised)) NULL else (m$compromised$note %||% ""),
    verify = verify_frame(lang_data$scripts[[script]]$verify),
    source = source
  )
}

load_bundled <- function(language, script) {
  code <- parse_language_code(language, script)
  variant <- NULL
  f <- NULL
  if (!is.null(code$region)) {
    f <- language_file(paste0(code$language, "-", code$region))
    if (is.null(f)) {
      warning(sprintf("Language variant '%s-%s' not found; using '%s'.",
                      code$language, code$region, code$language), call. = FALSE)
    } else {
      variant <- code$region
    }
  }
  if (is.null(f)) f <- language_file(code$language)
  if (is.null(f)) {
    stop(sprintf("Language '%s' not found. See xpf_languages() for the available codes.",
                 code$language), call. = FALSE)
  }
  json_text <- read_text(f)
  lang_data <- jsonlite::fromJSON(json_text, simplifyVector = FALSE)
  lang <- if (is.null(variant)) code$language else paste0(code$language, "-", variant)
  from_language_data(lang_data, json_text, lang, code$script, variant,
                     source = "bundled")
}

load_file <- function(language, script, file, verify_file) {
  if (!file.exists(file)) stop(sprintf("File not found: %s", file), call. = FALSE)
  script <- if (is.null(script)) NULL else normalize_script(script)
  ext <- tolower(tools::file_ext(file))
  path <- normalizePath(file)

  if (ext == "json") {
    json_text <- read_text(file)
    lang_data <- jsonlite::fromJSON(json_text, simplifyVector = FALSE)
    return(from_language_data(lang_data, json_text, language, script, source = path))
  }

  if (ext %in% c("yaml", "yml")) {
    lang_data <- read_yaml_language(file)
    json_text <- as.character(jsonlite::toJSON(lang_data, auto_unbox = TRUE, null = "null"))
    return(from_language_data(lang_data, json_text, language, script, source = path))
  }

  # Anything else is read as a legacy .rules file.
  id <- new_id()
  engine_load_rules(id, read_text(file))
  verify <- if (is.null(verify_file)) verify_frame(list()) else read_verify_file(verify_file)
  list(id = id, language = language, script = "default", variant = NULL,
       name = NA_character_, family = NA_character_, compromised = NULL,
       verify = verify, source = path)
}

# Read a YAML language file. Every scalar under `scripts` is kept as the
# text written in the file: the yaml package would otherwise read y, n, yes,
# no, on and off as logicals and digits as numbers, and those are ordinary
# graphemes and phonemes.
read_yaml_language <- function(file) {
  if (!requireNamespace("yaml", quietly = TRUE)) {
    stop("Reading YAML files needs the 'yaml' package: install.packages(\"yaml\")",
         call. = FALSE)
  }
  as_text <- function(x) x
  d <- yaml::read_yaml(file, handlers = list(
    "bool#yes" = as_text, "bool#no" = as_text,
    "int" = as_text, "float" = as_text
  ))
  d$scripts <- rapply(d$scripts, as.character, how = "replace")
  if (!is.null(d$metadata$default_script)) {
    d$metadata$default_script <- as.character(d$metadata$default_script)
  }
  d
}

read_verify_file <- function(path) {
  rows <- engine_parse_table(read_text(path))
  rows <- Filter(function(r) length(r) >= 2 && nzchar(trimws(r[1])) && nzchar(trimws(r[2])), rows)
  verify_frame(lapply(rows, function(r) list(
    word = trimws(r[1]), phonemes = trimws(r[2]),
    comment = if (length(r) > 2) trimws(r[3]) else ""
  )))
}

#' @export
print.xpf_transcriber <- function(x, ...) {
  label <- if (is.na(x$name)) x$language else sprintf("%s (%s)", x$name, x$language)
  cat(sprintf("<xpf_transcriber> %s, script: %s\n", label, x$script))
  if (x$source != "bundled") cat(sprintf("  rules from %s\n", x$source))
  cat(sprintf("  %d verification words\n", nrow(x$verify)))
  if (!is.null(x$compromised)) {
    note <- if (nzchar(x$compromised)) paste0(": ", x$compromised) else ""
    cat(sprintf("  compromised%s\n", note))
  }
  invisible(x)
}
