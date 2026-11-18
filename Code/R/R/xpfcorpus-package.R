#' @keywords internal
#' @details
#' The corpus rules are not included in the package, because they are under
#' a separate license (CC BY-NC-SA 4.0): download them once with
#' [xpf_download()]. The package code is MIT.
#'
#' The main function is [xpf_transcribe()]. [xpf_languages()] lists the
#' languages, [xpf_transcriber()] loads one (or rules of your own), and
#' [xpf_verify()] checks a language's rules against its verification words.
#'
#' The rules are applied by `translate04.js`, the JavaScript port of the XPF
#' reference implementation, which runs inside an embedded 'V8' engine. Its
#' output matches the Python `xpfcorpus` package. See
#' `system.file("PROVENANCE", package = "xpfcorpus")` for the exact versions
#' of the bundled engine.
#'
#' To cite the XPF corpus, use `citation("xpfcorpus")`.
"_PACKAGE"
