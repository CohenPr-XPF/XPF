#' Transcribe words into phonemes
#'
#' Converts the spelling of each word into a sequence of IPA phonemes using
#' the XPF corpus rules for a language.
#'
#' Characters the rules do not cover are transcribed as `"@"`.
#'
#' @param words A character vector of words. `NA` gives `NA`.
#' @param language A language code (see [xpf_transcriber()] for the forms
#'   accepted) or a transcriber made by [xpf_transcriber()]. With a code,
#'   the transcriber is built and verified on first use, then reused for the
#'   rest of the R session.
#' @param script The script to use, for a language code. Ignored when
#'   `language` is a transcriber.
#' @param sep The string put between phonemes. Use `""` to join them
#'   without a gap, or `NULL` to get a list of phoneme vectors instead of
#'   strings.
#'
#' @return A character vector the same length as `words` (keeping its
#'   names), or, when `sep = NULL`, a list of character vectors, one per
#'   word.
#' @export
#' @examples
#' # A small made-up language shipped with the package
#' toy <- xpf_transcriber("toy", file = system.file("extdata", "toy.json", package = "xpfcorpus"))
#' xpf_transcribe(c("casa", "cielo"), toy)
#' xpf_transcribe("casa", toy, sep = "")
#' xpf_transcribe(c("casa", "cielo"), toy, sep = NULL)
#'
#' @examplesIf xpf_has_data()
#' # Corpus languages, after xpf_download()
#' xpf_transcribe(c("perro", "chico"), "es")
#' eu <- xpf_transcriber("eu")
#' xpf_transcribe(c("etxea", "zuhaitz"), eu)
xpf_transcribe <- function(words, language, script = NULL, sep = " ") {
  tr <- as_transcriber(language, script)
  if (is.factor(words)) words <- as.character(words)
  if (!is.character(words)) stop("`words` must be a character vector.", call. = FALSE)
  if (!is.null(sep)) stopifnot(is.character(sep), length(sep) == 1)

  ok <- !is.na(words)
  phonemes <- vector("list", length(words))
  if (any(ok)) phonemes[ok] <- engine_transcribe(tr$id, enc2utf8(unname(words[ok])))
  names(phonemes) <- names(words)

  if (is.null(sep)) {
    phonemes[!ok] <- list(NA_character_)
    return(phonemes)
  }
  out <- rep(NA_character_, length(words))
  out[ok] <- vapply(phonemes[ok], paste, "", collapse = sep)
  names(out) <- names(words)
  out
}

as_transcriber <- function(language, script = NULL) {
  if (inherits(language, "xpf_transcriber")) {
    xpf_context()
    if (!isTRUE(js_call("has", language$id))) {
      stop("This transcriber belongs to an earlier R session; create it again with xpf_transcriber().",
           call. = FALSE)
    }
    return(language)
  }
  if (!is.character(language) || length(language) != 1 || is.na(language)) {
    stop("`language` must be a language code or an xpf_transcriber.", call. = FALSE)
  }
  key <- transcriber_key(language, script)
  xpf_context()
  tr <- .xpf$transcribers[[key]]
  if (is.null(tr)) {
    tr <- xpf_transcriber(language, script)
    .xpf$transcribers[[key]] <- tr
  }
  tr
}

# Cached transcribers are keyed by data directory too, so pointing
# xpf_data_dir() elsewhere never reuses rules loaded from the old data.
transcriber_key <- function(language, script) {
  paste(xpf_data_dir(), language, script %||% "", sep = "\r")
}

#' Check a transcriber against its verification words
#'
#' Every language in the XPF corpus comes with a list of words and their
#' expected transcriptions. This transcribes each word and compares.
#'
#' @inheritParams xpf_transcribe
#' @return A data frame with columns `word`, `expected`, `transcribed`,
#'   `ok` and `comment`, one row per verification word.
#' @export
#' @examples
#' toy <- xpf_transcriber("toy", file = system.file("extdata", "toy.json", package = "xpfcorpus"))
#' xpf_verify(toy)
#' @examplesIf xpf_has_data()
#' v <- xpf_verify("es")
#' all(v$ok)
xpf_verify <- function(language, script = NULL) {
  tr <- if (inherits(language, "xpf_transcriber")) {
    as_transcriber(language)
  } else {
    xpf_context()
    .xpf$transcribers[[transcriber_key(language, script)]] %||%
      xpf_transcriber(language, script, verify = FALSE)
  }
  v <- tr$verify
  got <- if (nrow(v) > 0) xpf_transcribe(v$word, tr) else character()
  data.frame(word = v$word, expected = v$expected, transcribed = got,
             ok = got == v$expected, comment = v$comment,
             stringsAsFactors = FALSE)
}
